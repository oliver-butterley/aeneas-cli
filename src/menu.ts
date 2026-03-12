import fs from "node:fs";
import chalk from "chalk";
import { select } from "@inquirer/prompts";
import { type AeneasConfig, loadConfig } from "./config.js";
import { getAeneasRepoDir } from "./lib/paths.js";
import { which } from "./lib/shell.js";
import * as git from "./lib/git.js";
import { statusCommand } from "./commands/status.js";
import { extractCommand } from "./commands/extract.js";
import { installCommand } from "./commands/install.js";
import { updateCommand } from "./commands/update.js";
import { initCommand } from "./commands/init.js";
import { ciCommand, hasAeneasWorkflow } from "./commands/ci.js";

async function showHeader(config: AeneasConfig, root: string): Promise<void> {
  const repoDir = getAeneasRepoDir(root);
  const localInstall = fs.existsSync(repoDir);

  let shortHash = config.aeneas.commit.substring(0, 8);
  let date = "";
  let subject = "";

  if (localInstall) {
    try {
      const info = await git.commitInfo(repoDir);
      shortHash = info.shortHash;
      date = info.date;
      subject = info.subject;
      if (subject.length > 40) subject = subject.substring(0, 40) + "...";
    } catch {
      // fall back to config
    }
  }

  const source = localInstall ? ".aeneas/ (local)" : "not installed";
  const parts = [chalk.bold(`Aeneas ${shortHash}`)];
  if (date) parts.push(date);
  if (subject) parts.push(`"${subject}"`);
  parts.push(source);

  console.log(parts.join(" · "));

  // Warn if local build doesn't match config pin
  if (localInstall) {
    const mismatch = await git.warnPinMismatch(repoDir, config.aeneas.commit);
    if (mismatch) {
      console.log(chalk.yellow(`  Run 'Clone and build Aeneas' to fix`));
    }
  }

  console.log();
}

export async function showInitMenu(): Promise<void> {
  const charonPath = await which("charon");
  const aeneasPath = await which("aeneas");

  console.log(chalk.bold("Aeneas CLI") + " · no config file found\n");
  console.log(`  Charon:  ${charonPath ?? chalk.red("not found in PATH")}`);
  console.log(`  Aeneas:  ${aeneasPath ?? chalk.red("not found in PATH")}`);
  console.log();

  const action = await select({
    message: "What would you like to do?",
    choices: [
      { name: "Create aeneas-config.yml", value: "init" },
      { name: "Exit", value: "exit" },
    ],
  });

  if (action === "init") {
    await initCommand();
    console.log();
    // Config now exists — load it and show the full menu
    const { config, root } = loadConfig();
    await showMenu(config, root);
  }
}

export async function showMenu(config: AeneasConfig, root: string): Promise<void> {
  while (true) {
    await showHeader(config, root);

    const choices = [
      { name: "Extract to Lean", value: "extract" },
      { name: "Clone and build Aeneas", value: "install" },
      { name: "Select Aeneas version", value: "update" },
      { name: "Show status", value: "status" },
    ];
    if (!hasAeneasWorkflow(root)) {
      choices.push({ name: "Generate GitHub CI workflow", value: "ci" });
    }
    choices.push({ name: "Exit", value: "exit" });

    const action = await select({
      message: "What would you like to do?",
      choices,
    });

    switch (action) {
      case "extract":
        await extractCommand(config, root, { dryRun: false });
        break;
      case "install":
        await installCommand(config, root);
        break;
      case "update":
        await updateCommand(config, root);
        break;
      case "status":
        await statusCommand(config, root);
        break;
      case "ci":
        await ciCommand(root);
        break;
      case "exit":
        return;
    }

    console.log();
    console.log(
      chalk.dim("Something can be improved with this CLI? Issue/PR: https://www.npmjs.com/package/aeneas-cli"),
    );
    console.log();
  }
}
