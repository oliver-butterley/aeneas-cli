import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { select, input } from "@inquirer/prompts";
import { type AeneasConfig, shortHash } from "../config.js";
import { getAeneasRepoDir } from "../lib/paths.js";

const LEAN_WORKFLOW_PATH = ".github/workflows/lean.yml";

const leanWorkflowContent = `name: Lean Action CI

on:
  push:
  pull_request:
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v5
      - uses: leanprover/lean-action@v1
`;

/** Convert kebab-case crate name to PascalCase Lean package name. */
function toPascalCase(name: string): string {
  return name
    .split(/[-_]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
}

function lakefileContent(opts: {
  leanPackageName: string;
  aeneasRepo: string;
  aeneasRev: string;
  extractionDir: string;
}): string {
  return `name = "${opts.leanPackageName}"
version = "0.1.0"
defaultTargets = ["${opts.leanPackageName}"]

[leanOptions]
autoImplicit = false
relaxedAutoImplicit = false
weak.linter.mathlibStandardSet = true
maxRecDepth = 10000

[[require]]
name = "aeneas"
git = "${opts.aeneasRepo}"
subDir = "backends/lean"
rev = "${opts.aeneasRev}"

[[lean_lib]]
name = "${opts.extractionDir}"

[[lean_lib]]
name = "Proof"
`;
}

function readToolchainFromAeneas(root: string): string | null {
  const toolchainPath = path.join(getAeneasRepoDir(root), "backends", "lean", "lean-toolchain");
  if (!fs.existsSync(toolchainPath)) return null;
  return fs.readFileSync(toolchainPath, "utf-8").trim();
}

export async function leanInitCommand(config: AeneasConfig, root: string): Promise<void> {
  console.log(chalk.bold("\n=== Initialize Lean project ===\n"));

  // Choose location
  const location = await select({
    message: "Where should the Lean project root be?",
    choices: [
      { name: "Project root (lakefile.toml alongside Cargo.toml)", value: "root" },
      { name: "proof/ subfolder", value: "proof" },
      { name: "Custom subfolder", value: "custom" },
      { name: chalk.dim("← Back"), value: "__back__" },
    ],
  });

  if (location === "__back__") return;

  let subdir = "";
  if (location === "custom") {
    subdir = await input({ message: "Subfolder name" });
    if (!subdir) return;
  } else if (location === "proof") {
    subdir = "proof";
  }

  const proofDir = subdir ? path.join(root, subdir) : root;
  const defaultName = toPascalCase(config.crate.name);

  const leanPackageName = await input({
    message: "Lean package name",
    default: defaultName,
  });

  const extractionDir = await input({
    message: "Extraction output directory name",
    default: "Extraction",
  });

  // Check if lakefile.toml already exists
  const lakefilePath = path.join(proofDir, "lakefile.toml");
  if (fs.existsSync(lakefilePath)) {
    console.log(
      chalk.yellow(`\n  lakefile.toml already exists at ${path.relative(root, lakefilePath)}`),
    );
    return;
  }

  // Determine aeneas rev
  const aeneasRev = shortHash(config.aeneas.commit);

  // Determine lean toolchain
  let toolchain = readToolchainFromAeneas(root);
  if (!toolchain) {
    toolchain = await input({
      message: "Lean toolchain (e.g. leanprover/lean4:v4.x.0)",
      default: "leanprover/lean4:v4.19.0",
    });
  } else {
    console.log(chalk.dim(`  Using toolchain from local Aeneas install: ${toolchain}`));
  }

  // Create directories
  fs.mkdirSync(proofDir, { recursive: true });
  fs.mkdirSync(path.join(proofDir, extractionDir), { recursive: true });
  fs.mkdirSync(path.join(proofDir, "Proof"), { recursive: true });

  // Write lakefile.toml
  const lakefile = lakefileContent({
    leanPackageName,
    aeneasRepo: config.aeneas.repo,
    aeneasRev,
    extractionDir,
  });
  fs.writeFileSync(lakefilePath, lakefile, "utf-8");
  console.log(chalk.green(`  ✓ Created ${path.relative(root, lakefilePath)}`));

  // Write lean-toolchain
  const toolchainPath = path.join(proofDir, "lean-toolchain");
  if (!fs.existsSync(toolchainPath)) {
    fs.writeFileSync(toolchainPath, toolchain + "\n", "utf-8");
    console.log(chalk.green(`  ✓ Created ${path.relative(root, toolchainPath)}`));
  }

  // Write .gitkeep in Proof/ so it's tracked
  const gitkeep = path.join(proofDir, "Proof", ".gitkeep");
  if (!fs.existsSync(gitkeep)) {
    fs.writeFileSync(gitkeep, "", "utf-8");
  }

  // Append Lean entries to .gitignore if not already present
  const gitignorePath = path.join(root, ".gitignore");
  const gitignoreEntries = [".lake/", "FunsExternal_Template.lean", "TypesExternal_Template.lean"];
  const existingGitignore = fs.existsSync(gitignorePath)
    ? fs.readFileSync(gitignorePath, "utf-8")
    : "";
  const missing = gitignoreEntries.filter((e) => !existingGitignore.split("\n").includes(e));
  if (missing.length > 0) {
    const block = "\n# Lean & Aeneas\n" + missing.join("\n") + "\n";
    fs.appendFileSync(gitignorePath, block, "utf-8");
    console.log(chalk.green(`  ✓ Updated .gitignore`));
  }

  // Write lean CI workflow
  const workflowFile = path.join(root, LEAN_WORKFLOW_PATH);
  if (!fs.existsSync(workflowFile)) {
    fs.mkdirSync(path.dirname(workflowFile), { recursive: true });
    fs.writeFileSync(workflowFile, leanWorkflowContent, "utf-8");
    console.log(chalk.green(`  ✓ Created ${LEAN_WORKFLOW_PATH}`));
  }

  // Suggest updating aeneas_args.dest
  const expectedDest = subdir ? path.join(subdir, extractionDir) : extractionDir;
  if (config.aeneas_args.dest !== expectedDest) {
    console.log(
      chalk.yellow(`\n  Update aeneas_args.dest in aeneas-config.yml to "${expectedDest}"`),
    );
  }

  console.log(
    chalk.dim(`\n  Run 'lake build' in ${subdir ? subdir + "/" : "."} to fetch dependencies`),
  );
}
