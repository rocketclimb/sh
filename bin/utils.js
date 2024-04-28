import fs from "node:fs";
import { execSync } from "node:child_process";

export const RELEASE_MARKER = "-release";

const VERSION_MATCHER = /((?<major>\d+)\.)?((?<minor>\d+)\.)?(?<patch>\*|\d+)/;

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
  return onlyVersion ? currentVersion : text.replace(VERSION_MATCHER, currentVersion);
};

export const writeFile = (filename, content) => fs.writeFileSync(filename, content);

export const getLatestTag = () => {
  try {
    return execSync("git fetch --prune-tags --prune -q && git tag --sort=-refname | head -1")
      .toString()
      .trim();
  } catch (e) {
    return "v0.0.0";
  }
};
