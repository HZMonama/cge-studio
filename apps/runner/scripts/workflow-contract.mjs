import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const cliBin = path.join(repoRoot, "cli", "cli-grc-engineering", "bin", "cli-grc-engineering.js");
const runnerServer = path.join(repoRoot, "apps", "runner", "src", "server.js");
const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cge-runner-contract-"));
const toolkitRoot = path.join(tempRoot, "toolkit");
const workspaceRoot = path.join(tempRoot, "workspace");
const port = String(4300 + Math.floor(Math.random() * 1000));
const runnerUrl = `http://127.0.0.1:${port}`;

await fs.mkdir(workspaceRoot, { recursive: true });
await createFakeToolkit(toolkitRoot);

const runner = spawn(process.execPath, [runnerServer], {
  cwd: repoRoot,
  env: {
    ...process.env,
    CGE_APP_DATA_ROOT: path.join(tempRoot, "app-data"),
    CGE_CACHE_ROOT: path.join(tempRoot, "cache"),
    CGE_CONFIG_ROOT: path.join(tempRoot, "config"),
    CGE_RUNNER_PORT: port,
    CGE_TOOLKIT_PATH: toolkitRoot,
    CGE_WORKSPACE_ROOT: path.join(tempRoot, "workspaces"),
  },
  stdio: ["ignore", "pipe", "pipe"],
});

try {
  await waitForHealth(runnerUrl);

  const started = await runCli(["pipeline:new-framework-onboard", "--json"]);
  assertEqual(started.exitCode, 4, "workflow start should pause for input");
  assert(started.json.data?.pending_prompt, "workflow start should return pending_prompt");
  const runId = started.json.data.run.id;
  const workspaceId = started.json.data.runner.workspace_id;

  const responded = await runCli([
    "run-respond",
    runId,
    `--workspace-id=${workspaceId}`,
    "--answers-json",
    JSON.stringify({ framework: "DORA", existing_frameworks: "SOC2" }),
    "--json",
  ]);
  assertEqual(responded.exitCode, 0, "workflow response should complete with fake toolkit");
  assertEqual(responded.json.data.run.status, "completed", "run should be completed");
  assertEqual(responded.json.data.pending_prompt, null, "completed run should not retain pending_prompt");

  const status = await runCli(["run-status", runId, `--workspace-id=${workspaceId}`, "--json"]);
  assertEqual(status.exitCode, 0, "run-status should report completed run as success");
  assertEqual(status.json.data.run.status, "completed", "run-status should return completed status");
} finally {
  runner.kill("SIGINT");
  await fs.rm(tempRoot, { recursive: true, force: true });
}

async function createFakeToolkit(root) {
  const scriptsDir = path.join(root, "plugins", "grc-engineer", "scripts");
  await fs.mkdir(scriptsDir, { recursive: true });

  await fs.writeFile(
    path.join(scriptsDir, "scaffold-framework.js"),
    fakeScript("scaffold-framework"),
    "utf8",
  );
  await fs.writeFile(
    path.join(scriptsDir, "gap-assessment.js"),
    fakeScript("gap-assessment"),
    "utf8",
  );
  await fs.writeFile(
    path.join(scriptsDir, "cross-framework-analyzer.js"),
    fakeScript("cross-framework-analyzer"),
    "utf8",
  );
}

function fakeScript(name) {
  return [
    "#!/usr/bin/env node",
    `console.log(JSON.stringify({ ok: true, script: ${JSON.stringify(name)}, args: process.argv.slice(2) }));`,
  ].join("\n");
}

async function waitForHealth(url) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 8000) {
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) {
        return;
      }
    } catch {}
    await sleep(100);
  }
  throw new Error(`runner did not become healthy at ${url}`);
}

async function runCli(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliBin, ...args], {
      cwd: workspaceRoot,
      env: {
        ...process.env,
        CGE_RUNNER_URL: runnerUrl,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      let json = null;
      try {
        json = JSON.parse(stdout);
      } catch (error) {
        reject(new Error(`CLI did not emit JSON: ${error.message}\nstdout:\n${stdout}\nstderr:\n${stderr}`));
        return;
      }
      resolve({ exitCode, json, stdout, stderr });
    });
  });
}

function assert(value, message) {
  if (!value) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
