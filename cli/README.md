# CLI Integration

`cge-studio` expects the upstream `claude-grc-engineering` repository to live at:

```text
cli/claude-grc-engineering
```

Recommended setup:

```bash
git submodule add https://github.com/ethanolivertroy/claude-grc-engineering.git cli/claude-grc-engineering
git submodule update --init --recursive
```

Runner behavior:

- `apps/runner` will use `cli/claude-grc-engineering` by default.
- `apps/runner/runner.config.local.json` can override that path per machine.
- `CGE_TOOLKIT_PATH` overrides both.

Recommended sync flow:

```bash
git submodule update --remote --merge cli/claude-grc-engineering
```

Treat the embedded CLI as upstream code. Keep Studio integration changes in `apps/runner` and `apps/web`, and only change the CLI checkout intentionally.
