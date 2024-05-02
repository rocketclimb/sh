import fs from "node:fs";
import path from "node:path";
import crypto from "crypto";
import { EXIT_CODES } from "./config.js";

const traverseDirectory = (dirPath, dependencies) => {
  fs.readdirSync(dirPath).forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      traverseDirectory(fullPath, dependencies);
    } else if (path.basename(fullPath) === "package.json") {
      extractDependencies(fullPath, dependencies);
    }
  });
};

// Function to extract dependency sections from package.json
const extractDependencies = (filePath, dependencies) => {
  try {
    const packageJson = require(filePath);
    const allDependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
      // Add other dependency sections here if needed
    };

    Object.entries(allDependencies).forEach(([name, version]) => {
      const dependency = { name, version };
      if (
        !dependencies.some(
          (dep) =>
            dep.name === dependency.name && dep.version === dependency.version
        )
      ) {
        dependencies.push(dependency);
      }
    });
  } catch (error) {
    // error reading package.json
  }
};

// Main function to calculate hash of unique dependencies
export const calculateDependenciesHash = (args) => {
  const rootDir = process.cwd();
  const allDependencies = [];
  traverseDirectory(rootDir, allDependencies);

  // Sort dependencies array to ensure consistent hash
  const sortedDependencies = allDependencies.sort(
    (a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version)
  );

  // Calculate SHA-256 hash of sorted dependencies array
  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify(sortedDependencies))
    .digest("hex");

  return {
    stdout: hash,
    code: EXIT_CODES.SUCCESS,
  };
};
