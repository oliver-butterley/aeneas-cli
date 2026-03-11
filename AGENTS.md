# Aeneas CLI — Agent Guide

This tool, `aeneas-cli`, is a utility to help extract Rust code to Lean via the Charon/Aeneas pipeline.

## Key files

- `aeneas-config.yml` — extraction configuration (aeneas pin, charon args, tweaks)
- `.aeneas/` — local Aeneas installation (gitignored, built via `aeneas-cli install`)
- Generated Lean files go to the directory specified in `aeneas_args.dest`

## Available commands

```
aeneas-cli extract        # run charon → aeneas → tweaks
aeneas-cli extract --dry-run  # show commands without running
aeneas-cli install        # clone and build aeneas at pinned commit
aeneas-cli update         # pick new branch/commit interactively
aeneas-cli status         # show version info and config
aeneas-cli init           # create aeneas-config.yml
```

If running from this project's npm scripts: `npm run aeneas -- extract` etc.

## Configuration format

The `aeneas-config.yml` has these sections:

- `aeneas.commit` — pinned Aeneas commit hash
- `charon.start_from` — Rust module paths to extract
- `charon.exclude` — patterns to exclude (trait impls, functions)
- `aeneas_args.options` — Aeneas flags (loops-to-rec, split-files)
- `tweaks.substitutions` — ordered find/replace pairs applied to generated files

## Common tasks

### Adding a new module to extraction
Add the module path to `charon.start_from` in `aeneas-config.yml`, then run `aeneas-cli extract`.

### Excluding a problematic function/trait
Add the full path pattern to `charon.exclude`. Common exclusions:
- `{impl core::fmt::Debug for _}` — Debug impls
- `{impl core::hash::Hash for _}` — Hash impls
- `{impl core::iter::traits::accum::Sum<_> for _}` — Iterator traits
- `{impl zeroize::Zeroize for _}` — Zeroize impls

### Adding/modifying tweaks
Tweaks are literal `find`/`replace` pairs in the `substitutions` list. Order matters — earlier substitutions run first. After modifying tweaks, run `aeneas-cli extract` and check for warnings about unmatched substitutions.

### Updating Aeneas version
Run `aeneas-cli update` to pick a new commit, or manually edit `aeneas.commit` in the config and run `aeneas-cli install`.

## Troubleshooting extraction

- If Charon fails: check that `crate.dir` points to the right Rust crate and cargo args are correct
- If Aeneas fails: the LLBC may contain unsupported constructs — check `charon.exclude`
- If generated Lean doesn't compile: add tweaks to fix syntax issues, or exclude the problematic functions
- Tweak warnings (substitution not found): the Aeneas output may have changed — verify the find string still exists in the generated files
