import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { input } from "@inquirer/prompts";
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
function detectCrate(cwd: string): { dir: string; name: string } | null {
  // Check for Cargo.toml in cwd (single-crate project)
  const rootCargo = path.join(cwd, "Cargo.toml");
  const rootName = readCrateName(rootCargo);
  if (rootName) {
    return { dir: ".", name: rootName };
  }
  return null;
}

export async function initCommand(): Promise<void> {
  const configPath = path.join(process.cwd(), CONFIG_FILENAME);

  if (fs.existsSync(configPath)) {
    throw new ConfigError(`${CONFIG_FILENAME} already exists in this directory`, {
      hint: "Delete it first if you want to re-initialize",
    });
  }

  console.log(chalk.bold("\nInitialize aeneas-config.yml\n"));

  const detected = detectCrate(process.cwd());
  if (detected) {
    console.log(chalk.dim(`  Detected crate: ${detected.name} (${detected.dir})\n`));
  }

  const crateDir = await input({
    message: "Rust crate directory (relative to project root):",
    default: detected?.dir ?? ".",
  });

  // Re-detect if user changed the directory
  let effectiveDetected: { dir: string; name: string } | null = null;
  if (crateDir === detected?.dir) {
    effectiveDetected = detected;
  } else {
    const cargoPath = path.join(process.cwd(), crateDir, "Cargo.toml");
    const name = readCrateName(cargoPath);
    if (name) {
      effectiveDetected = { dir: crateDir, name };
    }
  }

  const crateName = await input({
    message: "Crate name (as in Cargo.toml):",
    default: effectiveDetected?.name ?? "package-name",
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
