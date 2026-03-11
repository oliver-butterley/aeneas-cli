# aeneas-cli

CLI tool for managing [Aeneas](https://github.com/AeneasVerif/aeneas) extraction from Rust to Lean. Handles the full pipeline: Charon (Rust → LLBC) → Aeneas (LLBC → Lean) → post-extraction tweaks.

## Prerequisites

- **Node.js** >= 20
- **opam** (OCaml package manager) — [install](https://opam.ocaml.org/doc/Install.html)
- **rustup** — [install](https://rustup.rs)
- **make** and **git**

## Quick start

```bash
# Initialize a config file in your project
npx aeneas-cli init

# Clone and build Aeneas at the pinned commit
npx aeneas-cli install

# Run the extraction pipeline
npx aeneas-cli extract
```

Or use the interactive menu:

```bash
npx aeneas-cli
```

## Commands

| Command | Description |
|---------|-------------|
| `aeneas-cli` | Interactive menu (default) |
| `aeneas-cli init` | Create `aeneas-config.yml` in current directory |
| `aeneas-cli extract` | Run Charon → Aeneas → tweaks pipeline |
| `aeneas-cli extract --dry-run` | Show commands without executing |
| `aeneas-cli install` | Clone and build Aeneas locally in `.aeneas/` |
| `aeneas-cli update` | Pick a new branch/commit, update config, rebuild |
| `aeneas-cli status` | Show version info, check config pin matches local build |

All commands accept `-c, --config <path>` to specify a custom config file.

## Configuration

The tool reads `aeneas-config.yml` from your project root (walks up from cwd to find it).

```yaml
aeneas:
  commit: "61db7984cbda8e..."   # pinned commit hash
  repo: "https://github.com/AeneasVerif/aeneas.git"

crate:
  dir: "my-crate"               # path to the Rust crate
  name: "my_crate"              # crate name as in Cargo.toml

charon:
  preset: aeneas
  cargo_args: ["--no-default-features", "--features", "alloc"]
  start_from:                   # modules to extract
    - "my_crate::module_a"
    - "my_crate::module_b"
  exclude:                      # patterns to exclude
    - "my_crate::{impl core::fmt::Debug for _}"
  opaque: []                    # opaque declarations

aeneas_args:
  options:
    - loops-to-rec
    - split-files
  dest: "LeanOutput"            # output directory for generated files

tweaks:
  files: ["Funs.lean", "Types.lean"]
  substitutions:
    - find: "text to find"
      replace: "replacement text"
```

### Post-extraction tweaks

Tweaks are literal find/replace substitutions applied to the generated Lean files after Aeneas runs. They are applied **in order** — this matters when one substitution must run before another (e.g., fixing a specific comment before a global comment conversion).

The tool warns if any substitution doesn't match in any of the configured files.

## How it works

1. **Charon** translates your Rust crate into LLBC (Low-Level Borrow Calculus) format
2. **Aeneas** translates the LLBC into Lean 4 code
3. **Tweaks** apply post-extraction fixes to the generated files
4. **Lean toolchain** is synced from the Aeneas repo if it differs

## Install methods

### Local build (recommended)

`aeneas-cli install` clones the Aeneas repo at the pinned commit into `.aeneas/` and builds both Charon and Aeneas. The tool checks if your local build matches the config pin and skips rebuilding if already up to date.

### Global installation

If you have `charon` and `aeneas` on your PATH (installed globally or via another method), the tool will find and use them automatically. No need to run `aeneas-cli install` in that case.

## Updating Aeneas

`aeneas-cli update` lets you interactively pick a branch and commit from the Aeneas repo, then updates:
- `aeneas-config.yml` with the new commit hash
- `lakefile.toml` rev (if it contains an Aeneas dependency)

It then optionally rebuilds.

## Troubleshooting

### Missing dependencies

Run `aeneas-cli install` — it checks for required tools and shows install instructions for anything missing.

### Extraction errors

- **Functions not found**: Check your `start_from` paths match the actual Rust module structure
- **Type errors in generated code**: You may need to add `exclude` patterns for problematic trait impls (Debug, Hash, Iterator-based traits are common culprits)
- **Tweaks not matching**: Run extraction and check the warnings — stale tweaks that no longer match should be removed from config

## License

Apache-2.0
