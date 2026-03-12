import { Command } from "commander";
import chalk from "chalk";
import { loadConfig } from "./config.js";
import { AeneasToolError, ConfigError } from "./lib/errors.js";
import { statusCommand } from "./commands/status.js";
import { extractCommand } from "./commands/extract.js";
import { installCommand } from "./commands/install.js";
import { updateCommand } from "./commands/update.js";
import { initCommand } from "./commands/init.js";
import { ciCommand } from "./commands/ci.js";
import { showMenu, showInitMenu } from "./menu.js";
import { VERSION } from "./version.js";

const program = new Command()
  .name("aeneas-cli")
  .description("CLI tool for managing Aeneas extraction from Rust to Lean")
  .version(VERSION)
  .option("-c, --config <path>", "Path to aeneas-config.yml");

program
  .command("extract")
  .description("Run extraction pipeline (charon → aeneas → tweaks)")
  .option("--dry-run", "Print commands without executing")
  .action(async (opts) => {
    const { config, root } = loadConfig(program.opts().config);
    await extractCommand(config, root, { dryRun: opts.dryRun });
  });

program
  .command("install")
  .description("Clone and build Aeneas locally in .aeneas/ to match config pin")
  .action(async () => {
    const { config, root } = loadConfig(program.opts().config);
    await installCommand(config, root);
  });

program
  .command("update")
  .description("Interactive branch/commit picker + rebuild")
  .action(async () => {
    const { config, root } = loadConfig(program.opts().config);
    await updateCommand(config, root);
  });

program
  .command("status")
  .description("Show current Aeneas version and install info")
  .action(async () => {
    const { config, root } = loadConfig(program.opts().config);
    await statusCommand(config, root);
  });

program
  .command("init")
  .description("Create an aeneas-config.yml in the current directory")
  .action(async () => {
    await initCommand();
  });

program
  .command("ci")
  .description("Generate a GitHub Actions workflow for extraction CI")
  .action(async () => {
    const { root } = loadConfig(program.opts().config);
    await ciCommand(root);
  });

// Default action: interactive menu
program.action(async () => {
  try {
    const { config, root } = loadConfig(program.opts().config);
    await showMenu(config, root);
  } catch (err) {
    if (err instanceof ConfigError) {
      await showInitMenu();
    } else {
      throw err;
    }
  }
});

async function main(): Promise<void> {
  try {
    await program.parseAsync();
  } catch (err) {
    if (err instanceof AeneasToolError) {
      console.error(chalk.red(`\nError: ${err.message}`));
      if (err.hint) {
        console.error(chalk.yellow(`Hint: ${err.hint}`));
      }
      process.exit(1);
    }
    // Handle Ctrl+C gracefully
    if (
      err instanceof Error &&
      (err.message.includes("User force closed") || err.message.includes("ExitPromptError"))
    ) {
      console.log("\nBye!");
      process.exit(0);
    }
    throw err;
  }
}

main();
