# Changelog

## [0.1.1] - 2026-03-18

### Added

- Regex support in tweaks: use `regex` key instead of `find` for pattern matching
- Generate GitHub CI workflows (`aeneas.yml` and `lean.yml`)
- `lean-init`: creates lakefile, toolchain, CI, main Lean file, project README, and `.gitignore` entries
- Auto-detect crate name from `Cargo.toml` during `init`
- Interactive and non-interactive `init` modes

### Fixed

- Corrected `lakefile.toml` template (top-level keys, `subDir`, `[leanOptions]`)
- Show init menu when no config file exists
- Extraction directory default reads from config

## [0.1.0] - 2026-03-08

### Added

- Initial release
- Interactive menu for managing Aeneas extraction
- `extract` command: run charon + aeneas + tweaks pipeline
- `install` command: clone and build Aeneas locally
- `update` command: interactive branch/commit picker
- `status` command: show current Aeneas version info
- `init` command: scaffold `aeneas-config.yml`
- Lean toolchain sync after extraction
- Pin mismatch warnings
