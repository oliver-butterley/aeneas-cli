import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { select } from "@inquirer/prompts";
import {
  type AeneasConfig,
  shortHash,
  updateConfigCommit,
  findLakefileAeneasRev,
  updateLakefileRev,
} from "../config.js";
import { getAeneasDir, getAeneasRepoDir } from "../lib/paths.js";
import * as git from "../lib/git.js";
import { installCommand } from "./install.js";

export async function updateCommand(
  config: AeneasConfig,
  root: string,
): Promise<void> {
  console.log(chalk.bold("\n=== Select Aeneas version ===\n"));

  // Step 1: List remote branches
  const branches = await git.lsRemoteBranches(config.aeneas.repo);

  if (branches.length === 0) {
    console.log(chalk.red("No branches found on remote"));
    return;
  }

  // Put 'main' first, then sort the rest alphabetically, keep list short
  branches.sort((a, b) => {
    if (a === "main") return -1;
    if (b === "main") return 1;
    return a.localeCompare(b);
  });
  const topBranches = branches.slice(0, 10);

  const branchChoice = await select({
    message: "Select branch:",
    choices: [
      ...topBranches.map((b) => ({ name: b, value: b })),
      { name: chalk.dim("← Back"), value: "__back__" },
    ],
  });

  if (branchChoice === "__back__") return;
  const branch = branchChoice;

  // Step 2: Fetch and show recent commits on that branch
  const repoDir = getAeneasRepoDir(root);
  const aeneasDir = getAeneasDir(root);

  // We need a local repo to view commits. Clone if not exists
  if (!fs.existsSync(repoDir)) {
    fs.mkdirSync(aeneasDir, { recursive: true });
    await git.clone(config.aeneas.repo, repoDir);
  } else {
    await git.fetch(repoDir);
  }

  // Get recent commits on the selected branch
  const logOutput = await git.log(repoDir, {
    count: 10,
    format: "%H %h %ci %s",
    ref: `origin/${branch}`,
  });

  const commits = logOutput
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [hash, shortHash, date, _time, _tz, ...rest] = line.split(" ");
      return {
        hash,
        shortHash,
        date,
        subject: rest.join(" "),
      };
    });

  if (commits.length === 0) {
    console.log(chalk.red("No commits found on branch"));
    return;
  }

  const pinned = config.aeneas.commit;
  const commitChoices = commits.map((c, i) => {
    const subject =
      c.subject.length > 50 ? c.subject.substring(0, 50) + "…" : c.subject;
    const tags: string[] = [];
    if (i === 0) tags.push(chalk.green("latest"));
    if (c.hash.startsWith(pinned) || pinned.startsWith(c.shortHash))
      tags.push(chalk.cyan("current"));
    const suffix = tags.length > 0 ? ` ${tags.join(" ")}` : "";
    return {
      name: `${c.shortHash} ${c.date} ${subject}${suffix}`,
      value: c.hash,
    };
  });

  console.log(chalk.dim("  Tip: For older commits, edit aeneas-config.yml and lakefile.toml manually.\n"));

  const commitChoice = await select({
    message: "Select commit:",
    choices: [
      ...commitChoices,
      { name: chalk.dim("← Back"), value: "__back__" },
    ],
  });

  if (commitChoice === "__back__") return;
  const selectedHash = commitChoice;

  // Step 3: Update config
  const configPath = path.join(root, "aeneas-config.yml");
  updateConfigCommit(configPath, selectedHash);
  console.log(chalk.green(`  ✓ Updated aeneas-config.yml to ${selectedHash.substring(0, 8)}`));

  // Step 3b: Update lakefile.toml if it has an aeneas rev
  const lakefile = findLakefileAeneasRev(root);
  if (lakefile && lakefile.currentRev !== selectedHash) {
    const updateLakefile = await select({
      message: `Update lakefile.toml rev? (currently ${lakefile.currentRev.substring(0, 8)})`,
      choices: [
        { name: "Yes", value: true },
        { name: "No", value: false },
      ],
    });
    if (updateLakefile) {
      updateLakefileRev(lakefile.filePath, selectedHash);
      console.log(chalk.green(`  ✓ Updated lakefile.toml rev to ${selectedHash.substring(0, 8)}`));
    }
  }
  console.log();

  // Step 4: Ask to install
  const doInstall = await select({
    message: "Clone and build now?",
    choices: [
      { name: "Yes", value: true },
      { name: "No", value: false },
    ],
  });

  if (doInstall) {
    // Reload config with new commit (short hash)
    config.aeneas.commit = shortHash(selectedHash);
    await installCommand(config, root);
  }
}
