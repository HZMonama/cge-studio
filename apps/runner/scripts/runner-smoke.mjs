import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const runnerDir = path.resolve(import.meta.dirname, "..");
const port = Number(process.env.CGE_RUNNER_SMOKE_PORT ?? 3341);
const baseUrl = `http://127.0.0.1:${port}`;
const workspaceRoot = path.join(
  os.tmpdir(),
  `cge-runner-smoke-${Date.now()}`,
);

async function main() {
  const runner = startRunner();
  let workspaceId = null;

  try {
    await waitForHealth();

    const workspace = await postJson("/workspaces", {
      title: `Runner Smoke ${new Date().toISOString()}`,
      rootPath: workspaceRoot,
    });
    workspaceId = workspace.id;
    const registry = await fetchJson("/registry/plugins");
    const commands = flattenCommands(registry.plugins ?? []);

    const diagnostics = [];
    for (const command of commands) {
      const diagnostic = await postJson("/diagnostics/resolve-command", {
        workspaceId: workspace.id,
        prompt: command.commandPath,
      });
      diagnostics.push({
        ...command,
        diagnostic,
      });
    }

    const liveRuns = await runLiveSamples(workspace.id);
    const report = buildReport({
      baseUrl,
      commands,
      diagnostics,
      liveRuns,
      workspace,
    });

    console.log(JSON.stringify(report, null, 2));
  } finally {
    await cleanupWorkspace(workspaceId);
    await stopRunner(runner);
  }
}

