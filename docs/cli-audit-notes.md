# CLI Audit Notes

Runner forms in `apps/runner/forms` should follow the upstream CLI as it exists today.
This file records upstream inconsistencies found during the runner parity audit so they can
be proposed upstream later without changing `/cli` in this repo now.

Audit rule used:

- When a command has an implementation under `cli/claude-grc-engineering/plugins/**/scripts/`,
  runner forms should follow the script's real accepted arguments.
- When a command is docs-only, runner forms should follow the documented command contract.

## Connectors

### `github-inspector:collect`

- `commands/collect.md` does not document `--include-archived` or `--include-forks`.
- `scripts/collect.js` parses both flags and uses them during repo enumeration.

### `okta-inspector:collect`

- `commands/collect.md` documents `logs` as a supported `--services` value.
- `scripts/collect.js` only implements `policies`, `users`, and `factors`.
- `scripts/collect.js` parses `--include-deactivated`, but the current collection flow does
  not appear to use that flag when generating findings.

### `aws-inspector:collect`

- `scripts/collect.js` accepts `--refresh`, but the parser comments mark it as a placeholder
  and the current implementation always refreshes anyway.

### `gcp-inspector:collect`

- `scripts/collect.js` accepts `--refresh`, but the parser treats it as a placeholder/no-op.

## `grc-engineer`

### `gap-assessment`

- `commands/gap-assessment.md` says `--refresh` delegates to each `/<tool>:collect`.
- `scripts/gap-assessment.js` says `--refresh` only emits guidance and does not re-run
  connector collection.

### `test-control`

- `commands/test-control.md` says the optional provider defaults to `auto-detect`.
- `scripts/test-control.js` defaults the provider to `aws`.

### `scan-iac`

- `commands/scan-iac.md` documents `--exclude=test/` as an option.
- `scripts/scan-iac.js` only parses `--fix` and `--severity=...`.

### `record-automation-metrics`

- `scripts/record-automation-metrics.js` supports additional flags that are not documented in
  `commands/record-automation-metrics.md`:
  - `--subject-kind=<kind>`
  - `--subject-id=<id>`
  - `--from-fedramp-baseline=<low|moderate|high|20x|20x-ksi>`

### `generate-implementation`

- `commands/generate-implementation.md` exists.
- No matching implementation file was found under
  `cli/claude-grc-engineering/plugins/grc-engineer/scripts/`.

### `monitor-continuous`

- `commands/monitor-continuous.md` exists.
- No matching implementation file was found under
  `cli/claude-grc-engineering/plugins/grc-engineer/scripts/`.

## Notes

- These are upstream documentation and implementation mismatches only.
- Runner changes should continue to follow the real CLI surface and should not patch `/cli`
  locally unless explicitly requested in a separate task.
