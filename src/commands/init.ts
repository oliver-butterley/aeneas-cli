import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { input } from "@inquirer/prompts";
import { ConfigError } from "../lib/errors.js";

const CONFIG_FILENAME = "aeneas-config.yml";

const DEFAULT_REPO = "https://github.com/AeneasVerif/aeneas.git";

export async function initCommand(): Promise<void> {
  const configPath = path.join(process.cwd(), CONFIG_FILENAME);

  if (fs.existsSync(configPath)) {
    throw new ConfigError(`${CONFIG_FILENAME} already exists in this directory`, {
      hint: "Delete it first if you want to re-initialize",
    });
  }

  console.log(chalk.bold("\nInitialize aeneas-config.yml\n"));

  const crateDir = await input({
    message: "Rust crate directory (relative to project root):",
    default: ".",
  });

  const crateName = await input({
    message: "Crate name (as in Cargo.toml):",
    default: crateDir === "." ? path.basename(process.cwd()).replace(/-/g, "_") : crateDir.replace(/-/g, "_"),
  });

  const repo = await input({
    message: "Aeneas git repo:",
    default: DEFAULT_REPO,
  });

  const commit = await input({
    message: "Aeneas commit (full hash or branch name):",
    default: "main",
  });

  const dest = await input({
    message: "Output directory for generated Lean files:",
    default: "LeanOutput",
  });

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
  backend: lean
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
  console.log(chalk.green(`\n  ✓ Created ${CONFIG_FILENAME}`));
  console.log(`\nNext steps:`);
  console.log(`  1. Edit ${CONFIG_FILENAME} to add your charon start_from modules`);
  console.log(`  2. Run ${chalk.bold("aeneas-cli install")} to clone and build Aeneas`);
  console.log(`  3. Run ${chalk.bold("aeneas-cli extract")} to generate Lean files`);
}
