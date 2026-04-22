# Runner Form Engine

This document describes the composable form-engine architecture used by `apps/runner` to expose command forms to the Studio frontend.

## Goals

The runner form engine exists to make command forms scalable.

Instead of hand-authoring a fully custom form for every command in the toolkit, the runner resolves forms from a combination of:

1. command markdown parsing
2. shared reusable field groups
3. shared command-family presets
4. command-specific overlays

This lets the web app stay simple: it only renders the final resolved schema returned by the runner.

The runner now guarantees full command coverage. Every command resolves to an inline form schema, even if the command does not expose any structured inputs. In those cases, the resolved form contains zero editable fields and serves as a valid inline command state for preview-and-run workflows.

## Design principles

### 1. The runner is the schema assembly layer

The upstream toolkit in `cli/claude-grc-engineering` remains the source of truth for commands and documentation.

The runner is responsible for:

- discovering commands
- parsing markdown docs
- inferring baseline fields
- applying shared presets and groups
- applying per-command overrides
- returning a normalized resolved schema

The frontend should not parse markdown or know how composition works.

### 2. Forms should be composable

Most commands are variations of a few common patterns:

- connector setup
- connector collect
- framework assess
- report generation
- file conversion
- scope selection

Rather than duplicating form definitions across many commands, the form engine encourages reuse through:

- `_groups`: reusable field bundles
- `_presets`: reusable command-family defaults
- overlays: small command-specific deltas

### 3. Baseline coverage first, curation second

Every command should ideally be able to produce at least a rough form from markdown alone.

Composition layers then improve quality incrementally for high-value commands.

## Directory layout

Runner form definitions live under:

`apps/runner/forms`

### Shared groups

`apps/runner/forms/_groups`

Reusable field bundles. These are intended to be composed into many commands.

Examples:

- `framework-selection.json`
- `connector-selection.json`
- `output-format.json`
- `report-dir.json`
- `refresh-flag.json`
- `offline-flag.json`
- `quiet-flag.json`
- `aws-profile.json`
- `aws-region.json`
- `gcp-project.json`
- `github-scope.json`

### Shared presets

`apps/runner/forms/_presets`

Reusable command-family presets.

Examples:

- `connector-collect.json`
- `connector-setup.json`
- `connector-status.json`
- `framework-assess.json`
- `framework-evidence-checklist.json`

Presets can:

- set `mode`
- compose shared groups
- define common fields
- define field overrides

### Command overlays

Command-specific overlays live in plugin-specific folders.

Examples:

- `apps/runner/forms/grc-engineer/gap-assessment.json`
- `apps/runner/forms/connectors/aws-inspector/collect.json`
- `apps/runner/forms/connectors/aws-inspector/setup.json`
- `apps/runner/forms/connectors/gcp-inspector/collect.json`
- `apps/runner/forms/connectors/github-inspector/collect.json`
- `apps/runner/forms/frameworks/soc2/assess.json`

These are typically the smallest layer and should only describe what is unique to a command.

## Resolution flow

The runner resolves a command form in the following order.

### Step 1: parse markdown baseline

The engine parses the command markdown from the toolkit and derives a baseline schema from sections such as:

- `## Usage`
- `## Arguments`
- `## Options`
- `**Arguments**:`
- `**Options**:`

From these sections it attempts to infer:

- positional arguments
- flags
- required vs optional values
- booleans
- text inputs
- select inputs
- multiselect inputs
- path inputs
- enum values where obvious

This baseline should be good enough to give rough form coverage even without any overlay files.

### Step 2: apply preset

If the command matches a known command-family preset, that preset is applied next.

Examples of current or intended matching logic:

- connector `collect` commands -> `connector-collect`
- connector `setup` commands -> future `connector-setup`
- framework `assess` commands -> future `framework-assess`

### Step 3: apply composed groups

Both presets and command overlays can `compose` shared field groups.

This is how common fields are reused without copying them across many command files.

### Step 4: apply command overlay

If a command-specific overlay exists, it is applied last.

This layer is used for:

- command-specific labels
- custom option lists
- field ordering
- removing irrelevant inherited fields
- submit label customization

### Step 5: normalize result

