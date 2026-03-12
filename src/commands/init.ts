import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { input, confirm } from "@inquirer/prompts";
import { ConfigError } from "../lib/errors.js";
import { lsRemoteHead } from "../lib/git.js";
import { SHORT_HASH_LENGTH } from "../config.js";

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

function buildConfigContent(opts: {
  commit: string;
  repo: string;
  crateDir: string;
  crateName: string;
  dest: string;
}): string {
  return `# Aeneas extraction configuration
# See: https://github.com/oliver-butterley/aeneas-cli

aeneas:
  commit: "${opts.commit}"
  repo: "${opts.repo}"

charon:
  cargo_args: []
  start_from: []
  exclude: []
  opaque: []

aeneas_args:
  options:
    - split-files
  dest: "${opts.dest}"

crate:
  dir: "${opts.crateDir}"
  name: "${opts.crateName}"

tweaks:
  files: []
  substitutions: []
`;
}

export async function initCommand(opts?: { interactive?: boolean }): Promise<void> {
  const configPath = path.join(process.cwd(), CONFIG_FILENAME);

  if (fs.existsSync(configPath)) {
    throw new ConfigError(`${CONFIG_FILENAME} already exists in this directory`, {
      hint: "Delete it first if you want to re-initialize",
    });
  }

  const detected = detectCrate(process.cwd());
  let crateDir = detected.dir;
  let crateName = detected.name;
  let repo = DEFAULT_REPO;
  const latestHash = await lsRemoteHead(repo, "refs/heads/main");
  let commit = latestHash ? latestHash.substring(0, SHORT_HASH_LENGTH) : "main";
  let dest = "LeanOutput";

  if (opts?.interactive) {
    console.log(chalk.bold("\n  Configure aeneas-config.yml\n"));
    crateName = await input({ message: "Crate name", default: crateName });
    crateDir = await input({ message: "Crate directory", default: crateDir });
    dest = await input({ message: "Lean output directory", default: dest });
    commit = await input({ message: "Aeneas commit/branch", default: commit });
    repo = await input({ message: "Aeneas repo URL", default: repo });

    const ok = await confirm({ message: "Create aeneas-config.yml?", default: true });
    if (!ok) {
      console.log(chalk.dim("  Cancelled."));
      return;
    }
  }

  const content = buildConfigContent({ commit, repo, crateDir, crateName, dest });
  fs.writeFileSync(configPath, content, "utf-8");
  console.log(chalk.green(`  Created ${CONFIG_FILENAME}`));
  if (crateName === "package-name") {
    console.log(chalk.yellow(`  No Cargo.toml found — edit crate.name in ${CONFIG_FILENAME}`));
  } else {
    console.log(chalk.dim(`  Detected crate: ${crateName}`));
  }
}
