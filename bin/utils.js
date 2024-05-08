import { EOL } from "node:os";
import fs from "node:fs";
import shelljs from "shelljs";

const COMMIT_MARKER = "##";
const FIELD_MARKER = "|||";

export const COMMIT_SCOPE = "releaser";
export const LASTEST_VERSIONS_FILE = "./.versions.json";
export const CHANGELOG_FILE = "CHANGELOG.md";

const commitPattern = new RegExp(`^${COMMIT_MARKER}`);

export const INITIAL_VERSION = "0.0.0";
export const INITIAL_TAG = `v${INITIAL_VERSION}`;

export const RELEASE_MARKER = "-release";

const VERSION_MATCHER = /((?<major>\d+)\.)?((?<minor>\d+)\.)?(?<patch>\*|\d+)/;

export const execSyncWithNoError = (cmd) => {
  try {
    return shelljs.exec(cmd, { silent: true }).stdout;
  } catch (e) {
    shelljs.echo(e);
  }
};

export const execSyncToString = (cmd) =>
  (execSyncWithNoError(cmd) ?? "").toString();

export const versionBumper = (versionInfo, type) => {
  versionInfo[type] = parseInt(versionInfo[type]) + 1;

  if (type === "major") {
    versionInfo.minor = 0;
    versionInfo.patch = 0;
  } else if (type === "minor") {
    versionInfo.patch = 0;
  }

  return versionInfo;
};

export const bumpVersion = (text, type, onlyVersion) => {
  const { groups } = VERSION_MATCHER.exec(text);
  const { major, minor, patch } = versionBumper(groups, type);
  const currentVersion = `${major}.${minor}.${patch}`;
  return onlyVersion
    ? currentVersion
    : text.replace(VERSION_MATCHER, currentVersion);
};

export const pack = () => {
  execSyncWithNoError("npm pack --silent -w packages/icons");
  return execSyncToString("ls -tU *.tgz | head -1").trim();
};

export const writeFile = (filename, content) =>
  fs.writeFileSync(filename, content);

export const isInitialTag = (tag) => tag === INITIAL_TAG;

export const getLatestTag = () => {
  try {
    return (
      execSyncToString(
        "git fetch --prune-tags --prune -q && git tag --sort=-refname | head -1"
      ).trim() || INITIAL_TAG
    );
  } catch (e) {
    return INITIAL_TAG;
  }
};

export const getCommits = (diff) =>
  execSyncWithNoError(
    `git --no-pager log  --name-only --pretty=format:"${COMMIT_MARKER}%h${FIELD_MARKER}%s${FIELD_MARKER}%H" ${diff} || ''`
  );

export const isNewCommit = (commit) => commitPattern.exec(commit);

export const getCommitInfo = (commit) =>
  commit.replace(commitPattern, "").split(FIELD_MARKER);

export const getCurrentBranch = () =>
  execSyncToString(`git rev-parse --abbrev-ref HEAD`).trim();

const isCiChangeOnCurrentBrach = (subject, currentBranch) =>
  subject.startsWith(`ci(${COMMIT_SCOPE})`) && subject.includes(currentBranch);

export const undoCurrentReleaserChanges = (packages, currentBranch) => {
  const sanitize = (hash) => hash.replace(/.\n.*/g, "").trim();

  const search = [
    LASTEST_VERSIONS_FILE,
    ...packages.map((pkg) => `./${pkg}/${CHANGELOG_FILE}`),
  ];

  const toRevert = search
    .map((file) => {
      const [subject, hash] = execSyncToString(
        `git --no-pager log --format="%s${FIELD_MARKER}%H" -- ${LASTEST_VERSIONS_FILE}`
      ).split(FIELD_MARKER);

      return (
        subject &&
        isCiChangeOnCurrentBrach(subject, currentBranch) && {
          file,
          hash: sanitize(hash),
        }
      );
    })
    .filter((revert) => !!revert);

  toRevert.forEach(({ file, hash }) => {
    const previousHash = `${hash}^1`;
    execSyncWithNoError(`git checkout ${previousHash} -- ${file}`);
  });
};

export const getCurrentVersions = () =>
  JSON.parse(fs.readFileSync(LASTEST_VERSIONS_FILE).toString());

export const getCurrentPackages = () =>
  JSON.parse(fs.readFileSync("./package.json").toString())?.workspaces || [];

export const addChanges = (type, message) =>
  execSyncToString(
    `git add . && git commit -m "ci(${type}): ${message} for ${getCurrentBranch()}" --no-verify`
  );

export const bumper = (toVersion, pkg) => {
  const addParams = pkg ? `-w ${pkg}` : "";
  const [l1, l2] = execSyncToString(
    `npm version ${toVersion} ${addParams} --git-tag-version false`
  )
    .trim()
    .split("\n");
  return (l2 ?? l1).replace(/^v/, "").trim();
};

export const pushChanges = () => execSyncWithNoError(`git push --no-verify`);
