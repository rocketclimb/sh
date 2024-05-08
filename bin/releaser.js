import { EOL } from "node:os";
import fs from "node:fs";
import { createHash } from "node:crypto";

import { changelog, ROOT_PKG_NAME, ICONS_SCOPE_NAME } from "./changelog.js";
import {
  LASTEST_VERSIONS_FILE,
  RELEASE_MARKER,
  COMMIT_SCOPE,
  undoCurrentReleaserChanges,
  getCurrentVersions,
  bumpVersion,
  writeFile,
  getLatestTag,
  bumper,
  pack,
  addChanges,
  pushChanges,
  execSyncWithNoError,
  getCurrentPackages,
  getCurrentBranch,
} from "./utils.js";

const calculateFileHash = (filename) => {
  const data = fs.readFileSync(filename).toString();
  const hash = createHash("md5");
  hash.update(data);
  return hash.digest("hex");
};

const getPackHash = () => {
  const pkgName = pack();
  return calculateFileHash(pkgName);
};

const hasChangesOnPack = (hash) => getPackHash() !== hash;

const getPackageName = (pkgName, packages) =>
  packages.find((fullName) => new RegExp(`.*\/${pkgName}$`).exec(fullName));

export const releaser = (args) => {
  const currentPackages = getCurrentPackages();
  const currentBranch = getCurrentBranch();

  undoCurrentReleaserChanges(currentPackages, currentBranch);

  const versions = getCurrentVersions();

  const latestTag = getLatestTag();

  const {
    stdout: { newTag, releaseNote, packagesBumpType, repoBumpType },
    code,
  } = changelog([latestTag, ...args]);

  let tagName = newTag;
  const newVersions = {};

  Object.entries(packagesBumpType)
    .filter(([pkgName]) => ![ROOT_PKG_NAME, ICONS_SCOPE_NAME].includes(pkgName))
    .forEach(([pkgName, type]) => {
      const fullPkgName = getPackageName(pkgName, currentPackages);
      if (fullPkgName) {
        const newVersion = bumpVersion(versions[pkgName], type, true);
        newVersions[pkgName] = bumper(newVersion, fullPkgName);
      }
    });

  const { hash } = versions;

  if (packagesBumpType?.icons || hasChangesOnPack(hash)) {
    try {
      const tag = process.env.PRE_RELEASE_TAG
        ? `-${process.env.PRE_RELEASE_TAG.trim()}`
        : "";
      const { icons } = versions;
      const updateTo = bumpVersion(
        icons,
        packagesBumpType.icons ?? "patch",
        true
      );

      execSyncWithNoError(
        "ls *.tgz > /dev/null && rm -fR *.tgz || echo 'no tgz'"
      );

      bumper(`${updateTo}${tag}`, "packages/icons");
      newVersions[ICONS_SCOPE_NAME] = `${updateTo}${tag}`;
      tagName += RELEASE_MARKER;
      versions.hash = getPackHash();
    } catch (e) {
      //console.log(e);
    }
  }

  if (packagesBumpType[ROOT_PKG_NAME]) {
    const newVersion = bumpVersion(versions[ROOT_PKG_NAME], repoBumpType, true);
    newVersions[ROOT_PKG_NAME] = bumper(newVersion);
  }

  writeFile(
    LASTEST_VERSIONS_FILE,
    JSON.stringify({ ...versions, ...newVersions }, null, 2)
  );

  addChanges(COMMIT_SCOPE, "bump packages versions and update changelog");

  pushChanges();

  if (releaseNote) {
    writeFile("release-notes.md", releaseNote + EOL);
  }

  return {
    stdout: (newVersions[ROOT_PKG_NAME] && tagName) + EOL,
    code,
  };
};
