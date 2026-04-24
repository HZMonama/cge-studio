# cge-studio — runner

The runner is a plain Node.js HTTP server (port `3333`) that acts as the bridge between the web frontend and the local filesystem / `claude-grc-engineering` toolkit. The frontend never touches the filesystem or executes CLI commands directly — all of that goes through the runner.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Web App (:3000)                   │
│              (Next.js, React, Zustand)               │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP (REST + SSE)
                       ▼
┌─────────────────────────────────────────────────────┐
│                  Runner (:3333)                      │
│                                                     │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │ server.js  │  │workflow-     │  │workspaces.js│  │
│  │ (routing & │  │runner.js     │  │(workspace   │  │
│  │  handlers) │  │(state machine│  │ lifecycle)  │  │
│  └────────────┘  └──────────────┘  └─────────────┘  │
│                                                     │
│  ┌────────────┐  ┌──────────────┐                   │
│  │form-engine │  │form-parser   │                   │
│  │(schema     │  │(markdown →   │                   │
│  │composition)│  │ field schema)│                   │
│  └────────────┘  └──────────────┘                   │
└──────────────────────┬──────────────────────────────┘
                       │ child_process / fs
                       ▼
┌─────────────────────────────────────────────────────┐
│        claude-grc-engineering toolkit (CLI)          │
│       cli/claude-grc-engineering/  (submodule)       │
└─────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│                 Workspace on disk                    │
│     .cge/  (findings, program, artifacts, runs)      │
└─────────────────────────────────────────────────────┘
```

## Source files

### `src/server.js`

The HTTP server entry point. Handles all routing and request dispatch.

Responsibilities:
- Parse and route all incoming HTTP requests (no framework — plain `node:http`)
- Workspace CRUD endpoints (`/workspaces/*`)
- Run lifecycle endpoints (`/workspaces/:id/runs`, `/runs/:id/respond`)
- Artifact, findings, and program data endpoints
- Plugin/toolkit discovery (`/registry/plugins`) — resolves forms via the form engine
- Configuration management (`/config`) — reads/writes `runner.config.local.json` and Claude Code settings
- Health and diagnostic endpoints (`/health`)
- SSE (Server-Sent Events) streaming for active run output

### `src/workflow-runner.js`

Defines the built-in workflow types and drives their state machines.

Each workflow has two handlers:
- **`start(context)`** — validates preconditions (e.g. findings must exist), emits the initial prompt or executes immediately
- **`respond(context, input)`** — processes user answers, renders output artifacts, writes files to the workspace

Workflow types:

| Workflow ID | What it does |
|-------------|-------------|
| `/pipeline:evidence-to-gap` | Collect findings → run gap assessment |
| `/pipeline:iac-compliance` | Scan IaC configs → optimize frameworks |
| `/pipeline:multi-cloud-collect` | Parallel collection across AWS, GCP, GitHub, Okta |
| `/grc-reporter:exec-summary` | Interactive weekly executive brief |
| `/grc-reporter:board-brief` | Quarterly board-level report |
| `/grc-reporter:automation-coverage` | Control automation metrics snapshot |
| `/grc-reporter:program-health` | Program posture snapshot |

State transitions: `pending` → `awaiting_input` → `completed` / `failed`

Run state is persisted under `.cge/runner/runs/<run-id>/` in the workspace directory.

### `src/workspaces.js`

Workspace lifecycle management.

- Registry stored at `~/.local/share/cge-ui/workspaces/registry/` (one JSON per workspace)
- Creates the full `.cge/` directory tree on workspace creation
- Functions: `createWorkspace`, `listWorkspaces`, `getWorkspace`, `renameWorkspace`, `deleteWorkspace`, `refreshWorkspace`

Directory tree created per workspace:

```
.cge/
├── workspace.json
├── state/
│   ├── index.sqlite
│   └── locks/
├── findings/
│   ├── raw/
│   │   ├── aws-inspector/
│   │   ├── gcp-inspector/
│   │   ├── github-inspector/
│   │   └── okta-inspector/
│   ├── normalized/
│   └── indexes/
├── program/
│   ├── risks/
│   ├── controls/
│   ├── evidence/
│   ├── exceptions/
│   ├── tasks/
│   └── notes/
├── artifacts/
│   ├── generated/
│   ├── exports/
│   └── bundles/
├── dashboards/
│   ├── layouts/
│   ├── widgets/
│   ├── saved-views/
│   └── snapshots/
└── runner/
    └── runs/
```

### `src/form-engine.js`

Composes command form schemas from multiple layers:

1. **Parser baseline** — `form-parser.js` extracts fields from the command's upstream Markdown doc
2. **Preset** — `forms/_presets/<preset>.json` applies a command-family template
3. **Groups** — `forms/_groups/<group>.json` injects reusable field blocks
4. **Overlay** — `forms/<plugin>/<command>.json` applies command-specific patches
5. **Normalize** — enforces field shape, deduplicates, applies ordering

### `src/form-parser.js`

Reads upstream Markdown command docs and extracts field definitions by pattern-matching:
- Positional args like `<frameworks>`
- Flags like `--output=<fmt>`
- Booleans like `--quiet`
- CSV multi-value inputs like `--regions=<csv>`
- Enum-like descriptions with backtick literals

## Form authoring

Form overlays live under `forms/`:

```
forms/
├── _groups/        # reusable field groups (framework-selection, output-format, …)
├── _presets/       # command-family presets (connector-collect, framework-assess, …)
└── <plugin>/       # command-specific overlays keyed by plugin slug
```

See [`FORMS.md`](FORMS.md) for the full composition model and authoring guidance.

## Configuration

The runner looks for its config in this order:

1. `runner.config.local.json` (local override, not committed)
2. `runner.config.json.example` (defaults)

The only required field is `toolkitPath` — the path to the `claude-grc-engineering` checkout, relative to `apps/runner/`.

Default: `../../cli/claude-grc-engineering`

## Running

```bash
# from repo root
pnpm dev:runner        # with --watch (auto-restarts on file changes)

# or from this directory
pnpm dev               # same
pnpm start             # without --watch
pnpm smoke             # smoke test via scripts/runner-smoke.mjs
```

## API surface

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Runner status, toolkit availability |
| GET | `/config` | Current runner config |
| PATCH | `/config` | Update runner config |
| GET | `/registry/plugins` | All toolkit commands with resolved forms |
| POST | `/workspaces` | Create workspace |
| GET | `/workspaces` | List workspaces |
| GET | `/workspaces/:id` | Get workspace details |
| PATCH | `/workspaces/:id` | Rename workspace |
| DELETE | `/workspaces/:id` | Delete workspace |
| POST | `/workspaces/:id/runs` | Start a command run or workflow |
| GET | `/workspaces/:id/runs` | List runs |
| GET | `/workspaces/:id/runs/:runId` | Get run state + events |
| POST | `/workspaces/:id/runs/:runId/respond` | Submit workflow input |
| GET | `/workspaces/:id/artifacts` | List artifacts |
| GET | `/workspaces/:id/findings` | List findings |
| GET | `/workspaces/:id/program` | Program posture data |
