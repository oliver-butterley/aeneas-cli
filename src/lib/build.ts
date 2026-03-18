import fs from "node:fs";
import path from "node:path";
import { run, runStreaming, which } from "./shell.js";
import { DependencyError } from "./errors.js";

const INSTALL_HINTS: Record<string, string> = {
  git: "Install via your package manager (apt install git / brew install git)",
  opam: "See https://opam.ocaml.org/doc/Install.html",
  make: "Install via your package manager (apt install build-essential / xcode-select --install)",
  rustup: "See https://rustup.rs",
};

export async function checkDependencies(): Promise<void> {
  const deps = ["git", "opam", "make"];
  const missing: string[] = [];

  for (const dep of deps) {
    if (!(await which(dep))) {
      missing.push(dep);
    }
  }

  // Check for rustup or nix
  const hasRustup = await which("rustup");
  const hasNix = await which("nix");
  if (!hasRustup && !hasNix) {
    missing.push("rustup");
  }

  if (missing.length > 0) {
    const hints = missing
      .map((dep) => `  ${dep}: ${INSTALL_HINTS[dep] ?? "install and add to PATH"}`)
      .join("\n");
    throw new DependencyError(`Missing dependencies: ${missing.join(", ")}`, {
      hint: `Install the missing tools:\n${hints}`,
    });
  }
}

export async function getOpamEnv(switchName: string): Promise<Record<string, string>> {
  const output = await run("opam", ["env", `--switch=${switchName}`, "--set-switch"], {
    silent: true,
  });

  const env: Record<string, string> = {};
  // Parse lines like: VAR='value'; export VAR;
  for (const line of output.split("\n")) {
    const match = line.match(/^(\w+)='([^']*)'; export \1;/);
    if (match) {
      env[match[1]] = match[2];
    }
  }
  return env;
}

export async function setupOcaml(): Promise<Record<string, string>> {
  const switchName = "5.2.0";

  // Check if switch exists
  const switches = await run("opam", ["switch", "list", "--short"], {
    silent: true,
  });
  const exists = switches.split("\n").some((s) => s.trim() === switchName);

  if (!exists) {
    console.log("  Creating OCaml 5.2.0 switch...");
    await runStreaming("opam", ["switch", "create", switchName]);
  } else {
    console.log("  OCaml 5.2.0 switch already exists");
  }

  return getOpamEnv(switchName);
}

const OCAML_DEPS = [
  "ppx_deriving",
  "visitors",
  "easy_logging",
  "zarith",
  "yojson",
  "core_unix",
  "odoc",
  "ocamlgraph",
  "menhir",
  "ocamlformat",
  "unionFind",
  "domainslib",
  "progress",
];

export async function installOcamlDeps(env: Record<string, string>): Promise<void> {
  console.log("  Updating opam packages...");
  await runStreaming("opam", ["update"], { env });
  console.log("  Installing OCaml dependencies...");
  await runStreaming("opam", ["install", "-y", ...OCAML_DEPS], { env });
}

function parseToolchainChannel(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, "utf-8");
  const match = content.match(/channel\s*=\s*"?([^"\s]+)"?/);
  return match ? match[1] : null;
}

async function installRustToolchain(toolchain: string): Promise<void> {
  console.log(`  Installing Rust toolchain ${toolchain}...`);
  await runStreaming("rustup", ["toolchain", "install", toolchain]);
  console.log("  Adding rustfmt component...");
  await runStreaming("rustup", ["component", "add", "--toolchain", toolchain, "rustfmt"]);
}

export async function setupRustToolchain(charonDir: string): Promise<void> {
  const toolchain =
    parseToolchainChannel(path.join(charonDir, "charon", "rust-toolchain.toml")) ??
    parseToolchainChannel(path.join(charonDir, "charon", "rust-toolchain")) ??
    "nightly";

  await installRustToolchain(toolchain);
}

export async function buildCharon(aeneasDir: string, env: Record<string, string>): Promise<void> {
  await runStreaming("make", ["setup-charon"], { cwd: aeneasDir, env });
}

export async function buildAeneas(aeneasDir: string, env: Record<string, string>): Promise<void> {
  await runStreaming("make", [], { cwd: aeneasDir, env });
}