The final schema is normalized so the frontend always receives a consistent shape.

Normalization includes:

- filling missing labels from field names
- assigning a default mode
- deduplicating fields by name
- removing explicitly deleted fields
- cleaning invalid or empty values

### Step 6: always return a form

If a command produces parsed fields, those fields are returned.

If a command does not produce parsed fields and has no additional composed fields, the runner still returns a valid inline schema with:

- `mode: "inline"`
- the command path
- a submit label
- an empty `fields` array

This ensures that the frontend can always enter inline command mode for any command, even when there is nothing to configure.

## Merge precedence

The engine uses this precedence order, from lowest to highest:

1. markdown baseline
2. preset
3. composed groups
4. command overlay

For overlapping fields, merges are keyed by field `name`.

If the same field appears in multiple layers, later layers override earlier ones.

## Overlay format

A command overlay can use the following shape.

### Top-level properties

- `mode`
- `extends`
- `compose`
- `fields`
- `overrides`
- `remove`
- `order`
- `submitLabel`

### Property meanings

#### `mode`

Current supported mode:

- `inline`

#### `extends`

Optional preset name to inherit from.

Example:

- `connector-collect`

#### `compose`

Array of shared group names to merge into the command.

Example:

- `framework-selection`
- `output-format`
- `quiet-flag`

#### `fields`

Additional fields declared directly by the command overlay.

Use this when a command needs fields that do not come from the parser, preset, or groups.

#### `overrides`

Object keyed by field name.

This is used to patch properties on previously defined fields.

Examples:

- change a label
- change default values
- replace enum options
- refine descriptions

#### `remove`

Array of field names to remove from the merged schema.

#### `order`

Array of field names expressing preferred display order.

Fields not listed here will be appended after the ordered ones.

#### `submitLabel`

Optional button label for the resolved form.

## Field schema

The frontend expects the resolved form to use the same normalized field model for every command.

### Common field properties

- `name`
- `label`
- `type`
- `required`
- `position`
- `flag`
- `description`
- `placeholder`
- `defaultValue`
- `options`

### Supported field types

Current field types used by the runner/frontend contract:

- `text`
- `select`
- `multiselect`
- `boolean`
- `path`

The shared type package also anticipates future expansion to types like:

- `textarea`
- `number`
- `secret`

## Parser heuristics

The markdown parser is intentionally heuristic-based rather than fully formal.

Its job is to produce a useful baseline, not a perfect semantic model.

### Positional arguments

The parser detects required positional arguments from patterns like:

- `<frameworks>`
- `<path>`
- `<scope>`

These are converted into fields with:

- `position: "argument"`

### Boolean flags

Patterns like:

- `--quiet`
- `--offline`
- `--refresh`

are interpreted as booleans.

### Value flags

Patterns like:

- `--output=<fmt>`
- `--profile=<name>`
- `--report-dir=<path>`
- `--regions=<csv>`

are interpreted using name and placeholder heuristics.

### Type inference by name

Examples:

- names containing `output` -> likely `select`
- names containing `dir` or `path` -> likely `path`
- names containing `regions`, `sources`, `services`, `frameworks` -> likely `multiselect`
- names like `quiet`, `offline`, `refresh` -> likely `boolean`

### Enum inference

The parser looks for inline backtick values in descriptions.

Examples:

- ``markdown`, `json`, `sarif``
- ``silent` | `summary` | `json``

If enough enum-like values are found, the field becomes a `select`.

## Shared groups

Shared groups are intended to capture common command inputs that appear across many commands.

### Current groups

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

### Why groups matter

Without groups, commands like `gap-assessment` and future framework/reporting workflows would repeatedly redefine the same fields.

With groups, commands only specify what is unique.

## Presets

Presets exist to reduce effort across families of commands.

### Current presets

- `connector-collect`
- `connector-setup`
- `connector-status`
- `framework-assess`
- `framework-evidence-checklist`
- `framework-map-framework`
- `framework-baseline-select`

`connector-collect` currently composes:

- `output-format`
- `quiet-flag`
- `refresh-flag`

and then overrides labels and defaults appropriate for connector collection workflows.

