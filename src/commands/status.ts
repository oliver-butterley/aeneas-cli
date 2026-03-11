import fs from "node:fs";
import chalk from "chalk";
import { type AeneasConfig } from "../config.js";
import { getAeneasRepoDir, findBinary } from "../lib/paths.js";
import { run } from "../lib/shell.js";
import * as git from "../lib/git.js";
import { VERSION } from "../version.js";

async function getLocalCommit(repoDir: string): Promise<string | null> {
  try {
    const output = await run("git", ["rev-parse", "HEAD"], {
      cwd: repoDir,
      silent: true,
    });
    return output.trim();
  } catch {
    return null;
  }
}

export async function statusCommand(
  config: AeneasConfig,
  root: string,
): Promise<void> {
  const repoDir = getAeneasRepoDir(root);
  const localInstall = fs.existsSync(repoDir);

  let info: git.CommitInfo | null = null;
  if (localInstall) {
    try {
      info = await git.commitInfo(repoDir);
    } catch {
      // repo exists but git info unavailable
    }
  }

  const charonBin = await findBinary("charon", root);
  const aeneasBin = await findBinary("aeneas", root);

  const shortHash = info?.shortHash ?? config.aeneas.commit.substring(0, 7);
  const date = info?.date ?? "not installed";
  const subject = info?.subject
    ? `"${info.subject.length > 40 ? info.subject.substring(0, 40) + "..." : info.subject}"`
    : "";
  const source = localInstall
    ? charonBin && aeneasBin
      ? ".aeneas/ (local)"
      : ".aeneas/ (not built)"
    : charonBin
      ? "PATH"
      : "not found";

  console.log(
    chalk.bold(`Aeneas ${shortHash}`) +
      ` · ${date}` +
      (subject ? ` · ${subject}` : "") +
      ` · ${source}`,
  );
  console.log();
  console.log(`  Config commit: ${config.aeneas.commit}`);
  console.log(`  Repo:          ${config.aeneas.repo}`);
  console.log(`  Charon:        ${charonBin ?? chalk.red("not found")}`);
  console.log(`  Aeneas:        ${aeneasBin ?? chalk.red("not found")}`);
  console.log(`  Backend:       ${config.aeneas_args.backend}`);
  console.log(`  Extract from:  ${config.charon.start_from.length} modules`);
  console.log(`  Excludes:      ${config.charon.exclude.length} patterns`);
  console.log(`  Tweaks:        ${config.tweaks.substitutions.length} substitutions`);

  // Check pin mismatch
  if (localInstall) {
    const localCommit = await getLocalCommit(repoDir);
    if (localCommit && !localCommit.startsWith(config.aeneas.commit)) {
      console.log(
        chalk.yellow(
          `\n  ⚠ Local build (${localCommit.substring(0, 8)}) doesn't match config pin (${config.aeneas.commit.substring(0, 8)})`,
        ),
      );
      console.log(chalk.yellow(`    Run 'aeneas-cli install' to rebuild`));
    }
  }

  console.log(chalk.dim(`\n  aeneas-cli v${VERSION}`));
}
