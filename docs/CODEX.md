# Codex Support

`cge-studio` exposes the embedded `cli-grc-engineering` toolkit to Codex through the FastMCP server in `apps/mcp`.

## Prerequisites

Install repo dependencies first:

```bash
pnpm install
```

The MCP server uses `stdio` by default, which is the right transport for local Codex usage.

## Codex MCP Setup

Register the local CGE MCP server with Codex:

```bash
codex mcp add cge -- pnpm --dir "/absolute/path/to/cge-studio/apps/mcp" start
```

For this checkout:

```bash
codex mcp add cge -- pnpm --dir "/home/z/Code/Maynframe Inc./cge-studio/apps/mcp" start
```

The repo also includes `AGENTS.md` so Codex has project-local guidance to prefer the `cge` MCP server for GRC and compliance workflows.

## Manual Codex MCP Config

Add this to your Codex config file, usually `~/.codex/config.toml`:

```toml
[mcp_servers.cge]
command = "pnpm"
args = ["--dir", "/absolute/path/to/cge-studio/apps/mcp", "start"]
startup_timeout_sec = 20
tool_timeout_sec = 900
```

Replace `/absolute/path/to/cge-studio` with this repo path.

For this checkout:

```toml
[mcp_servers.cge]
command = "pnpm"
args = ["--dir", "/home/z/Code/Maynframe Inc./cge-studio/apps/mcp", "start"]
startup_timeout_sec = 20
tool_timeout_sec = 900
```

## Tools

The MCP server exposes:

- `cge_list_commands`: list schema-discovered CLI commands and generated tool names.
- `cge_run_command`: run any `cli-grc-engineering` command by command name or alias.
- `cge_<plugin>_<command>`: generated tool for each schema command.
- `cge_run_status`: inspect a runner-backed run.
- `cge_run_events`: inspect runner events.
- `cge_run_respond`: respond to a paused workflow.

All tools return the CLI JSON envelope. Important exit codes:

- `0`: completed successfully.
- `3`: precondition, auth, context, or configuration problem.
- `4`: partial success, usually a workflow waiting for input. Check `data.pending_prompt`, `data.resume_command`, and `data.runner.respond_endpoint`.
- `5`: missing dependency or unavailable runtime.
- `6`: command or workflow failed.

## Typical Workflow

1. Use `cge_list_commands` to discover command and tool names.
2. Use a generated command tool or `cge_run_command` to start work.
3. If the result has `exit_code: 4`, collect answers for `data.pending_prompt.fields`.
4. Use `cge_run_respond` with `run_id`, `workspace_id`, and `answers`.
5. Use `cge_run_events` when you need the full run history.

## Optional Codex Skill

This repo includes a Codex skill template at `docs/codex-skill/cge-grc/SKILL.md`.

Install it into your Codex skills directory if you want Codex to proactively use the CGE MCP tools for GRC, compliance, audit, evidence, and framework workflows.