`connector-setup` is currently a lightweight preset that establishes a common inline setup flow and submit label for connector setup commands.

`connector-status` is intended for non-destructive health and readiness checks. It currently provides a common inline status flow with no required inputs and a shared submit label for connector status commands.

`framework-assess` currently composes:

- `output-format`
- `report-dir`
- `quiet-flag`

and then overrides labels and defaults appropriate for assessment workflows.

`framework-evidence-checklist` is intended for evidence-planning and export workflows. It should be used for commands that collect or generate control evidence requirements, and typically composes output/export-style fields plus any framework-specific scope selectors.

`framework-map-framework` is intended for framework crosswalk and translation workflows. It should be used for commands that take a source control or framework identifier and a target framework, then generate mapped output or comparison guidance.

`framework-baseline-select` is intended for baseline and tailoring workflows. It should be used for commands that help pick an impact level, baseline, or system type before generating downstream implementation guidance.

### Planned future presets

Good next candidates include:

- `connector-status` expansion with shared status-specific metadata
- `framework-evidence-checklist` expansion with reusable evidence/export groups
- `framework-map-framework` expansion with reusable source/target framework selectors
- `framework-baseline-select` expansion with reusable impact-level and system-type selectors

## Current implemented examples

### `grc-engineer:gap-assessment`

This command uses a composed overlay that reuses shared groups for:

- framework selection
- connector selection
- output format
- report directory
- refresh
- offline
- quiet

It then overrides labels, descriptions, order, and submit label.

### `aws-inspector:collect`

This command uses the `connector-collect` preset and adds command-specific fields for:

- `regions`
- `services`
- `profile`

It also overrides output/refresh/quiet behavior for AWS collection semantics.

### `aws-inspector:setup`

This command uses the `connector-setup` preset and composes shared groups for:

- `aws-profile`
- `aws-region`

It then overrides labels and descriptions for connector configuration semantics.

### `gcp-inspector:collect`

This command uses the `connector-collect` preset and adds command-specific fields for:

- `project`
- `services`

It also overrides output/refresh/quiet behavior for GCP collection semantics.

### `github-inspector:collect`

This command uses the `connector-collect` preset and adds command-specific fields for:

- `scope`
- `limit`
- `concurrency`

It also overrides output/refresh/quiet behavior for GitHub collection semantics.

### `aws-inspector:status`

This command is a good fit for the `connector-status` preset because it is a non-destructive readiness check and does not require user input. It demonstrates how the preset family can give status-style commands a consistent inline form mode even when the resolved schema contains no editable fields.

### `soc2:assess`

This command uses the `framework-assess` preset and adds command-specific positional fields for:

- `assessmentScope`
- `auditType`

It also overrides output/report directory/quiet behavior for SOC 2 assessment semantics.

### `cis-controls:evidence-checklist`

This command is a good fit for the `framework-evidence-checklist` preset because it combines a framework-specific selector with export-oriented output. It is expected to layer a reusable evidence/export flow underneath CIS-specific safeguard selection.

### `soc2:evidence-checklist`

This command is also a good fit for the `framework-evidence-checklist` preset because it combines control/category selection with audit-type-aware evidence planning. It is expected to share most of its output semantics with other framework evidence workflows while keeping framework-specific scope fields in the overlay.

### `csa-ccm:map-framework`

This command is a good fit for the `framework-map-framework` preset because it combines a source control identifier with a destination framework selector. It is expected to share most of its UX with other framework crosswalk commands while keeping framework-specific mapping hints in the overlay.

### `fedramp-rev5:baseline-select`

This command is a good fit for the `framework-baseline-select` preset because it primarily guides the user through impact-level and system-type selection before generating tailored baseline guidance.

### `nist-800-53:select-baseline`

This command is also a good fit for the `framework-baseline-select` preset because it shares the same baseline-selection structure as other federal framework tailoring commands, even when the system-type options differ.

## Frontend contract

The frontend should treat `form` as already resolved.

That means the frontend should:

- render the form
- manage values
- show a command preview
- serialize prompt input
- submit runs
- render field types consistently across runner-resolved and fallback schemas
- support zero-field forms as valid inline command states

The frontend should not:

