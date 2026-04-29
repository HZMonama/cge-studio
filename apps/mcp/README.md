# CGE MCP Server

FastMCP wrapper for `cli-grc-engineering`.

## Run

```bash
pnpm --dir apps/mcp start
```

The default transport is `stdio`, which is the right mode for Codex and other local MCP clients.

For HTTP stream mode:

```bash
CGE_MCP_TRANSPORT=httpStream CGE_MCP_PORT=8787 pnpm --dir apps/mcp start
```

## Tools

- `cge_list_commands`: list schema-discovered commands and generated MCP tool names.
- `cge_run_command`: run any CLI command by name or alias.
- `cge_<plugin>_<command>`: generated tool for each schema command.
- `cge_run_status`: inspect a runner-backed run.
- `cge_run_events`: inspect runner events.
- `cge_run_respond`: respond to a paused workflow.

Tool responses return the CLI JSON envelope. `exit_code: 4` means a runner-backed workflow is awaiting input and includes `pending_prompt`, `respond_endpoint`, and `resume_command`.
