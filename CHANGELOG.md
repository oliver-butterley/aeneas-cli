# Changelog

## [0.1.1] - 2026-03-12

### Added

- Generate GitHub CI workflow (`aeneas-cli ci`) with caching, diff check, and pinned CLI version
- Auto-detect crate name from `Cargo.toml` during `init`
- Default aeneas commit to latest on main (via `git ls-remote`)
- Interactive `init` when launched from menu (prompts for each field with confirmation)
- Non-interactive `init` command using sensible defaults (`aeneas-cli init`)
- Initialize Lean project menu option (placeholder)
- Feedback link in menu footer
- npm trusted publisher workflow for automated releases

### Fixed

- Show init menu when no config file exists (was crashing with "Could not find" error)
- Exit when `charon.start_from` is empty in config
- Allow empty args for all array config fields
- Stream output during install steps

### Changed

- Removed `loops-to-rec` from default config template
- Updated GitHub Actions to v6 and Node.js to 24
- CI runs on all branches, not just default

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
