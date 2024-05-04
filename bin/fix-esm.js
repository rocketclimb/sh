import fs from "node:fs";
import { join, basename } from "node:path";
import shell from "shelljs";
import { EXIT_CODES } from "./config.js";

const fixEsmFile = (validFiles, file) => {
  const content = fs.readFileSync(file, { encoding: "utf8" });
  const updatedContent = content.replace(
    /([import|export].*from "\.\/[\w|\/|-]+)";/g,
    (match, group) => {
      let [statement, file] = group.split("./");
      return validFiles.includes(`${file.split("/").pop()}.mjs`)
        ? `${statement}./${file}.mjs";`
        : match;
    }
  );
  fs.writeFileSync(file, updatedContent, { encoding: "utf8" });
};

export const fixEsm = (args) => {
  const pwd = shell.pwd().toString();

  const files = [].concat(
    ...args.map((inputName) =>
      shell.find(inputName).filter((file) => /.*\.mjs$/i.exec(file))
    )
  );

  const validFiles = files.map((file) => basename(file));

  files.forEach((file) => fixEsmFile(validFiles, join(pwd, file)));
  return EXIT_CODES.SUCCESS;
};