- parse markdown
- understand presets
- understand group composition
- inspect overlay files directly

All of that remains runner-side.

### Frontend renderer expectations

The current web renderer should be able to support at least these field types cleanly:

- `text`
- `select`
- `multiselect`
- `boolean`
- `path`
- `number`
- `secret`

A few UX rules matter for consistency:

- `path` fields should read like filesystem inputs and are good candidates for monospace text styling.
- `number` fields should render as numeric inputs rather than generic text inputs.
- `secret` fields should render as masked inputs, with optional reveal/hide controls if the UX needs them.
- zero-field forms, such as simple status-style commands or commands with no structured inputs, should still render as valid inline command states rather than collapsing back to raw prompt mode.
- the composer remains the primary preview surface once a command is selected; the form body should focus on configuration fields and supporting guidance.
- a zero-field form should be treated as a successful runner-backed form resolution, not as a parser miss.

The runner should keep returning a normalized schema, and the frontend should keep rendering it generically, but the renderer is expected to get richer over time as more field types and command families are introduced.

## Why this architecture reduces effort

This design minimizes manual work because it allows commands to be defined by composition instead of duplication.

### Best case

A new command can be form-capable with no Studio-specific work because the parser plus preset produces a good enough baseline.

### Common case

A tiny overlay composes shared groups and tweaks a few labels or options.

### Rare case

A fully curated overlay is needed for a highly custom workflow.

### Guaranteed case

Even if a command has no structured fields, the runner still emits a zero-field inline schema so the command remains runner-backed and the UI can keep a consistent preview-and-run interaction.

That means the cost of supporting more commands does not grow linearly, and full runner-backed form coverage can be maintained without requiring every command to expose bespoke inputs.

## Recommended expansion path

To scale this system across the whole toolkit, the next best steps are:

1. add more shared groups
2. add more command-family presets
3. expand parser heuristics
4. add overlays only for high-value or unusual commands

### Highest-value next groups

- AWS regions
- input file / output file
- input directory / output directory
- framework baseline selection
- control identifier
- domain selector
- audit type selector
- evidence export format
- source framework selector
- target framework selector
- impact level selector
- system type selector

### Highest-value next presets

- connector-status expansion
- framework-evidence-checklist expansion
- framework-map-framework expansion
- framework-baseline-select expansion

## Notes for maintainers

### Prefer composition over duplication

If a new form file repeats fields that already exist in `_groups`, extract or reuse the group instead of copying the field definitions.

### Keep overlays small

The ideal overlay should be mostly:

- `extends`
- `compose`
- `overrides`
- `order`

Large `fields` arrays are a sign that a reusable group or preset may be missing.

### Treat markdown parsing as a fallback, not the final UX

Parser-derived forms are useful for coverage, but shared groups and presets are what produce polished, predictable UX.

## Summary

The runner form engine is designed so that all commands can eventually become form-backed with manageable effort.

It does this by combining:

- markdown-derived baseline schemas
- reusable groups
- reusable presets
- small command overlays

This keeps the frontend generic, the runner authoritative, and the total maintenance cost low as the command catalog grows.

## Full coverage behavior

The runner form engine is now designed to provide full command coverage across the toolkit.

### What “full runner-backed form coverage” means

A command is considered runner-backed if the runner returns a resolved `form` object for it through plugin registry discovery.

That includes two cases:

1. **Structured form commands**
   - commands with one or more editable fields derived from parsing, presets, groups, or overlays

2. **Zero-field inline commands**
   - commands that do not require any additional user input but should still enter inline command mode in the frontend

### Why zero-field forms matter

Without zero-field forms, commands with no parseable or modeled inputs would fall out of the form system entirely and force the UI back into an inconsistent raw-prompt-only path.

With zero-field forms, every command still gets:

- a stable resolved schema
- a predictable inline preview mode
- a consistent run action
- a shared frontend rendering contract

### Practical effect

Full coverage does **not** mean every command has a rich curated form.

Instead, it means every command has at least one of:

- a parsed baseline form
- a preset/group/overlay-enhanced form
- a zero-field inline form

This keeps the system scalable while still allowing the highest-value commands to receive more polished field models over time.