# Upstream CLI Metadata Recommendation

## Context

Studio currently surfaces every CLI command from `cli/claude-grc-engineering/plugins/**/commands/*.md`.
The command docs do not currently provide authoritative result-type metadata in frontmatter, so Studio has to infer UI hint tags from command ids.

Those tags are now treated as UI hints only. They should not be interpreted as part of the execution contract.

## Recommendation

Add an explicit frontmatter field to each command doc for result classification.

Recommended field names:

- `ui_hint`
- or `result_hint`

Recommended allowed values:

- `analysis`
- `assessment`
- `checklist`
- `mapping`
- `plan`
- `policy`
- `config`
- `status`
- `code`
- `score`
- `report`
- `document`

## Why

- Removes guesswork from Studio and other downstream UIs
- Keeps command labeling stable even when command ids are renamed
- Makes planned and ready commands use the same authoritative metadata
- Avoids overloading execution/runtime metadata with presentation hints

## Example

```md
---
description: Generate a SOC 2 evidence checklist for the selected scope.
ui_hint: checklist
---
```

or

```md
---
description: Build an executive summary from recent program activity.
result_hint: report
---
```

## Compatibility

Studio can safely consume either `ui_hint` or `result_hint`.
If neither field is present, Studio will continue to fall back to local heuristics.

## Non-Goals

- This does not change command arguments
- This does not change execution mode
- This does not change script vs workflow vs agent routing
- This should not be treated as authoritative artifact typing for automation pipelines

