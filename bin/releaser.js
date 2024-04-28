import { EOL } from "node:os";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { EXIT_CODES } from "./config.js";
import { changelog, ROOT_PKG_NAME, ICONS_SCOPE_NAME } from "./changelog.js";
import { RELEASE_MARKER, bumpVersion, writeFile, getLatestTag } from "./utils.js";

const LASTEST_VERSIONS_FILE = "./.latest-versions.json";

const calculateFileHash = (filename) => {
  const data = fs.readFileSync(filename).toString();
  const hash = createHash("md5");
  hash.update(data);
  return hash.digest("hex");
};

const pack = () => {
  execSync("npm pack --silent -w packages/icons");
  return execSync("ls -tU *.tgz | head -1").toString().trim();
};

const getPackHash = () => {
  const pkgName = pack();
  return calculateFileHash(pkgName);
};

const hashChangesOnPack = () => {
  const newHash = getPackHash();
  const { hash } = versions;
  if (hash === newHash) {
    execSync(`rm -fR ${pkgName}`);
    return true;
  }
  return false;
};

const addChanges = (message) => {
  try {
    execSync(`git add . && git commit -m "ci(changelog): ${message}" --no-verify`).toString();
  } catch (e) {
    //console.log(e);
  }
};

const bumper = (toVersion, addParams) => {
  const [l1, l2] = execSync(`npm version --git-tag-version false ${toVersion} ${addParams ?? ""}`)
    .toString()
    .trim()
    .split("\n");
  return (l2 ?? l1).replace(/^v/, "").trim();
};

export const releaser = (args) => {
  const versions = JSON.parse(fs.readFileSync(LASTEST_VERSIONS_FILE).toString());

  const latestTag = getLatestTag();

  const {
    stdout: { newTag, releaseNote, packagesBumpType, repoBumpType },
    code
  } = changelog([latestTag, ...args]);

  let tagName = newTag;
  const newVersions = {};

  Object.entries(packagesBumpType)
    .filter(([pkgName]) => ![ROOT_PKG_NAME, ICONS_SCOPE_NAME].includes(pkgName))
    .forEach(([pkgName, type]) => {
      newVersions[pkgName] = bumper(type, `-w packages/${pkgName}`);
    });

  if (packagesBumpType?.icons || hashChangesOnPack()) {
    try {
      const tag = process.env.PRE_RELEASE_TAG ? `-${process.env.PRE_RELEASE_TAG.trim()}` : "";
      const { icons } = versions;
      const updateTo = bumpVersion(icons, packagesBumpType.icons ?? "patch", true);
      bumper(`${updateTo}${tag} -w packages/icons`);
      newVersions[ICONS_SCOPE_NAME] = `${updateTo}${tag}`;
      tagName += RELEASE_MARKER;
      versions.hash = getPackHash();
    } catch (e) {
      //console.log(e);
    }
  }

  if (packagesBumpType[ROOT_PKG_NAME]) {
    newVersions[ROOT_PKG_NAME] = bumper(repoBumpType);
  }

  writeFile(LASTEST_VERSIONS_FILE, JSON.stringify({ ...versions, ...newVersions }, null, 2));
  addChanges("update versions");

  if (releaseNote) {
    writeFile("release-notes.md", releaseNote + EOL);
  }

  return {
    stdout: tagName + EOL,
    code: EXIT_CODES.SUCCESS
  };
};
