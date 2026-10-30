import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const output = "dist";
if (existsSync(output)) rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

for (const file of readdirSync(".").filter((entry) => entry.endsWith(".html"))) {
  copyFileSync(file, join(output, file));
}
for (const directory of ["css", "data", "img", "js"]) {
  if (directory === "data") {
    const destination = join(output, directory);
    mkdirSync(destination, { recursive: true });
    for (const file of readdirSync(directory).filter((entry) => entry !== "directorio.json")) {
      cpSync(join(directory, file), join(destination, file), { recursive: true });
    }
  } else {
    cpSync(directory, join(output, directory), { recursive: true });
  }
}

console.log("Sitio estático preparado en dist/.");
