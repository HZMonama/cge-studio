# cge-ui

Open-source local-first UI scaffolding for `claude-grc-engineering`.

## Workspace

- `apps/web`: Next.js App Router frontend with `shadcn/ui`, `@base-ui/react`, and Zustand-backed local state.
- `apps/runner`: local HTTP runner for filesystem-aware endpoints and toolkit orchestration.
- `cli/claude-grc-engineering`: upstream CLI checkout, intended to be mounted as a git submodule.
- `packages/types`: shared TypeScript contracts for runs, connectors, and framework data.
- `packages/toolkit-adapter`: starter filesystem and command helpers for the runner layer.

## Runner Form Engine

`apps/runner` now supports a composable command-form engine for building inline forms from upstream command docs plus local schema composition.

### Resolution flow

For each toolkit command, the runner resolves form metadata in this order:

1. Parse baseline fields from the upstream command markdown in `cli/claude-grc-engineering/plugins/**/commands/*.md`.
2. Apply a command-family preset from `apps/runner/forms/_presets` when one matches.
3. Compose reusable field groups from `apps/runner/forms/_groups`.
4. Apply command-specific overlays from `apps/runner/forms/**/<command>.json`.
5. Normalize the final schema and return it through `GET /registry/plugins`.

The frontend only consumes the resolved `form` object and renders it generically.

### Directory layout

Runner form metadata lives under:

- `apps/runner/forms/_groups`: reusable field groups like framework selection, output format, and common flags.
- `apps/runner/forms/_presets`: command-family presets such as connector collect flows.
- `apps/runner/forms/**`: command-specific overlays keyed by plugin and command path.

Current examples include:

- `apps/runner/forms/grc-engineer/gap-assessment.json`
- `apps/runner/forms/connectors/aws-inspector/collect.json`
- `apps/runner/forms/connectors/aws-inspector/setup.json`
- `apps/runner/forms/connectors/aws-inspector/status.json`
- `apps/runner/forms/connectors/gcp-inspector/collect.json`
- `apps/runner/forms/connectors/github-inspector/collect.json`
- `apps/runner/forms/frameworks/soc2/assess.json`
- `apps/runner/forms/frameworks/soc2/evidence-checklist.json`
- `apps/runner/forms/frameworks/cis-controls/evidence-checklist.json`

### Composition model

Command overlays can use these keys:

- `extends`: inherit a preset from `_presets`
- `compose`: include reusable groups from `_groups`
- `fields`: add command-specific fields
- `overrides`: patch fields by `name`
- `remove`: drop inherited/generated fields
- `order`: set final field ordering
- `submitLabel`: customize the primary action label

This keeps most forms small and composable rather than fully bespoke.

### Parser heuristics

The runner parser looks for sections such as:

- `## Usage`
- `## Arguments`
- `## Options`
- `**Arguments**:`
- `**Options**:`

From those sections it derives baseline fields by recognizing:

- positional arguments like `<frameworks>`
- flags like `--output=<fmt>`
- booleans like `--quiet`
- csv-style multi-value inputs like `--regions=<csv>`
- enum-like descriptions written with backticks

### Current reusable groups

The initial shared groups are:

- `framework-selection`
- `connector-selection`
- `output-format`
- `report-dir`
- `refresh-flag`
- `offline-flag`
- `quiet-flag`
- `aws-profile`
- `aws-region`
- `gcp-project`
- `github-scope`

The initial presets are:

- `connector-collect`
- `connector-setup`
- `connector-status`
- `framework-assess`
- `framework-evidence-checklist`
- `framework-map-framework`
- `framework-baseline-select`

### Runner-backed coverage

The runner-backed form engine now resolves forms for the full toolkit command catalog.

Current coverage:

- `152 / 152` commands resolve to runner-backed forms.

In practice this means every discovered toolkit command now has at least a valid inline runner form state, even if some commands resolve to rich multi-field forms while others resolve to zero-field inline execution forms.

### Fallback coverage

The web app also carries fallback plugin definitions in `apps/web/lib/plugins.ts`.

Fallback coverage mirrors the highest-value resolved runner forms so the composer can still render inline forms when runner metadata is unavailable. At the moment, fallback coverage is focused on the main examples introduced so far:

- `grc-engineer:gap-assessment`
- `aws-inspector:collect`
- `aws-inspector:setup`
- `aws-inspector:status`
- `gcp-inspector:collect`
- `github-inspector:collect`
- `soc2:assess`
- `soc2:evidence-checklist`
- `cis-controls:evidence-checklist`
- `csa-ccm:map-framework`
- `fedramp-rev5:baseline-select`
- `nist-800-53:select-baseline`

Runner-backed coverage is authoritative and complete; fallback coverage is intentionally selective and optimized for the most important offline/fallback workflows.

### Renderer support

The current inline form renderer in `apps/web` supports richer field UX for:

- `text`
- `select`
- `multiselect`
- `boolean`
- `path`
- `number`
- `secret`

It also supports empty-field command forms, which is useful for commands like connector status checks where the command should still enter inline form mode even though no additional inputs are required.

### Authoring guidance

Preferred authoring model:

1. Let the parser create a baseline form.
2. Use a preset when the command fits a common pattern.
3. Compose shared groups for common fields.
4. Add only minimal command-specific overrides.
5. Mirror high-value resolved forms into fallback plugin metadata when offline/fallback UX matters.
6. Prefer preset and group expansion over one-off overlays when multiple commands share the same interaction pattern.
7. Preserve zero-field inline forms for commands that do not require additional user input, so full runner-backed coverage remains intact.

This keeps the runner as the normalization layer and avoids duplicating command-specific UI logic in `apps/web`, while still preserving core inline-form UX in fallback mode.

## Development

```bash
pnpm install
pnpm dev
```

The web app runs on `http://localhost:3000` and the runner listens on `http://127.0.0.1:3333`.

## CLI Setup

The preferred integration mode is an embedded upstream checkout at:

```text
cli/claude-grc-engineering
```

Recommended setup:

```bash
git submodule add https://github.com/ethanolivertroy/claude-grc-engineering.git cli/claude-grc-engineering
git submodule update --init --recursive
```

`apps/runner` will use that path by default. If needed, create `apps/runner/runner.config.local.json` from `apps/runner/runner.config.json.example` to override the toolkit path locally.
