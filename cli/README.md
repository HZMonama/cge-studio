# CLI Integration

`cge-studio` expects the embedded `cli-grc-engineering` repository to live at:

```text
cli/cli-grc-engineering
```

Recommended setup:

```bash
git submodule add https://github.com/HZMonama/cli-grc-engineering.git cli/cli-grc-engineering
git submodule update --init --recursive
```

Runner behavior:

- `apps/runner` will use `cli/cli-grc-engineering` by default.
- `apps/runner/runner.config.local.json` can override that path per machine.
- `CGE_TOOLKIT_PATH` overrides both.
- The toolkit package can be published independently from Studio as `cli-grc-engineering`.

Recommended sync flow:

```bash
git submodule update --remote --merge cli/cli-grc-engineering
```

Treat the embedded CLI as upstream code. Keep Studio integration changes in `apps/runner` and `apps/web`, and only change the CLI checkout intentionally.
