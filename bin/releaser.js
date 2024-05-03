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

export const releaser = (args) => {
  undoCurrentReleaserChanges();

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
      newVersions[pkgName] = bumper(type, `packages/${pkgName}`);
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
      bumper(`${updateTo}${tag}`, "packages/icons");
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
