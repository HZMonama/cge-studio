import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const embeddedCliRoot = path.join(process.cwd(), "cli", "cli-grc-engineering");
const embeddedCliManifestPath = path.join(embeddedCliRoot, "package.json");

if (process.env.CGE_SKIP_EMBEDDED_CLI_INSTALL === "1") {
  process.exit(0);
}

if (!existsSync(embeddedCliManifestPath)) {
  process.stdout.write("[postinstall] embedded cli-grc-engineering checkout not found, skipping CLI dependency install\n");
  process.exit(0);
}

const child = spawn(
  "pnpm",
  ["--dir", embeddedCliRoot, "install", "--frozen-lockfile=false"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      CGE_SKIP_EMBEDDED_CLI_INSTALL: "1",
    },
  },
);

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
