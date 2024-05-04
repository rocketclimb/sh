import fs from "node:fs";
import { join } from "node:path";
import shell from "shelljs";
import { EXIT_CODES } from "./config.js";

const fixEsmFile = (file) => {
  const content = fs.readFileSync(file, { encoding: "utf8" });
  fs.writeFileSync(
    file,
    content.replace(/(import.*from "\.\/[\w|\/|-]+)";/g, '$1.mjs";'),
    { encoding: "utf8" }
  );
};

export const fixEsm = (args) => {
  const pwd = shell.pwd().toString();
  args.forEach((inputName) => {
    shell
      .find(inputName)
      .forEach((arg) => /.*\.mjs$/i.exec(arg) && fixEsmFile(join(pwd, arg)));
  });
  return EXIT_CODES.SUCCESS;
};
