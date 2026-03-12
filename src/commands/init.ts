import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { ConfigError } from "../lib/errors.js";

const CONFIG_FILENAME = "aeneas-config.yml";

const DEFAULT_REPO = "https://github.com/AeneasVerif/aeneas.git";

/** Read the package name from a Cargo.toml file, or return null. */
function readCrateName(cargoPath: string): string | null {
  if (!fs.existsSync(cargoPath)) return null;
  const content = fs.readFileSync(cargoPath, "utf-8");
  const match = content.match(/^\[package\][^[]*?^name\s*=\s*"([^"]+)"/ms);
  return match?.[1] ?? null;
}

/** Detect crate directory and name from the current working directory. */
function detectCrate(cwd: string): { dir: string; name: string } {
  const rootCargo = path.join(cwd, "Cargo.toml");
  const rootName = readCrateName(rootCargo);
  if (rootName) {
    return { dir: ".", name: rootName };
  }
  return { dir: ".", name: "package-name" };
}

export async function initCommand(): Promise<void> {
  const configPath = path.join(process.cwd(), CONFIG_FILENAME);

  if (fs.existsSync(configPath)) {
    throw new ConfigError(`${CONFIG_FILENAME} already exists in this directory`, {
      hint: "Delete it first if you want to re-initialize",
    });
  }

  const detected = detectCrate(process.cwd());

  const crateDir = detected.dir;
  const crateName = detected.name;
  const repo = DEFAULT_REPO;
  const commit = "main";
  const dest = "LeanOutput";

  const content = `# Aeneas extraction configuration
# See: https://github.com/AeneasVerif/aeneas

aeneas:
  commit: "${commit}"
  repo: "${repo}"

charon:
  preset: aeneas
  cargo_args: []
  start_from: []
  exclude: []
  opaque: []

aeneas_args:
  options:
    - loops-to-rec
    - split-files
  dest: "${dest}"

crate:
  dir: "${crateDir}"
  name: "${crateName}"

tweaks:
  files: []
  substitutions: []
`;

  fs.writeFileSync(configPath, content, "utf-8");
  console.log(chalk.green(`  Created ${CONFIG_FILENAME}`));
  if (crateName === "package-name") {
    console.log(chalk.yellow(`  No Cargo.toml found — edit crate.name in ${CONFIG_FILENAME}`));
  } else {
    console.log(chalk.dim(`  Detected crate: ${crateName}`));
  }
}