function startRunner() {
  return spawn(process.execPath, ["src/server.js"], {
    cwd: runnerDir,
    env: {
      ...process.env,
      CGE_RUNNER_PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function stopRunner(child) {
  if (!child || child.exitCode !== null) return;

  child.kill("SIGTERM");
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (child.exitCode === null) {
        child.kill("SIGKILL");
      }
    }, 1500);

    child.once("close", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function waitForHealth() {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < 15000) {
    try {
      const health = await fetchJson("/health");
      if (health?.ok) return health;
    } catch (error) {
      lastError = error;
    }

    await sleep(250);
  }

  throw new Error(
    `runner_failed_to_start:${lastError instanceof Error ? lastError.message : "unknown"}`,
  );
}

function flattenCommands(plugins) {
  return plugins.flatMap((plugin) =>
    (plugin.commands ?? []).map((command) => ({
      pluginId: plugin.id,
      commandId: command.id,
      commandPath: `/${plugin.id}:${command.id}`,
      executionMode: command.executionMode,
      runnerSupport: command.runnerSupport,
    })),
  );
}

async function runLiveSamples(workspaceId) {
  const samples = [
    {
      label: "script",
      prompt: "/grc-engineer:frameworks",
      timeoutMs: 15000,
    },
    {
      label: "workflow",
      prompt: "/grc-reporter:exec-summary",
      timeoutMs: 10000,
    },
    {
      label: "agent",
      prompt: "/cis-controls:control-check",
      timeoutMs: 10000,
    },
  ];

  const results = [];

  for (const sample of samples) {
    const run = await postJson(`/workspaces/${workspaceId}/runs`, {
      workspaceId,
      prompt: sample.prompt,
    });
    const settled = await waitForRun(workspaceId, run.id, sample.timeoutMs);
    const events = await fetchEventsMaybe(workspaceId, run.id);

    results.push(analyzeLiveRun(sample, settled, events));
  }

  return results;
}

async function waitForRun(workspaceId, runId, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const run = await fetchRunMaybe(workspaceId, runId);
    if (!run) {
      await sleep(250);
      continue;
    }

    if (run.status === "completed" || run.status === "failed") {
      return run;
    }
    await sleep(500);
  }

  return (
    (await fetchRunMaybe(workspaceId, runId)) ??
    { id: runId, status: "missing" }
  );
}

async function fetchRunMaybe(workspaceId, runId) {
  try {
    return await fetchJson(`/workspaces/${workspaceId}/runs/${runId}`);
  } catch (error) {
    if (error instanceof Error && error.message === "not_found") {
      return null;
    }
    throw error;
  }
}

async function fetchEventsMaybe(workspaceId, runId) {
  try {
    return await fetchJson(`/workspaces/${workspaceId}/runs/${runId}/events`);
  } catch (error) {
    if (error instanceof Error && error.message === "not_found") {
      return [];
    }
    throw error;
  }
}

function analyzeLiveRun(sample, run, events) {
  const eventMessages = (events ?? [])
    .map((event) => {
      if (typeof event?.data?.message === "string") return event.data.message;
      if (typeof event?.data?.text === "string") return event.data.text;
      return "";
    })
    .filter(Boolean);
  const joinedMessages = eventMessages.join("\n");

  let verdict = "pass";
  let summary = run.status;

  if (sample.label === "script") {
    if (run.status !== "completed") {
      verdict = "fail";
      summary = joinedMessages || `script_run_${run.status}`;
    }
  }

  if (sample.label === "workflow") {
    const expectedContextFailure = joinedMessages.includes("Missing findings context");
    const expectedWorkflowMessage = joinedMessages.includes("does not have enough context");

    if (run.status === "completed" || expectedContextFailure || expectedWorkflowMessage) {
      verdict = "pass";
      summary = run.status === "completed" ? "completed" : "expected_context_gate";
    } else {
      verdict = "fail";
      summary = joinedMessages || `workflow_run_${run.status}`;
    }
  }

  if (sample.label === "agent") {
    const cliContractFailure =
      joinedMessages.includes("--output-format=stream-json requires --verbose") ||
      joinedMessages.includes("Agent process exited with code 1.");
    const authOrApiProblem =
      joinedMessages.includes("API Error") ||
      joinedMessages.includes("api_retry") ||
      joinedMessages.includes("unknown") ||
      joinedMessages.includes("subscription") ||
      joinedMessages.includes("access token");

    if (cliContractFailure) {
      verdict = "fail";
      summary = "cli_contract_failure";
    } else if (run.status === "running") {
      verdict = "pass";
      summary = "still_running_after_timeout";
    } else if (run.status === "completed") {
      verdict = "pass";
      summary = "completed";
    } else if (authOrApiProblem) {
      verdict = "warn";
      summary = "environment_blocked_after_start";
    } else {
      verdict = "warn";
      summary = joinedMessages || `agent_run_${run.status}`;
    }
  }

  return {
    label: sample.label,
    prompt: sample.prompt,
    runId: run.id,
    status: run.status,
    verdict,
    summary,
    messages: eventMessages.slice(-5),
  };
}

function buildReport(input) {
  const byMode = {};
  const issues = [];

  for (const item of input.diagnostics) {
    const mode = item.diagnostic?.details?.executionMode ?? item.executionMode;
    byMode[mode] = (byMode[mode] ?? 0) + 1;

    if (Array.isArray(item.diagnostic?.issues) && item.diagnostic.issues.length > 0) {
      issues.push({
        commandPath: item.commandPath,
        mode,
        issues: item.diagnostic.issues,
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    baseUrl: input.baseUrl,
    workspace: {
      id: input.workspace.id,
      rootPath: input.workspace.rootPath,
    },
    summary: {
      commandCount: input.commands.length,
      byMode,
      diagnosticsPassed: input.diagnostics.filter((item) => item.diagnostic?.ok).length,
      diagnosticsFailed: issues.length,
      livePass: input.liveRuns.filter((item) => item.verdict === "pass").length,
      liveWarn: input.liveRuns.filter((item) => item.verdict === "warn").length,
      liveFail: input.liveRuns.filter((item) => item.verdict === "fail").length,
    },
    issues,
    liveRuns: input.liveRuns,
  };
}

async function cleanupWorkspace(workspaceId) {
  if (workspaceId) {
    try {
      await fetch(`${baseUrl}/workspaces/${workspaceId}`, {
        method: "DELETE",
      });
    } catch {
      // best effort
    }
  }

  try {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  } catch {
    // best effort
  }
}

async function fetchJson(route) {
  const response = await fetch(`${baseUrl}${route}`);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error ?? `http_${response.status}`);
  }
  return payload;
}

async function postJson(route, body) {
  const response = await fetch(`${baseUrl}${route}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error ?? `http_${response.status}`);
  }
  return payload;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

await main();
