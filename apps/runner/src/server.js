import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveCommandForm } from "./form-engine.js";
import {
  createWorkflowRuntime,
  resolveWorkflowExecution,
} from "./workflow-runner.js";
import { discoverCommandsWithSchemas } from "./schema-reader.js";
import {
  ensureWorkspaceSystem,
  exportWorkspaceSummary,
  listWorkspaces,
  readWorkspace,
  refreshWorkspace,
  renameWorkspace,
  deleteWorkspace,
  getWorkspacesRoot,
  createWorkspace,
} from "./workspaces.js";

const formOverlayRoot = path.join(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  "forms",
);

const port = Number(process.env.CGE_RUNNER_PORT ?? 3333);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const runnerRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(runnerRoot, "..", "..");
const embeddedToolkitPath = path.join(
  repoRoot,
  "cli",
  "cool-grc-engineering",
);
const allPersonas = ["engineer", "auditor", "internal", "tprm"];

const knownConnectors = [
  { id: "aws-inspector", label: "AWS Inspector" },
  { id: "gcp-inspector", label: "GCP Inspector" },
  { id: "github-inspector", label: "GitHub Inspector" },
  { id: "nessus", label: "Nessus", configFile: "poam-automation.yaml", cacheDir: "poam-automation" },
  { id: "okta-inspector", label: "Okta Inspector" },
  { id: "qualys", label: "Qualys", configFile: "poam-automation.yaml", cacheDir: "poam-automation" },
  { id: "tenable", label: "Tenable.io", configFile: "poam-automation.yaml", cacheDir: "poam-automation" },
  { id: "wiz", label: "Wiz", configFile: "poam-automation.yaml", cacheDir: "poam-automation" },
];

const frameworkCatalog = [
  { id: "SOC2", label: "SOC 2", family: "Trust Services" },
  { id: "FedRAMP-Moderate", label: "FedRAMP Moderate", family: "US Federal" },
  { id: "FedRAMP-High", label: "FedRAMP High", family: "US Federal" },
  { id: "NIST-800-53-r5", label: "NIST 800-53 Rev 5", family: "NIST" },
  { id: "ISO-27001-2022", label: "ISO 27001:2022", family: "ISO" },
  { id: "CIS-v8", label: "CIS Controls v8", family: "CIS" },
];

const supportedWorkflowCommands = new Set([
  "/grc-reporter:exec-summary",
  "/grc-reporter:board-brief",
  "/grc-reporter:automation-coverage",
  "/grc-reporter:program-health",
]);

const plannedWorkflowCommands = new Set([]);

const scriptCommandFactories = new Map([
  ["/aws-inspector:collect", (input) =>
    buildNodeScriptExecution(input, {
      scriptPathSegments: ["plugins", "connectors", "aws-inspector", "scripts", "collect.js"],
      syncStrategy: "aws-inspector-collect",
    })],
  ["/aws-inspector:setup", (input) =>
    buildShellScriptExecution(input, {
      scriptPathSegments: ["plugins", "connectors", "aws-inspector", "scripts", "setup.sh"],
    })],
  ["/aws-inspector:status", (input) =>
    buildShellScriptExecution(input, {
      scriptPathSegments: ["plugins", "connectors", "aws-inspector", "scripts", "status.sh"],
    })],
  ["/gcp-inspector:collect", (input) =>
    buildNodeScriptExecution(input, {
      scriptPathSegments: ["plugins", "connectors", "gcp-inspector", "scripts", "collect.js"],
      syncStrategy: "gcp-inspector-collect",
    })],
  ["/gcp-inspector:setup", (input) =>
    buildShellScriptExecution(input, {
      scriptPathSegments: ["plugins", "connectors", "gcp-inspector", "scripts", "setup.sh"],
    })],
  ["/gcp-inspector:status", (input) =>
    buildShellScriptExecution(input, {
      scriptPathSegments: ["plugins", "connectors", "gcp-inspector", "scripts", "status.sh"],
    })],
  ["/github-inspector:collect", (input) =>
    buildNodeScriptExecution(input, {
      scriptPathSegments: ["plugins", "connectors", "github-inspector", "scripts", "collect.js"],
      syncStrategy: "github-inspector-collect",
    })],
  ["/github-inspector:setup", (input) =>
    buildShellScriptExecution(input, {
      scriptPathSegments: ["plugins", "connectors", "github-inspector", "scripts", "setup.sh"],
    })],
  ["/github-inspector:status", (input) =>
    buildShellScriptExecution(input, {
      scriptPathSegments: ["plugins", "connectors", "github-inspector", "scripts", "status.sh"],
    })],
  ["/okta-inspector:collect", (input) =>
    buildNodeScriptExecution(input, {
      scriptPathSegments: ["plugins", "connectors", "okta-inspector", "scripts", "collect.js"],
      syncStrategy: "okta-inspector-collect",
    })],
  ["/okta-inspector:setup", (input) =>
    buildShellScriptExecution(input, {
      scriptPathSegments: ["plugins", "connectors", "okta-inspector", "scripts", "setup.sh"],
    })],
  ["/okta-inspector:status", (input) =>
    buildShellScriptExecution(input, {
      scriptPathSegments: ["plugins", "connectors", "okta-inspector", "scripts", "status.sh"],
    })],
  ["/fedramp-ssp:convert", (input) =>
    buildShellScriptExecution(input, {
      scriptPathSegments: ["plugins", "fedramp-ssp", "scripts", "convert.sh"],
      args: ensureOption(input.parsed.argumentTokens, "--output",
        path.join(input.runArtifactsDir ?? input.workspace.folders.artifactsGenerated, "ssp-output.json")),
      extra: { outputDir: input.runArtifactsDir ?? null },
    })],
  ["/fedramp-ssp:setup", (input) =>
    buildShellScriptExecution(input, {
      scriptPathSegments: ["plugins", "fedramp-ssp", "scripts", "setup.sh"],
    })],
  ["/fedramp-20x:sync-docs", (input) =>
    buildFedramp20xSyncExecution(input)],
  ["/oscal:convert", (input) =>
    buildShellScriptExecution(input, {
      scriptPathSegments: ["plugins", "oscal", "scripts", "convert.sh"],
      args: readOptionValue(input.parsed.argumentTokens, "--output") != null
        ? input.parsed.argumentTokens
        : [...input.parsed.argumentTokens, "--output", path.join(input.runArtifactsDir ?? input.workspace.folders.artifactsGenerated, "oscal-converted")],
      extra: { outputDir: input.runArtifactsDir ?? null },
    })],
  ["/oscal:setup", (input) =>
    buildShellScriptExecution(input, {
      scriptPathSegments: ["plugins", "oscal", "scripts", "setup.sh"],
    })],
  ["/oscal:validate", (input) =>
    buildShellScriptExecution(input, {
      scriptPathSegments: ["plugins", "oscal", "scripts", "validate.sh"],
    })],
  ["/grc-engineer:collect-evidence", (input) =>
    buildNodeScriptExecution(input, {
      scriptPathSegments: ["plugins", "grc-engineer", "scripts", "collect-evidence.js"],
    })],
  ["/grc-engineer:find-conflicts", (input) =>
    buildNodeScriptExecution(input, {
      scriptPathSegments: ["plugins", "grc-engineer", "scripts", "cross-framework-analyzer.js"],
      args: ["conflicts", ...input.parsed.argumentTokens],
    })],
  ["/grc-engineer:frameworks", (input) =>
    buildNodeScriptExecution(input, {
      scriptPathSegments: ["plugins", "grc-engineer", "scripts", "frameworks.js"],
    })],
  ["/grc-engineer:gap-assessment", (input) =>
    buildGapAssessmentExecution(input)],
  ["/grc-engineer:generate-policy", (input) =>
    buildNodeScriptExecution(input, {
      scriptPathSegments: ["plugins", "grc-engineer", "scripts", "generate-policy.js"],
    })],
  ["/grc-engineer:map-control", (input) =>
    buildNodeScriptExecution(input, {
      scriptPathSegments: ["plugins", "grc-engineer", "scripts", "map-control.js"],
    })],
  ["/grc-engineer:map-controls-unified", (input) =>
    buildNodeScriptExecution(input, {
      scriptPathSegments: ["plugins", "grc-engineer", "scripts", "cross-framework-analyzer.js"],
      args: ["map", ...input.parsed.argumentTokens],
    })],
  ["/grc-engineer:optimize-multi-framework", (input) =>
    buildNodeScriptExecution(input, {
      scriptPathSegments: ["plugins", "grc-engineer", "scripts", "cross-framework-analyzer.js"],
      args: ["optimize", ...input.parsed.argumentTokens],
    })],
  ["/grc-engineer:pipeline-status", (input) =>
    buildShellScriptExecution(input, {
      scriptPathSegments: ["plugins", "grc-engineer", "scripts", "pipeline-status.sh"],
    })],
  ["/grc-engineer:record-automation-metrics", (input) =>
    buildNodeScriptExecution(input, {
      scriptPathSegments: ["plugins", "grc-engineer", "scripts", "record-automation-metrics.js"],
      args: ensureOption(
        input.parsed.argumentTokens,
        "--out-dir",
        input.workspace.folders.programMetrics,
      ),
      extra: {
        outDir: input.workspace.folders.programMetrics,
      },
    })],
  ["/grc-engineer:review-pr", (input) =>
    buildNodeScriptExecution(input, {
      scriptPathSegments: ["plugins", "grc-engineer", "scripts", "review-pr.js"],
    })],
  ["/grc-engineer:scaffold-framework", (input) =>
    buildNodeScriptExecution(input, {
      scriptPathSegments: ["plugins", "grc-engineer", "scripts", "scaffold-framework.js"],
    })],
  ["/grc-engineer:scan-iac", (input) =>
    buildNodeScriptExecution(input, {
      scriptPathSegments: ["plugins", "grc-engineer", "scripts", "scan-iac.js"],
    })],
  ["/grc-engineer:test-control", (input) =>
    buildNodeScriptExecution(input, {
      scriptPathSegments: ["plugins", "grc-engineer", "scripts", "test-control.js"],
    })],
  ["/grc-engineer:transform-risk", (input) =>
    buildNodeScriptExecution(input, {
      scriptPathSegments: ["plugins", "grc-engineer", "scripts", "transform-risk.js"],
    })],
]);

const roots = {
  configRoot: path.join(os.homedir(), ".config", "claude-grc"),
  cacheRoot: path.join(os.homedir(), ".cache", "claude-grc"),
  appDataRoot: path.join(os.homedir(), ".local", "share", "cge-ui"),
};
const defaultWorkspaceRoot = path.join(os.homedir(), "Documents", "CGE Workspaces");
const workflowRuntime = createWorkflowRuntime({
  appendRunEvent,
  createArtifactSummary,
  executeStep,
  findLatestJsonFile,
  isRunCanceled,
  parsePrompt,
  readRuns,
  recordRunCanceled,
  writeRun,
});

const activeRunChildren = new Map();
const canceledRunIds = new Set();

function isRunCanceled(runId) {
  return canceledRunIds.has(runId);
}

function registerRunChild(runId, child) {
  let children = activeRunChildren.get(runId);
  if (!children) {
    children = new Set();
    activeRunChildren.set(runId, children);
  }

  children.add(child);

  return () => {
    const current = activeRunChildren.get(runId);
    if (!current) {
      return;
    }

    current.delete(child);
    if (current.size === 0) {
      activeRunChildren.delete(runId);
    }
  };
}

function terminateChildProcess(child) {
  if (!child || typeof child.pid !== "number") {
    return;
  }

  if (process.platform === "win32") {
    child.kill("SIGTERM");
    return;
  }

  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
    return;
  }

  setTimeout(() => {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {}
  }, 4000).unref();
}

function terminateRunChildren(runId) {
  const children = activeRunChildren.get(runId);
  if (!children) {
    return;
  }

  for (const child of children) {
    terminateChildProcess(child);
  }
}

async function readRunFromDirectory(runDirectory) {
  try {
    const contents = await fs.readFile(path.join(runDirectory, "run.json"), "utf8");
    return JSON.parse(contents);
  } catch {
    return null;
  }
}

async function readWorkflowStateFile(runDirectory) {
  try {
    const contents = await fs.readFile(
      path.join(runDirectory, "workflow-state.json"),
      "utf8",
    );
    return JSON.parse(contents);
  } catch {
    return null;
  }
}

async function writeWorkflowStateFile(runDirectory, state) {
  await fs.writeFile(
    path.join(runDirectory, "workflow-state.json"),
    JSON.stringify(state, null, 2),
    "utf8",
  );
}

async function recordRunCanceled({
  run,
  runDirectory,
  message = "Run canceled by user.",
}) {
  canceledRunIds.add(run.id);

  const currentRun = (await readRunFromDirectory(runDirectory)) ?? run;

  if (currentRun.status === "canceled") {
    return currentRun;
  }

  const workflowState = await readWorkflowStateFile(runDirectory);
  if (workflowState && workflowState.phase !== "completed" && workflowState.phase !== "canceled") {
    await writeWorkflowStateFile(runDirectory, {
      ...workflowState,
      phase: "canceled",
      canceledAt: new Date().toISOString(),
      cancelMessage: message,
    });
  }

  const nextRun = {
    ...currentRun,
    status: "canceled",
    completedAt: new Date().toISOString(),
  };

  await appendRunEvent(runDirectory, {
    type: "run.canceled",
    data: {
      message,
    },
  });
  await writeRun(runDirectory, nextRun);

  return nextRun;
}



const app = new Hono();

app.use("*", cors({
  origin: "*",
  allowHeaders: ["Content-Type", "X-Workspace-Id"],
  allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
}));

app.use("*", async (c, next) => {
  await ensureWorkspaceSystem(roots);
  await next();
});

async function getRunnerContext() {
  const runnerConfig = await readRunnerConfig();
  const toolkitPath = getToolkitPath(runnerConfig);
  const toolkitAvailable = toolkitPath ? await pathExists(toolkitPath) : false;
  return { runnerConfig, toolkitPath, toolkitAvailable };
}

async function readBody(c) {
  try {
    return await c.req.json();
  } catch {
    return {};
  }
}

app.get("/health", async (c) => {
  const { runnerConfig, toolkitPath, toolkitAvailable } = await getRunnerContext();
  return c.json({
    ok: true,
    runnerVersion: "0.1.0",
    toolkitPath,
    toolkitConfigured: toolkitAvailable,
    runnerConfigPath: runnerConfig.path,
    appDataRoot: roots.appDataRoot,
    cacheRoot: roots.cacheRoot,
    configRoot: roots.configRoot,
    workspacesRoot: getWorkspacesRoot(roots),
  });
});

app.get("/config", async (c) => {
  const runnerConfig = await readRunnerConfig();
  return c.json({
    toolkitPath: runnerConfig.value.toolkitPath ?? "",
    workspaceRoot: getWorkspaceRoot(),
    runnerConfigPath: getWritableRunnerConfigPath(),
  });
});

app.patch("/config", async (c) => {
  const body = await readBody(c);
  const nextConfig = await writeRunnerConfig({
    toolkitPath:
      typeof body.toolkitPath === "string" ? body.toolkitPath : undefined,
  });

  return c.json({
    toolkitPath: nextConfig.toolkitPath ?? "",
    workspaceRoot: getWorkspaceRoot(),
    runnerConfigPath: getWritableRunnerConfigPath(),
  });
});

app.get("/registry/plugins", async (c) => {
  const { toolkitPath, toolkitAvailable } = await getRunnerContext();
  const plugins = toolkitAvailable
    ? await discoverCommandsWithSchemas(toolkitPath)
    : [];

  return c.json({
    plugins,
    source: toolkitAvailable ? "toolkit" : "unconfigured",
    toolkitPath,
    format: "v2",
  });
});

app.post("/diagnostics/resolve-command", async (c) => {
  const body = await readBody(c);
  if (typeof body.prompt !== "string" || !body.prompt.trim()) {
    return c.json({ error: "prompt is required" }, 400);
  }

  const workspace = await resolveWorkspaceFromBody(roots, body);
  if (!workspace) {
    return c.json({ error: "workspaceId is required" }, 400);
  }

  const { toolkitAvailable, toolkitPath } = await getRunnerContext();

  return c.json(
    await resolveCommandDiagnostics({
      workspace,
      prompt: body.prompt,
      toolkitAvailable,
      toolkitPath,
    }),
  );
});

app.get("/frameworks", (c) => c.json(frameworkCatalog));

app.get("/connectors", async (c) => c.json(await readConnectorSummaries()));

app.get("/workspaces", async (c) => {
  return c.json(
    await listWorkspaces(roots, {
      workspaceRoot: getWorkspaceRoot(),
    }),
  );
});

app.post("/workspaces", async (c) => {
  const body = await readBody(c);
  const workspace = await createWorkspace({
    roots,
    title: typeof body.title === "string" ? body.title : null,
    rootPath: typeof body.rootPath === "string" ? body.rootPath : null,
    workspaceRoot: getWorkspaceRoot(),
  });
  return c.json(workspace, 201);
});

app.get("/workspaces/:workspaceId", async (c) => {
  const workspaceId = decodeURIComponent(c.req.param("workspaceId"));
  const workspace = await readWorkspace(roots, workspaceId);

  if (!workspace) {
    return c.json({ error: "workspace_not_found" }, 404);
  }

  return c.json(workspace);
});

app.patch("/workspaces/:workspaceId", async (c) => {
  const workspaceId = decodeURIComponent(c.req.param("workspaceId"));
  const workspace = await readWorkspace(roots, workspaceId);

  if (!workspace) {
    return c.json({ error: "workspace_not_found" }, 404);
  }

  const body = await readBody(c);
  if (typeof body.title !== "string" || !body.title.trim()) {
    return c.json({ error: "title is required" }, 400);
  }

  const updated = await renameWorkspace(roots, workspaceId, body.title);
  return c.json(updated);
});

app.delete("/workspaces/:workspaceId", async (c) => {
  const workspaceId = decodeURIComponent(c.req.param("workspaceId"));

  try {
    const deleted = await deleteWorkspace(roots, workspaceId);
    if (!deleted) {
      return c.json({ error: "workspace_not_found" }, 404);
    }

    return c.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "cannot_delete_last_workspace") {
      return c.json({ error: error.message }, 400);
    }

    throw error;
  }
});

app.post("/workspaces/:workspaceId/refresh", async (c) => {
  const workspaceId = decodeURIComponent(c.req.param("workspaceId"));
  const workspace = await readWorkspace(roots, workspaceId);

  if (!workspace) {
    return c.json({ error: "workspace_not_found" }, 404);
  }

  const refreshed = await refreshWorkspace(roots, workspaceId);
  if (refreshed) {
    await materializeWorkspaceMetrics(refreshed, {
      sourceRef: "workspace-refresh",
    });
  }
  return c.json(refreshed);
});

app.get("/workspaces/:workspaceId/export", async (c) => {
  const workspaceId = decodeURIComponent(c.req.param("workspaceId"));
  const workspace = await readWorkspace(roots, workspaceId);

  if (!workspace) {
    return c.json({ error: "workspace_not_found" }, 404);
  }

  const summary = await exportWorkspaceSummary(roots, workspaceId);
  if (!summary) {
    return c.json({ error: "workspace_not_found" }, 404);
  }

  return c.json(summary);
});

app.get("/workspaces/:workspaceId/runs", async (c) => {
  const workspaceId = decodeURIComponent(c.req.param("workspaceId"));
  const workspace = await readWorkspace(roots, workspaceId);

  if (!workspace) {
    return c.json({ error: "workspace_not_found" }, 404);
  }

  return c.json(await readRuns(workspace));
});

app.post("/workspaces/:workspaceId/runs", async (c) => {
  const workspaceId = decodeURIComponent(c.req.param("workspaceId"));
  const workspace = await readWorkspace(roots, workspaceId);

  if (!workspace) {
    return c.json({ error: "workspace_not_found" }, 404);
  }

  const body = await readBody(c);
  if (typeof body.prompt !== "string" || !body.prompt.trim()) {
    return c.json({ error: "prompt is required" }, 400);
  }

  if (!parsePrompt(body.prompt)) {
    return c.json({ error: "invalid_command_prompt" }, 400);
  }

  const { toolkitAvailable, toolkitPath } = await getRunnerContext();
  const run = await createCommandRun({
    workspace,
    prompt: body.prompt,
    redactedPrompt:
      typeof body.redactedPrompt === "string" ? body.redactedPrompt : null,
    toolkitAvailable,
    toolkitPath,
  });

  return c.json(run, 201);
});

app.get("/workspaces/:workspaceId/runs/:runId", async (c) => {
  const workspaceId = decodeURIComponent(c.req.param("workspaceId"));
  const workspace = await readWorkspace(roots, workspaceId);

  if (!workspace) {
    return c.json({ error: "workspace_not_found" }, 404);
  }

  const runId = decodeURIComponent(c.req.param("runId"));
  const run = await readRun(workspace, runId);

  if (!run) {
    return c.json({ error: "not_found" }, 404);
  }

  return c.json(run);
});

app.get("/workspaces/:workspaceId/runs/:runId/events", async (c) => {
  const workspaceId = decodeURIComponent(c.req.param("workspaceId"));
  const workspace = await readWorkspace(roots, workspaceId);

  if (!workspace) {
    return c.json({ error: "workspace_not_found" }, 404);
  }

  const runId = decodeURIComponent(c.req.param("runId"));
  const run = await readRun(workspace, runId);

  if (!run) {
    return c.json({ error: "not_found" }, 404);
  }

  return c.json(await readRunEvents(workspace, runId));
});

app.post("/workspaces/:workspaceId/runs/:runId/respond", async (c) => {
  const workspaceId = decodeURIComponent(c.req.param("workspaceId"));
  const workspace = await readWorkspace(roots, workspaceId);

  if (!workspace) {
    return c.json({ error: "workspace_not_found" }, 404);
  }

  const runId = decodeURIComponent(c.req.param("runId"));
  const run = await readRun(workspace, runId);

  if (!run) {
    return c.json({ error: "not_found" }, 404);
  }

  const body = await readBody(c);
  const answered = await respondToWorkflowRun({
    response: body,
    run,
    workspace,
  });

  if (!answered) {
    return c.json({ error: "run_not_waiting_for_input", message: "This run is no longer awaiting input." }, 400);
  }

  return c.json(answered);
});

app.post("/workspaces/:workspaceId/runs/:runId/cancel", async (c) => {
  const workspaceId = decodeURIComponent(c.req.param("workspaceId"));
  const workspace = await readWorkspace(roots, workspaceId);

  if (!workspace) {
    return c.json({ error: "workspace_not_found" }, 404);
  }

  const runId = decodeURIComponent(c.req.param("runId"));
  const run = await readRun(workspace, runId);

  if (!run) {
    return c.json({ error: "not_found" }, 404);
  }

  if (run.status === "completed" || run.status === "failed" || run.status === "canceled") {
    return c.json(
      {
        error: "run_not_cancelable",
        message: "This run has already finished.",
      },
      400,
    );
  }

  const nextRun = await recordRunCanceled({
    run,
    runDirectory: run.runDirectory,
  });

  terminateRunChildren(run.id);

  return c.json(nextRun);
});

app.get("/workspaces/:workspaceId/artifacts", async (c) => {
  const workspaceId = decodeURIComponent(c.req.param("workspaceId"));
  const workspace = await readWorkspace(roots, workspaceId);

  if (!workspace) {
    return c.json({ error: "workspace_not_found" }, 404);
  }

  return c.json(await readArtifacts(workspace));
});

app.get("/workspaces/:workspaceId/artifacts/:artifactId", async (c) => {
  const workspaceId = decodeURIComponent(c.req.param("workspaceId"));
  const workspace = await readWorkspace(roots, workspaceId);

  if (!workspace) {
    return c.json({ error: "workspace_not_found" }, 404);
  }

  const artifactId = decodeURIComponent(c.req.param("artifactId"));
  const artifact = await readArtifact(workspace, artifactId);

  if (!artifact) {
    return c.json({ error: "not_found" }, 404);
  }

  return c.json(artifact);
});

app.get("/workspaces/:workspaceId/artifacts/:artifactId/content", async (c) => {
  const workspaceId = decodeURIComponent(c.req.param("workspaceId"));
  const workspace = await readWorkspace(roots, workspaceId);

  if (!workspace) {
    return c.json({ error: "workspace_not_found" }, 404);
  }

  const artifactId = decodeURIComponent(c.req.param("artifactId"));
  const artifact = await readArtifact(workspace, artifactId);

  if (!artifact) {
    return c.json({ error: "not_found" }, 404);
  }

  const content = await fs.readFile(artifact.path, "utf8");
  return c.json({ ...artifact, content });
});

app.get("/workspaces/:workspaceId/findings", async (c) => {
  const workspaceId = decodeURIComponent(c.req.param("workspaceId"));
  const workspace = await readWorkspace(roots, workspaceId);

  if (!workspace) {
    return c.json({ error: "workspace_not_found" }, 404);
  }

  return c.json(await readWorkspaceFindings(workspace));
});

app.get("/workspaces/:workspaceId/findings/:findingId", async (c) => {
  const workspaceId = decodeURIComponent(c.req.param("workspaceId"));
  const workspace = await readWorkspace(roots, workspaceId);

  if (!workspace) {
    return c.json({ error: "workspace_not_found" }, 404);
  }

  const findingId = decodeURIComponent(c.req.param("findingId"));
  const findings = await readWorkspaceFindings(workspace);
  const finding = findings.find((f) => f.id === findingId);

  if (!finding) {
    return c.json({ error: "not_found" }, 404);
  }

  return c.json(finding);
});

app.get("/workspaces/:workspaceId/program", async (c) => {
  const workspaceId = decodeURIComponent(c.req.param("workspaceId"));
  const workspace = await readWorkspace(roots, workspaceId);

  if (!workspace) {
    return c.json({ error: "workspace_not_found" }, 404);
  }

  return c.json(await readWorkspaceProgram(workspace));
});

app.get("/workspaces/:workspaceId/metrics", async (c) => {
  const workspaceId = decodeURIComponent(c.req.param("workspaceId"));
  const workspace = await readWorkspace(roots, workspaceId);

  if (!workspace) {
    return c.json({ error: "workspace_not_found" }, 404);
  }

  return c.json(await readWorkspaceMetrics(workspace));
});

app.post("/workspaces/:workspaceId/metrics/materialize", async (c) => {
  const workspaceId = decodeURIComponent(c.req.param("workspaceId"));
  const workspace = await readWorkspace(roots, workspaceId);

  if (!workspace) {
    return c.json({ error: "workspace_not_found" }, 404);
  }

  await materializeWorkspaceMetrics(workspace, {
    sourceRef: "manual",
  });

  return c.json(await readWorkspaceMetrics(workspace));
});

app.get("/workspaces/:workspaceId/metrics/snapshots/:snapshotId", async (c) => {
  const workspaceId = decodeURIComponent(c.req.param("workspaceId"));
  const workspace = await readWorkspace(roots, workspaceId);

  if (!workspace) {
    return c.json({ error: "workspace_not_found" }, 404);
  }

  const snapshotId = decodeURIComponent(c.req.param("snapshotId"));
  const snapshots = await readMetricSnapshots(workspace);
  const snapshot = snapshots.find((item) => item.snapshot_id === snapshotId);

  if (!snapshot) {
    return c.json({ error: "not_found" }, 404);
  }

  return c.json({
    ...snapshot,
    metric_count: snapshot.metrics.length,
  });
});

app.get("/runs", async (c) => {
  const workspace = await resolveWorkspaceFromRequest(
    roots,
    c.req.query("workspaceId"),
    c.req.header("x-workspace-id"),
  );
  if (!workspace) {
    return c.json({ error: "workspace_not_found" }, 404);
  }

  return c.json(await readRuns(workspace));
});

app.post("/runs", async (c) => {
  const body = await readBody(c);
  if (typeof body.prompt !== "string" || !body.prompt.trim()) {
    return c.json({ error: "prompt is required" }, 400);
  }

  if (!parsePrompt(body.prompt)) {
    return c.json({ error: "invalid_command_prompt" }, 400);
  }

  const workspace = await resolveWorkspaceFromBody(roots, body);
  if (!workspace) {
    return c.json({ error: "workspaceId is required" }, 400);
  }

  const { toolkitAvailable, toolkitPath } = await getRunnerContext();
  const run = await createCommandRun({
    workspace,
    prompt: body.prompt,
    redactedPrompt:
      typeof body.redactedPrompt === "string" ? body.redactedPrompt : null,
    toolkitAvailable,
    toolkitPath,
  });

  return c.json(run, 201);
});

app.get("/runs/:runId", async (c) => {
  const runId = decodeURIComponent(c.req.param("runId"));
  const workspace = await resolveWorkspaceFromRequest(
    roots,
    c.req.query("workspaceId"),
    c.req.header("x-workspace-id"),
  );
  if (!workspace) {
    return c.json({ error: "workspace_not_found" }, 404);
  }

  const run = await readRun(workspace, runId);

  if (!run) {
    return c.json({ error: "not_found" }, 404);
  }

  return c.json(run);
});

app.get("/runs/:runId/events", async (c) => {
  const runId = decodeURIComponent(c.req.param("runId"));
  const workspace = await resolveWorkspaceFromRequest(
    roots,
    c.req.query("workspaceId"),
    c.req.header("x-workspace-id"),
  );
  if (!workspace) {
    return c.json({ error: "workspace_not_found" }, 404);
  }

  return c.json(await readRunEvents(workspace, runId));
});

app.get("/artifacts", async (c) => {
  const workspace = await resolveWorkspaceFromRequest(
    roots,
    c.req.query("workspaceId"),
    c.req.header("x-workspace-id"),
  );
  if (!workspace) {
    return c.json({ error: "workspace_not_found" }, 404);
  }

  return c.json(await readArtifacts(workspace));
});

app.get("/artifacts/:artifactId", async (c) => {
  const artifactId = decodeURIComponent(c.req.param("artifactId"));
  const workspace = await resolveWorkspaceFromRequest(
    roots,
    c.req.query("workspaceId"),
    c.req.header("x-workspace-id"),
  );
  if (!workspace) {
    return c.json({ error: "workspace_not_found" }, 404);
  }

  const artifact = await readArtifact(workspace, artifactId);

  if (!artifact) {
    return c.json({ error: "not_found" }, 404);
  }

  return c.json(artifact);
});

app.get("/artifacts/:artifactId/content", async (c) => {
  const artifactId = decodeURIComponent(c.req.param("artifactId"));
  const workspace = await resolveWorkspaceFromRequest(
    roots,
    c.req.query("workspaceId"),
    c.req.header("x-workspace-id"),
  );
  if (!workspace) {
    return c.json({ error: "workspace_not_found" }, 404);
  }

  const artifact = await readArtifact(workspace, artifactId);

  if (!artifact) {
    return c.json({ error: "not_found" }, 404);
  }

  const content = await fs.readFile(artifact.path, "utf8");
  return c.json({ ...artifact, content });
});

app.get("/claude-code/status", async (c) => {
  return c.json(await readClaudeCodeStatus());
});

app.patch("/claude-code/config", async (c) => {
  const body = await readBody(c);
  const updated = await writeClaudeCodeSettings(body);
  return c.json(await readClaudeCodeStatus(updated));
});

app.post("/gap-assessment", async (c) => {
  const body = await readBody(c);
  const frameworks = coerceArray(body.frameworks);
  const sources = coerceArray(body.sources);

  if (!frameworks.length || !sources.length) {
    return c.json({ error: "frameworks and sources are required" }, 400);
  }

  const workspace = await readWorkspace(
    roots,
    typeof body.workspaceId === "string" ? body.workspaceId : "",
  );
  if (!workspace) {
    return c.json({ error: "workspaceId is required" }, 400);
  }

  const { toolkitPath } = await getRunnerContext();
  const run = await createPlannedRun({
    workspace,
    frameworks,
    sources,
    toolkitPath,
  });
  return c.json(run, 202);
});

app.notFound((c) => c.json({ error: "not_found" }, 404));

app.onError((error, c) => {
  const message = error instanceof Error ? error.message : "unknown_error";
  if (
    message === "workspace_root_path_required" ||
    message === "workspace_id_conflict"
  ) {
    return c.json({ error: message }, 400);
  }

  return c.json({ error: message }, 500);
});

// ============================================================================
// File System API for Path Picker
// ============================================================================

function isPathAllowed(targetPath) {
  // Only allow paths under home directory or workspace folders
  const home = os.homedir();
  const allowedPrefixes = [
    home,
    roots.appDataRoot,
    roots.configRoot,
    roots.cacheRoot,
  ];
  return allowedPrefixes.some((prefix) => targetPath.startsWith(prefix));
}

function sanitizePath(inputPath) {
  // Resolve and normalize the path
  const resolved = path.resolve(inputPath);
  // Prevent path traversal outside allowed directories
  if (!isPathAllowed(resolved)) {
    return null;
  }
  return resolved;
}

app.get("/fs/home", async (c) => {
  return c.json({ path: os.homedir() });
});

app.get("/fs/ls", async (c) => {
  const rawPath = c.req.query("path") || os.homedir();
  const showHidden = c.req.query("showHidden") === "true";

  const targetPath = sanitizePath(rawPath);
  if (!targetPath) {
    return c.json({ error: "path_not_allowed" }, 403);
  }

  try {
    const entries = await fs.readdir(targetPath, { withFileTypes: true });
    const result = entries
      .filter((entry) => showHidden || !entry.name.startsWith("."))
      .map((entry) => ({
        name: entry.name,
        type: entry.isDirectory() ? "directory" : "file",
        size: entry.isFile() ? null : null, // Size would require async stat
      }))
      .sort((a, b) => {
        // Directories first, then alphabetical
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === "directory" ? -1 : 1;
      });

    return c.json({ path: targetPath, entries: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return c.json({ error: message }, 500);
  }
});

app.post("/fs/mkdir", async (c) => {
  const body = await readBody(c);
  const rawPath = body.path;

  if (!rawPath || typeof rawPath !== "string") {
    return c.json({ error: "path_required" }, 400);
  }

  const targetPath = sanitizePath(rawPath);
  if (!targetPath) {
    return c.json({ error: "path_not_allowed" }, 403);
  }

  try {
    await fs.mkdir(targetPath, { recursive: true });
    return c.json({ success: true, path: targetPath });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return c.json({ error: message }, 500);
  }
});

function getClaudeSettingsPath() {
  return path.join(os.homedir(), ".claude", "settings.json");
}

async function readClaudeCodeSettings() {
  try {
    const contents = await fs.readFile(getClaudeSettingsPath(), "utf8");
    return JSON.parse(contents);
  } catch {
    return {};
  }
}

async function writeClaudeCodeSettings(input) {
  const current = await readClaudeCodeSettings();
  const next = { ...current };

  if (typeof input.model === "string") {
    if (input.model.trim()) {
      next.model = input.model.trim();
    } else {
      delete next.model;
    }
  }

  const settingsPath = getClaudeSettingsPath();
  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(settingsPath, JSON.stringify(next, null, 2), "utf8");
  return next;
}

function getClaudeVersion() {
  return new Promise((resolve) => {
    let output = "";

    const proc = spawn("claude", ["--version"], { shell: true });
    proc.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });

    proc.on("close", (code) => {
      resolve(code === 0 && output.trim() ? output.trim() : null);
    });

    proc.on("error", () => resolve(null));
  });
}

function getClaudeCredentialsPath() {
  return path.join(os.homedir(), ".claude", ".credentials.json");
}

async function readClaudeSubscriptionStatus() {
  try {
    const contents = await fs.readFile(getClaudeCredentialsPath(), "utf8");
    const parsed = JSON.parse(contents);
    const oauth = parsed?.claudeAiOauth;
    if (!oauth || typeof oauth.accessToken !== "string" || !oauth.accessToken) {
      return false;
    }
    if (typeof oauth.expiresAt === "number" && oauth.expiresAt < Date.now()) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function readClaudeCodeStatus(settings) {
  const [version, resolvedSettings, subscriptionLoginConfigured] = await Promise.all([
    getClaudeVersion(),
    settings ? Promise.resolve(settings) : readClaudeCodeSettings(),
    readClaudeSubscriptionStatus(),
  ]);

  return {
    installed: version !== null,
    version,
    apiKeyConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    subscriptionLoginConfigured,
    model: resolvedSettings.model ?? null,
    settingsPath: getClaudeSettingsPath(),
  };
}



const server = serve(
  {
    fetch: app.fetch,
    port,
    hostname: "127.0.0.1",
  },
  (info) => {
    console.log(`[runner] listening on http://127.0.0.1:${info.port}`);
  },
);

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`[runner] Port ${port} already in use. Kill the existing process or set CGE_RUNNER_PORT.`);
    process.exit(1);
  }
  throw error;
});

let shuttingDown = false;

function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[runner] ${signal} received, shutting down…`);
  server.close(() => {
    process.exit(0);
  });
  setTimeout(() => {
    console.log("[runner] forced shutdown after timeout");
    process.exit(1);
  }, 5000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGHUP", () => gracefulShutdown("SIGHUP"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

async function readRunnerConfig() {
  const configPaths = [
    path.join(runnerRoot, "runner.config.local.json"),
    path.join(runnerRoot, "runner.config.json"),
  ];

  for (const configPath of configPaths) {
    try {
      const contents = await fs.readFile(configPath, "utf8");
      return {
        path: configPath,
        value: JSON.parse(contents),
      };
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        continue;
      }

      throw error;
    }
  }

  return { path: null, value: {} };
}

function getWritableRunnerConfigPath() {
  return path.join(runnerRoot, "runner.config.local.json");
}

async function writeRunnerConfig(input) {
  const current = await readRunnerConfig();
  const nextValue = {
    ...current.value,
  };

  if (input.toolkitPath !== undefined) {
    if (input.toolkitPath.trim()) {
      nextValue.toolkitPath = input.toolkitPath.trim();
    } else {
      delete nextValue.toolkitPath;
    }
  }

  delete nextValue.workspaceRoot;

  await fs.writeFile(
    getWritableRunnerConfigPath(),
    JSON.stringify(nextValue, null, 2),
    "utf8",
  );

  return nextValue;
}

function getToolkitPath(runnerConfig) {
  const configuredPath =
    process.env.CGE_TOOLKIT_PATH ?? runnerConfig.value.toolkitPath ?? null;

  if (configuredPath) {
    return path.resolve(runnerRoot, configuredPath);
  }

  return embeddedToolkitPath;
}

function getWorkspaceRoot() {
  return defaultWorkspaceRoot;
}

async function discoverPlugins(toolkitPath) {
  const pluginsRoot = path.join(toolkitPath, "plugins");
  if (!(await pathExists(pluginsRoot))) {
    return [];
  }

  const pluginDirs = await findPluginDirectories(pluginsRoot);
  const plugins = await Promise.all(
    pluginDirs.map((pluginDir) => readPluginManifest(toolkitPath, pluginDir)),
  );
  return plugins
    .filter((plugin) => plugin.commands.length > 0)
    .sort((left, right) => left.label.localeCompare(right.label));
}

async function findPluginDirectories(rootPath) {
  const directories = [];

  async function walk(currentPath) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    if (
      entries.some((entry) => entry.isDirectory() && entry.name === "commands")
    ) {
      directories.push(currentPath);
      return;
    }

    await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => walk(path.join(currentPath, entry.name))),
    );
  }

  await walk(rootPath);
  return directories;
}

async function readPluginManifest(toolkitPath, pluginDir) {
  const commandsDir = path.join(pluginDir, "commands");
  const commandFiles = await fs.readdir(commandsDir, { withFileTypes: true });
  const pluginId = path.basename(pluginDir);
  const relativePluginPath = path.relative(
    path.join(toolkitPath, "plugins"),
    pluginDir,
  );
  const pathSegments = relativePluginPath.split(path.sep);
  const metadata = inferPluginMetadata(pathSegments, pluginId);

  const commands = await Promise.all(
    commandFiles
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map(async (entry) => {
        const commandId = entry.name.replace(/\.md$/, "");
        const contents = await fs.readFile(
          path.join(commandsDir, entry.name),
          "utf8",
        );
        const frontmatter = parseFrontmatter(contents);
        const runtime = resolveCommandRuntime(pluginId, commandId);
        const form = await resolveCommandForm({
          commandId,
          commandPath: `/${pluginId}:${commandId}`,
          contents,
          formRoot: formOverlayRoot,
          pluginId,
          pluginMetadata: metadata,
        });

        return {
          id: commandId,
          description:
            frontmatter.description ??
            extractFirstParagraph(contents) ??
            humanizeId(commandId),
          executionMode: runtime.executionMode,
          intendedExecutionMode: runtime.intendedExecutionMode,
          runnerSupport: runtime.runnerSupport,
          uiHint: inferCommandUiHint(
            commandId,
            frontmatter.ui_hint ?? frontmatter.result_hint ?? frontmatter.output,
          ),
          form,
        };
      }),
  );

  return {
    id: pluginId,
    label: humanizeId(pluginId),
    type: metadata.type,
    category: metadata.category,
    personas: metadata.personas,
    commands: commands.sort((left, right) => left.id.localeCompare(right.id)),
  };
}

function inferPluginMetadata(pathSegments, pluginId) {
  const joinedPath = pathSegments.join("/");

  if (joinedPath.includes("connectors/")) {
    return { type: "connector", category: "connector", personas: ["engineer"] };
  }

  if (joinedPath.includes("frameworks/")) {
    return { type: "framework", category: "framework", personas: allPersonas };
  }

  if (joinedPath.includes("reporting/")) {
    return { type: "tool", category: "reporting", personas: allPersonas };
  }

  if (joinedPath.includes("dashboards/")) {
    return { type: "tool", category: "dashboard", personas: allPersonas };
  }

  if (joinedPath.includes("transforms/")) {
    return { type: "tool", category: "transform", personas: allPersonas };
  }

  if (joinedPath.includes("programs/")) {
    return { type: "tool", category: "program", personas: allPersonas };
  }

  if (joinedPath.includes("meetings/")) {
    return { type: "tool", category: "meeting", personas: allPersonas };
  }

  if (pluginId === "grc-engineer") {
    return { type: "hub", category: "persona", personas: ["engineer"] };
  }

  if (pluginId === "grc-auditor") {
    return { type: "hub", category: "persona", personas: ["auditor"] };
  }

  if (pluginId === "grc-internal") {
    return { type: "hub", category: "persona", personas: ["internal"] };
  }

  if (pluginId === "grc-tprm") {
    return { type: "hub", category: "persona", personas: ["tprm"] };
  }

  return { type: "tool", category: "tool", personas: allPersonas };
}

function resolveCommandRuntime(pluginId, commandId) {
  const commandPath = `/${pluginId}:${commandId}`;

  if (scriptCommandFactories.has(commandPath)) {
    return {
      executionMode: "script",
      intendedExecutionMode: "script",
      runnerSupport: "ready",
    };
  }

  if (supportedWorkflowCommands.has(commandPath)) {
    return {
      executionMode: "workflow",
      intendedExecutionMode: "workflow",
      runnerSupport: "ready",
    };
  }

  if (plannedWorkflowCommands.has(commandPath)) {
    return {
      executionMode: "unsupported",
      intendedExecutionMode: "workflow",
      runnerSupport: "planned",
    };
  }

  return {
    executionMode: "agent",
    intendedExecutionMode: "agent",
    runnerSupport: "ready",
  };
}

function parseFrontmatter(contents) {
  const match = contents.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    return {};
  }

  return Object.fromEntries(
    match[1]
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separatorIndex = line.indexOf(":");
        if (separatorIndex === -1) {
          return null;
        }

        return [
          line.slice(0, separatorIndex).trim(),
          line
            .slice(separatorIndex + 1)
            .trim()
            .replace(/^['"]|['"]$/g, ""),
        ];
      })
      .filter(Boolean),
  );
}

function extractFirstParagraph(contents) {
  const sanitized = contents
    .replace(/^---\n[\s\S]*?\n---\n?/, "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("```"));

  return sanitized[0] ?? null;
}

function inferCommandUiHint(commandId, declaredHint) {
  const normalizedHint = declaredHint?.trim().toLowerCase();
  const supportedHints = new Set([
    "analysis",
    "assessment",
    "checklist",
    "mapping",
    "plan",
    "policy",
    "config",
    "status",
    "code",
    "score",
    "report",
    "document",
  ]);

  if (normalizedHint && supportedHints.has(normalizedHint)) {
    return normalizedHint;
  }

  if (
    commandId === "setup" ||
    commandId.startsWith("setup") ||
    commandId.endsWith("setup") ||
    commandId.includes("select") ||
    commandId.includes("baseline") ||
    commandId.includes("tailor") ||
    commandId.includes("overlay")
  ) {
    return "config";
  }

  if (commandId.startsWith("status") || commandId.endsWith("status")) {
    return "status";
  }

  if (commandId.includes("score")) {
    return "score";
  }

  if (commandId.includes("checklist")) {
    return "checklist";
  }

  if (commandId.includes("map") || commandId.includes("matrix")) {
    return "mapping";
  }

  if (
    commandId.includes("roadmap") ||
    commandId.includes("plan") ||
    commandId.includes("planner")
  ) {
    return "plan";
  }

  if (commandId.includes("policy") || commandId.includes("ssp") || commandId.includes("soa")) {
    return "policy";
  }

  if (
    commandId === "gap-to-code" ||
    commandId === "generate-implementation" ||
    commandId.startsWith("scaffold-")
  ) {
    return "code";
  }

  if (
    commandId.startsWith("assess") ||
    commandId.includes("assessment") ||
    commandId.includes("gap") ||
    commandId.includes("review") ||
    commandId.includes("validate") ||
    commandId.includes("scan") ||
    commandId.includes("check")
  ) {
    return "assessment";
  }

  if (
    commandId.includes("analyze") ||
    commandId.includes("analysis") ||
    commandId.includes("guidance") ||
    commandId.includes("deep-dive") ||
    commandId.includes("optimize") ||
    commandId.includes("find-conflicts") ||
    commandId.includes("monitor") ||
    commandId.includes("test-control") ||
    commandId.includes("transform-risk")
  ) {
    return "analysis";
  }

  if (
    commandId.includes("summary") ||
    commandId.includes("brief") ||
    commandId.includes("health") ||
    commandId.includes("coverage") ||
    commandId.startsWith("report-")
  ) {
    return "report";
  }

  return "document";
}

const PLUGIN_LABEL_OVERRIDES = {
  "aws-inspector":    "AWS Inspector",
  "cis-controls":     "CIS Controls",
  "cmmc":             "CMMC",
  "csa-ccm":          "CSA CCM",
  "dora":             "DORA",
  "essential8":       "Essential Eight",
  "fedramp-20x":      "FedRAMP 20x",
  "fedramp-rev5":     "FedRAMP Rev 5",
  "fedramp-ssp":      "FedRAMP SSP",
  "gcp-inspector":    "GCP Inspector",
  "gdpr":             "GDPR",
  "github-inspector": "GitHub Inspector",
  "glba":             "GLBA",
  "grc-auditor":      "GRC Auditor",
  "grc-engineer":     "GRC Engineer",
  "grc-internal":     "GRC Internal",
  "grc-tprm":         "GRC TPRM",
  "hitrust":          "HITRUST",
  "irap":             "IRAP",
  "ismap":            "ISMAP",
  "iso27001":         "ISO 27001",
  "nist-800-53":      "NIST 800-53",
  "nydfs":            "NYDFS",
  "okta-inspector":   "Okta Inspector",
  "oscal":            "OSCAL",
  "pbmm":             "PBMM",
  "pci-dss":          "PCI DSS",
  "singapore-pdpa":   "Singapore PDPA",
  "soc2":             "SOC 2",
  "stateramp":        "StateRAMP",
  "us-export":        "US Export",
};

function humanizeId(value) {
  if (PLUGIN_LABEL_OVERRIDES[value]) {
    return PLUGIN_LABEL_OVERRIDES[value];
  }
  return value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function readConnectorSummaries() {
  await fs.mkdir(path.join(roots.configRoot, "connectors"), {
    recursive: true,
  });
  await fs.mkdir(path.join(roots.cacheRoot, "findings"), { recursive: true });

  return Promise.all(
    knownConnectors.map(async (connector) => {
      const configPath = path.join(
        roots.configRoot,
        "connectors",
        connector.configFile ?? `${connector.id}.yaml`,
      );
      const cachePath = path.join(roots.cacheRoot, "findings", connector.cacheDir ?? connector.id);

      return {
        id: connector.id,
        label: connector.label,
        configured: await pathExists(configPath),
        findingsCached: await countJsonFiles(cachePath),
        configPath,
        cachePath,
      };
    }),
  );
}

async function readRuns(workspace) {
  await fs.mkdir(workspace.folders.runs, { recursive: true });
  const entries = await fs.readdir(workspace.folders.runs, {
    withFileTypes: true,
  });
  const runs = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => readRun(workspace, entry.name)),
  );

  return runs
    .filter(Boolean)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

async function readRun(workspace, runId) {
  try {
    const contents = await fs.readFile(
      path.join(workspace.folders.runs, runId, "run.json"),
      "utf8",
    );
    return JSON.parse(contents);
  } catch {
    return null;
  }
}

async function readRunEvents(workspace, runId) {
  try {
    const contents = await fs.readFile(
      path.join(workspace.folders.runs, runId, "events.jsonl"),
      "utf8",
    );

    return contents
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

async function readArtifacts(workspace) {
  const runs = await readRuns(workspace);

  return runs
    .flatMap((run) => run.artifacts ?? [])
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

async function readArtifact(workspace, artifactId) {
  const artifacts = await readArtifacts(workspace);
  return artifacts.find((artifact) => artifact.id === artifactId) ?? null;
}

async function createCommandRun(input) {
  await fs.mkdir(input.workspace.folders.runs, { recursive: true });
  await fs.mkdir(input.workspace.folders.artifactsGenerated, {
    recursive: true,
  });

  const parsed = parsePrompt(input.prompt);
  if (!parsed) {
    throw new Error("invalid_command_prompt");
  }
  const persistedPrompt =
    typeof input.redactedPrompt === "string" && input.redactedPrompt.trim()
      ? input.redactedPrompt.trim()
      : redactPromptSecrets(input.prompt);
  const persistedParsed = parsePrompt(persistedPrompt) ?? parsed;

  const now = new Date().toISOString();
  const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const runDirectory = path.join(input.workspace.folders.runs, runId);
  const runArtifactsDir = path.join(
    input.workspace.folders.artifactsGenerated,
    runId,
  );
  const execution = resolveCommandExecution({
    parsed,
    prompt: input.prompt,
    toolkitAvailable: input.toolkitAvailable,
    toolkitPath: input.toolkitPath,
    workspace: input.workspace,
    runId,
    runArtifactsDir,
  });
  const commandPreview = buildCommandPreview({
    execution,
    prompt: persistedPrompt,
    argsOverride: persistedParsed.argumentTokens,
  });

  const run = {
    id: runId,
    status: execution.kind === "script" || execution.kind === "workflow" || execution.kind === "agent"
      ? "running"
      : "failed",
    createdAt: now,
    completedAt:
      execution.kind === "script" || execution.kind === "workflow" || execution.kind === "agent"
        ? null
        : now,
    prompt: persistedPrompt,
    commandPath: parsed.commandPath,
    pluginId: parsed.pluginId,
    commandId: parsed.commandId,
    workspaceId: input.workspace.id,
    workspaceTitle: input.workspace.title,
    runDirectory,
    outputDir: runArtifactsDir,
    commandPreview,
    executionMode: execution.kind,
    artifactCount: 0,
    artifacts: [],
  };

  await persistRunFiles({
    commandPreview,
    prompt: persistedPrompt,
    run,
    runDirectory,
  });

  await appendRunEvent(runDirectory, {
    type: "run.created",
    data: {
      commandPath: parsed.commandPath,
      executionMode: run.executionMode,
      prompt: persistedPrompt,
    },
  });

  if (execution.kind === "workflow") {
    void executeWorkflowRun({
      execution,
      run,
      runDirectory,
      workspace: input.workspace,
      toolkitPath: input.toolkitPath,
    });
    return run;
  }

  if (execution.kind === "agent") {
    void executeAgentRun({
      execution,
      run,
      runDirectory,
      workspace: input.workspace,
    });
    return run;
  }

  if (execution.kind !== "script") {
    await appendRunEvent(runDirectory, {
      type: "run.failed",
      data: {
        message: execution.reason,
      },
    });
    return run;
  }

  void executeCommandRun({
    execution,
    prompt: input.prompt,
    persistedParsed,
    run,
    runDirectory,
    workspace: input.workspace,
  });

  return run;
}

async function resolveCommandDiagnostics(input) {
  const parsed = parsePrompt(input.prompt);
  if (!parsed) {
    return {
      ok: false,
      prompt: input.prompt,
      issues: ["invalid_command_prompt"],
    };
  }

  const execution = resolveCommandExecution({
    parsed,
    prompt: input.prompt,
    toolkitAvailable: input.toolkitAvailable,
    toolkitPath: input.toolkitPath,
    workspace: input.workspace,
    runId: "diagnostic",
    runArtifactsDir: path.join(input.workspace.folders.artifactsGenerated, "diagnostic"),
  });
  const commandPreview = buildCommandPreview({
    execution,
    prompt: input.prompt,
    argsOverride: parsed.argumentTokens,
  });
  const issues = [];
  const details = {
    executionMode: execution.kind,
  };

  if (execution.kind === "unsupported") {
    issues.push(execution.reason);
  }

  if (execution.kind === "script") {
    const [runtimeExists, scriptExists, cwdExists] = await Promise.all([
      commandExists(execution.runtime),
      pathExists(execution.scriptPath),
      pathExists(execution.cwd),
    ]);

    details.runtime = execution.runtime;
    details.scriptPath = execution.scriptPath;
    details.runtimeExists = runtimeExists;
    details.scriptPathExists = scriptExists;
    details.cwd = execution.cwd;
    details.cwdExists = cwdExists;

    if (!runtimeExists) issues.push(`missing_runtime:${execution.runtime}`);
    if (!scriptExists) issues.push(`missing_script:${execution.scriptPath}`);
  } else if (execution.kind === "workflow") {
    details.handlerId = execution.handlerId;
    details.workflowType = execution.workflowType;
  } else if (execution.kind === "agent") {
    const claudeArgs = buildClaudeArgs({
      commandPath: execution.commandPath,
      workspacePath: execution.workspacePath,
      args: execution.args,
    });
    const claudeInstalled = await commandExists("claude");

    details.cwd = execution.cwd;
    details.workspacePath = execution.workspacePath;
    details.claudeArgs = claudeArgs;
    details.claudeInstalled = claudeInstalled;

    if (!claudeInstalled) issues.push("missing_runtime:claude");
  }

  return {
    ok: issues.length === 0,
    prompt: input.prompt,
    parsed,
    commandPreview,
    issues,
    details,
  };
}

async function createPlannedRun(input) {
  await fs.mkdir(input.workspace.folders.runs, { recursive: true });
  await fs.mkdir(input.workspace.folders.artifactsGenerated, {
    recursive: true,
  });

  const id = `run-${Date.now()}`;
  const runDirectory = path.join(input.workspace.folders.runs, id);
  const outputDir = path.join(input.workspace.folders.artifactsGenerated, id);
  const commandPreview = input.toolkitPath
    ? buildGapAssessmentCommand({
        toolkitPath: input.toolkitPath,
        frameworks: input.frameworks,
        sources: input.sources,
        outputDir,
      })
    : null;
  const run = {
    id,
    status: "planned",
    createdAt: new Date().toISOString(),
    frameworks: input.frameworks,
    sources: input.sources,
    workspaceId: input.workspace.id,
    workspaceTitle: input.workspace.title,
    runDirectory,
    outputDir,
    commandPreview,
    artifacts: [],
  };

  await persistRunFiles({
    commandPreview,
    prompt: null,
    run,
    runDirectory,
  });

  return run;
}

async function persistRunFiles(input) {
  await fs.mkdir(input.runDirectory, { recursive: true });
  await writeRun(input.runDirectory, input.run);
  await fs.writeFile(
    path.join(input.runDirectory, "prompt.txt"),
    input.prompt ?? "",
    "utf8",
  );
  await fs.writeFile(
    path.join(input.runDirectory, "command-preview.txt"),
    input.commandPreview ?? "",
    "utf8",
  );
  await fs.writeFile(path.join(input.runDirectory, "stdout.log"), "", "utf8");
  await fs.writeFile(path.join(input.runDirectory, "stderr.log"), "", "utf8");
  await fs.writeFile(path.join(input.runDirectory, "events.jsonl"), "", "utf8");
}

async function writeRun(runDirectory, run) {
  await fs.writeFile(
    path.join(runDirectory, "run.json"),
    JSON.stringify(run, null, 2),
    "utf8",
  );
}

async function appendRunEvent(runDirectory, event) {
  const record = {
    id: `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    ...event,
  };

  await fs.appendFile(
    path.join(runDirectory, "events.jsonl"),
    `${JSON.stringify(record)}\n`,
    "utf8",
  );

  return record;
}

function resolveCommandExecution(input) {
  if (!input.toolkitAvailable || !input.toolkitPath) {
    return {
      kind: "unsupported",
      reason:
        "The claude-grc-engineering toolkit is not configured. Update the runner configuration before running commands.",
    };
  }

  const scriptFactory = scriptCommandFactories.get(input.parsed.commandPath);
  if (scriptFactory) {
    return scriptFactory(input);
  }

  const workflowExecution = resolveWorkflowExecution(input.parsed);
  if (workflowExecution) {
    return workflowExecution;
  }

  return buildAgentExecution(input);
}

function buildAgentExecution(input) {
  return {
    kind: "agent",
    cwd: input.toolkitPath,
    workspacePath: input.workspace.rootPath,
    commandPath: input.parsed.commandPath,
    args: input.parsed.argumentTokens,
    pluginId: input.parsed.pluginId,
    commandId: input.parsed.commandId,
    outputDir: input.runArtifactsDir,
  };
}

function buildNodeScriptExecution(input, config) {
  const outputDir = input.runArtifactsDir ?? null;
  return {
    kind: "script",
    cwd: outputDir ?? input.toolkitPath,
    outputDir,
    runtime: process.execPath,
    scriptPath: path.join(input.toolkitPath, ...config.scriptPathSegments),
    args: config.args ?? input.parsed.argumentTokens,
    commandPath: input.parsed.commandPath,
    pluginId: input.parsed.pluginId,
    commandId: input.parsed.commandId,
    syncStrategy: config.syncStrategy,
    ...(config.extra ?? {}),
  };
}

function buildShellScriptExecution(input, config) {
  return {
    kind: "script",
    cwd: input.toolkitPath,
    runtime: "bash",
    scriptPath: path.join(input.toolkitPath, ...config.scriptPathSegments),
    args: config.args ?? input.parsed.argumentTokens,
    commandPath: input.parsed.commandPath,
    pluginId: input.parsed.pluginId,
    commandId: input.parsed.commandId,
    syncStrategy: config.syncStrategy,
    ...(config.extra ?? {}),
  };
}

function buildGapAssessmentExecution(input) {
  const reportDir =
    readOptionValue(input.parsed.argumentTokens, "--report-dir") ??
    path.join(input.runArtifactsDir, "gap-assessment");

  return buildNodeScriptExecution(input, {
    scriptPathSegments: ["plugins", "grc-engineer", "scripts", "gap-assessment.js"],
    args: ensureOption(
      ensureOption(
        input.parsed.argumentTokens,
        "--cache-dir",
        input.workspace.folders.findingsRaw,
      ),
      "--report-dir",
      reportDir,
    ),
    syncStrategy: "gap-assessment",
    extra: { reportDir },
  });
}

function buildFedramp20xSyncExecution(input) {
  const mode = input.parsed.argumentTokens[0] ?? null;
  const args = [];

  if (mode === "check") {
    args.push("--check");
  } else if (mode === "force") {
    args.push("--force");
  }

  return buildNodeScriptExecution(input, {
    scriptPathSegments: ["plugins", "frameworks", "fedramp-20x", "scripts", "check-fedramp-updates.js"],
    args,
  });
}

async function executeCommandRun(input) {
  const { execution, run, runDirectory, workspace } = input;
  const stdoutLogPath = path.join(runDirectory, "stdout.log");
  const stderrLogPath = path.join(runDirectory, "stderr.log");
  const stdoutChunks = [];
  const stderrChunks = [];
  const streamWrites = [];
  let finalized = false;

  await appendRunEvent(runDirectory, {
    type: "run.started",
    data: {
      commandPreview: run.commandPreview,
      cwd: execution.cwd,
    },
  });
  await appendRunEvent(runDirectory, {
    type: "tool.started",
    data: {
      command: execution.runtime,
      args: [
        execution.scriptPath,
        ...(input.persistedParsed?.argumentTokens ?? execution.args),
      ],
      cwd: execution.cwd,
    },
  });

  await fs.mkdir(execution.cwd, { recursive: true });

  const child = spawn(
    execution.runtime,
    [execution.scriptPath, ...execution.args],
    {
      cwd: execution.cwd,
      detached: process.platform !== "win32",
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  const unregisterChild = registerRunChild(run.id, child);
  child.once("close", unregisterChild);
  child.stdin.end();

  const forwardStreamChunk = (streamName, targetPath, chunks) => async (chunk) => {
    const text = chunk.toString("utf8");
    chunks.push(text);
    await Promise.all([
      fs.appendFile(targetPath, text, "utf8"),
      appendRunEvent(runDirectory, {
        type: streamName === "stdout" ? "tool.stdout" : "tool.stderr",
        data: {
          stream: streamName,
          text,
        },
      }),
    ]);
  };

  child.stdout.on("data", (chunk) => {
    const write = forwardStreamChunk("stdout", stdoutLogPath, stdoutChunks)(chunk);
    streamWrites.push(write);
    void write.finally(() => {
      const index = streamWrites.indexOf(write);
      if (index >= 0) {
        streamWrites.splice(index, 1);
      }
    });
  });
  child.stderr.on("data", (chunk) => {
    const write = forwardStreamChunk("stderr", stderrLogPath, stderrChunks)(chunk);
    streamWrites.push(write);
    void write.finally(() => {
      const index = streamWrites.indexOf(write);
      if (index >= 0) {
        streamWrites.splice(index, 1);
      }
    });
  });

  child.on("error", (error) => {
    if (finalized) {
      return;
    }

    finalized = true;
    void Promise.allSettled(streamWrites).then(() =>
      finalizeCommandRun({
        errorMessage: isRunCanceled(run.id) ? undefined : error.message,
        execution,
        exitCode: null,
        run,
        runDirectory,
        status: isRunCanceled(run.id) ? "canceled" : "failed",
        stdoutText: stdoutChunks.join(""),
        stderrText: stderrChunks.join(""),
        workspace,
      }),
    );
  });

  child.on("close", (exitCode) => {
    if (finalized) {
      return;
    }

    finalized = true;
    void Promise.allSettled(streamWrites).then(() =>
      finalizeCommandRun({
        execution,
        exitCode,
        run,
        runDirectory,
        status: isRunCanceled(run.id)
          ? "canceled"
          : classifyRunStatus(execution, exitCode),
        stdoutText: stdoutChunks.join(""),
        stderrText: stderrChunks.join(""),
        workspace,
      }),
    );
  });
}

async function executeWorkflowRun(input) {
  const result = await workflowRuntime.executeWorkflowRun(input);
  const nextRun = await readRun(input.workspace, input.run.id);
  if (nextRun?.status === "completed") {
    await materializeWorkspaceMetrics(input.workspace, {
      runId: input.run.id,
      sourceRef: input.run.commandPath,
    });
  }
  return result;
}

async function executeStep({ commandPath, args, stepIndex, runId, runDirectory, workspace, toolkitPath }) {
  const prompt = [commandPath, ...args].join(" ");
  const parsed = parsePrompt(prompt);
  if (!parsed) {
    throw new Error(`Cannot parse step command: ${commandPath}`);
  }

  const stepArtifactsDir = path.join(
    workspace.folders.artifactsGenerated,
    `${runId}-step-${stepIndex}`,
  );
  await fs.mkdir(stepArtifactsDir, { recursive: true });

  const execution = resolveCommandExecution({
    parsed,
    toolkitAvailable: Boolean(toolkitPath),
    toolkitPath,
    workspace,
    runArtifactsDir: stepArtifactsDir,
    runId,
  });

  if (execution.kind === "script") {
    await appendRunEvent(runDirectory, {
      type: "tool.started",
      data: { command: commandPath, args, cwd: execution.cwd },
    });

    await fs.mkdir(execution.cwd, { recursive: true });

    const stdoutChunks = [];
    const stderrChunks = [];

    return new Promise((resolve, reject) => {
      const child = spawn(execution.runtime, [execution.scriptPath, ...execution.args], {
        cwd: execution.cwd,
        detached: process.platform !== "win32",
        env: process.env,
        stdio: ["pipe", "pipe", "pipe"],
      });
      const unregisterChild = registerRunChild(runId, child);
      child.once("close", unregisterChild);
      child.stdin.end();

      child.stdout.on("data", (chunk) => {
        const text = chunk.toString("utf8");
        stdoutChunks.push(text);
        void appendRunEvent(runDirectory, { type: "tool.stdout", data: { stream: "stdout", text } });
      });

      child.stderr.on("data", (chunk) => {
        const text = chunk.toString("utf8");
        stderrChunks.push(text);
        void appendRunEvent(runDirectory, { type: "tool.stderr", data: { stream: "stderr", text } });
      });

      child.on("error", reject);

      child.on("close", async (exitCode) => {
        const stdoutText = stdoutChunks.join("");
        const status = isRunCanceled(runId)
          ? "canceled"
          : classifyRunStatus(execution, exitCode);

        await appendRunEvent(runDirectory, {
          type: "tool.completed",
          data: { exitCode, status },
        });

        const artifacts = status === "completed"
          ? await collectRunArtifacts({
              commandPath,
              commandId: parsed.commandId,
              execution,
              runId,
              stdoutText,
              workspace,
            })
          : [];

        resolve({ status, artifacts, stdoutText, exitCode });
      });
    });
  }

  if (execution.kind === "agent") {
    await fs.mkdir(path.join(workspace.rootPath, "grc-reports"), { recursive: true });

    await appendRunEvent(runDirectory, {
      type: "tool.started",
      data: { command: "claude", args: [commandPath, ...args], cwd: execution.cwd },
    });

    // Read command documentation to include in system prompt
    const commandDoc = await readCommandDoc(toolkitPath, parsed.pluginId, parsed.commandId);

    const claudeArgs = buildClaudeArgs({
      commandPath: execution.commandPath,
      workspacePath: workspace.rootPath,
      args: execution.args,
      commandDoc,
    });

    const startedAt = new Date();

    return new Promise((resolve) => {
      const child = spawn("claude", claudeArgs, {
        cwd: execution.cwd,
        detached: process.platform !== "win32",
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      });
      const unregisterChild = registerRunChild(runId, child);
      child.once("close", unregisterChild);

      let stdoutBuffer = "";
      let pendingText = "";
      let resolved = false;
      const conversationLog = [];

      const flushPendingText = async () => {
        const text = pendingText.trim();
        if (!text) return;
        conversationLog.push(text);
        pendingText = "";
        await appendRunEvent(runDirectory, {
          type: "message",
          data: { role: "assistant", text },
        });
      };

      const processLine = async (line) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        let event;
        try { event = JSON.parse(trimmed); } catch { return; }

        if (event.type === "assistant") {
          for (const block of event.message?.content ?? []) {
            if (block.type === "text" && block.text) {
              pendingText += (pendingText ? "\n" : "") + block.text;
            } else if (block.type === "tool_use") {
              await flushPendingText();
              await appendRunEvent(runDirectory, {
                type: "tool.started",
                data: { command: block.name, args: [], cwd: workspace.rootPath },
              });
            }
          }
        }

        if (event.type === "result" && !resolved) {
          resolved = true;
          await flushPendingText();
          if (isRunCanceled(runId)) {
            await appendRunEvent(runDirectory, {
              type: "tool.completed",
              data: { exitCode: 130, status: "canceled" },
            });
            resolve({ status: "canceled", artifacts: [], exitCode: 130 });
            return;
          }
          const isSuccess = event.subtype === "success" && !event.is_error;
          const completedAt = new Date().toISOString();

          let artifacts = [];
          if (isSuccess) {
            // Ensure output directory exists and collect artifacts
            await fs.mkdir(execution.outputDir, { recursive: true });
            artifacts = await collectAgentOutputArtifacts({
              commandId: parsed.commandId,
              commandPath,
              execution,
              runId,
              workspace,
              startedAt,
            });

            if (artifacts.length === 0 && conversationLog.length > 0) {
              const artifactPath = path.join(execution.outputDir, "output.md");
              const content = conversationLog.join("\n\n---\n\n");
              await fs.writeFile(artifactPath, content, "utf8");

              artifacts = [createArtifactSummary({
                commandId: parsed.commandId,
                commandPath,
                createdAt: completedAt,
                format: "markdown",
                kind: "report",
                path: artifactPath,
                pluginId: parsed.pluginId,
                runId,
                title: `${commandPath} Output`,
              })];
            }

            // Collect program data artifacts (grc-data/ files modified during this step)
            const programArtifacts = await collectProgramDataArtifacts({
              commandId: parsed.commandId,
              commandPath,
              startedAt,
              runId,
              workspace,
            });
            artifacts = [...artifacts, ...programArtifacts];
          }

          await appendRunEvent(runDirectory, {
            type: "tool.completed",
            data: { exitCode: isSuccess ? 0 : 1, status: isSuccess ? "completed" : "failed" },
          });
          resolve({ status: isSuccess ? "completed" : "failed", artifacts, exitCode: isSuccess ? 0 : 1 });
        }
      };

      let stdoutQueue = Promise.resolve();
      child.stdout.on("data", (chunk) => {
        stdoutQueue = stdoutQueue.then(async () => {
          stdoutBuffer += chunk.toString("utf8");
          const lines = stdoutBuffer.split("\n");
          stdoutBuffer = lines.pop() ?? "";
          for (const line of lines) await processLine(line);
        });
      });

      child.stderr.on("data", async (chunk) => {
        const text = chunk.toString("utf8").trim();
        if (text) {
          await appendRunEvent(runDirectory, { type: "tool.stderr", data: { stream: "stderr", text } });
        }
      });

      child.on("close", async (exitCode) => {
        await stdoutQueue;
        if (stdoutBuffer.trim()) await processLine(stdoutBuffer);
        await flushPendingText();
        if (!resolved) {
          resolved = true;
          if (isRunCanceled(runId)) {
            await appendRunEvent(runDirectory, {
              type: "tool.completed",
              data: { exitCode: code ?? 130, status: "canceled" },
            });
            resolve({ status: "canceled", artifacts: [], exitCode: code ?? 130 });
            return;
          }
          const isSuccess = exitCode === 0;
          const completedAt = new Date().toISOString();

          if (isSuccess) {
            // Process exited successfully but no result event was received
            await fs.mkdir(execution.outputDir, { recursive: true });

            let artifacts = await collectAgentOutputArtifacts({
              commandId: parsed.commandId,
              commandPath,
              execution,
              runId,
              workspace,
              startedAt,
            });

            if (artifacts.length === 0 && conversationLog.length > 0) {
              const artifactPath = path.join(execution.outputDir, "output.md");
              const content = conversationLog.join("\n\n---\n\n");
              await fs.writeFile(artifactPath, content, "utf8");

              artifacts = [createArtifactSummary({
                commandId: parsed.commandId,
                commandPath,
                createdAt: completedAt,
                format: "markdown",
                kind: "report",
                path: artifactPath,
                pluginId: parsed.pluginId,
                runId,
                title: `${commandPath} Output`,
              })];
            }

            // Collect program data artifacts
            const programArtifacts = await collectProgramDataArtifacts({
              commandId: parsed.commandId,
              commandPath,
              startedAt,
              runId,
              workspace,
            });
            artifacts = [...artifacts, ...programArtifacts];

            await appendRunEvent(runDirectory, {
              type: "tool.completed",
              data: { exitCode: 0, status: "completed" },
            });
            resolve({ status: "completed", artifacts, exitCode: 0 });
          } else {
            await appendRunEvent(runDirectory, {
              type: "tool.completed",
              data: { exitCode, status: "failed" },
            });
            resolve({ status: "failed", artifacts: [], exitCode: exitCode ?? 1 });
          }
        }
      });
    });
  }

  throw new Error(`Pipeline step ${commandPath} resolved to unsupported kind: ${execution.kind}`);
}

async function finalizeCommandRun(input) {
  const completionTime = new Date().toISOString();
  const nextRun = {
    ...input.run,
    status: input.status,
    completedAt: completionTime,
  };

  if (input.status === "canceled") {
    await appendRunEvent(input.runDirectory, {
      type: "tool.completed",
      data: {
        exitCode: input.exitCode,
        status: "canceled",
      },
    });
    await recordRunCanceled({
      run: nextRun,
      runDirectory: input.runDirectory,
    });
    return;
  }

  let artifacts =
    input.status === "completed"
      ? await collectRunArtifacts({
          commandPath: input.run.commandPath,
          commandId: input.run.commandId,
          execution: input.execution,
          runId: input.run.id,
          stdoutText: input.stdoutText,
          workspace: input.workspace,
        })
      : [];

  // Collect program data artifacts (grc-data/ files modified during this run)
  if (input.status === "completed") {
    const programArtifacts = await collectProgramDataArtifacts({
      commandId: input.run.commandId,
      commandPath: input.run.commandPath,
      execution: input.execution,
      runId: input.run.id,
      startedAt: input.run.createdAt,
      workspace: input.workspace,
    });
    artifacts = [...artifacts, ...programArtifacts];
  }

  // When a script produces no files but has stdout output, capture it as a text artifact
  if (artifacts.length === 0 && input.status === "completed" && input.stdoutText?.trim()) {
    const outputDir = input.execution.outputDir ?? input.run.outputDir;
    if (outputDir) {
      await fs.mkdir(outputDir, { recursive: true });
      const artifactPath = path.join(outputDir, "output.txt");
      await fs.writeFile(artifactPath, input.stdoutText, "utf8");

      artifacts = [createArtifactSummary({
        commandId: input.run.commandId,
        commandPath: input.run.commandPath,
        createdAt: completionTime,
        format: "text",
        kind: "report",
        path: artifactPath,
        pluginId: input.execution.pluginId ?? input.run.pluginId,
        runId: input.run.id,
        title: input.run.commandPath ? `${input.run.commandPath} Output` : "Command Output",
      })];
    }
  }

  nextRun.artifacts = artifacts;
  nextRun.artifactCount = artifacts.length;

  await appendRunEvent(input.runDirectory, {
    type: "tool.completed",
    data: {
      exitCode: input.exitCode,
      status: input.status,
    },
  });

  for (const artifact of artifacts) {
    await appendRunEvent(input.runDirectory, {
      type: "artifact.created",
      data: {
        artifactId: artifact.id,
        title: artifact.title,
        kind: artifact.kind,
        format: artifact.format,
        path: artifact.path,
      },
    });
  }

  if (input.status === "completed") {
    await appendRunEvent(input.runDirectory, {
      type: "run.completed",
      data: {
        artifactCount: artifacts.length,
        exitCode: input.exitCode,
      },
    });
    await materializeWorkspaceMetrics(input.workspace, {
      runId: input.run.id,
      sourceRef: input.run.commandPath,
    });
  } else {
    await appendRunEvent(input.runDirectory, {
      type: "run.failed",
      data: {
        exitCode: input.exitCode,
        message:
          input.errorMessage ??
          summarizeFailure(input.stderrText) ??
          "The command failed before producing tracked artifacts.",
      },
    });
  }

  await writeRun(input.runDirectory, nextRun);
}

async function respondToWorkflowRun(input) {
  return workflowRuntime.respondToWorkflowRun(input);
}

async function executeAgentRun(input) {
  const { execution, run, runDirectory, workspace } = input;
  const startedAt = new Date();

  await fs.mkdir(path.join(workspace.rootPath, "grc-reports"), { recursive: true });

  await appendRunEvent(runDirectory, {
    type: "run.started",
    data: { commandPreview: run.commandPreview },
  });

  // Read command documentation to include in system prompt
  const commandDoc = await readCommandDoc(execution.cwd, execution.pluginId, execution.commandId);
  console.log('[DEBUG] executeAgentRun commandDoc:', { 
    pluginId: execution.pluginId, 
    commandId: execution.commandId, 
    hasDoc: !!commandDoc, 
    docLength: commandDoc?.length 
  });

  const claudeArgs = buildClaudeArgs({
    commandPath: execution.commandPath,
    workspacePath: workspace.rootPath,
    args: execution.args,
    commandDoc,
  });
  console.log('[DEBUG] commandDoc truthy:', !!commandDoc, 'length:', commandDoc?.length);
  console.log('[DEBUG] userPrompt starts with:', claudeArgs[claudeArgs.length - 1].substring(0, 50));

  const child = spawn("claude", claudeArgs, {
    cwd: execution.cwd,
    detached: process.platform !== "win32",
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const unregisterChild = registerRunChild(run.id, child);
  child.once("close", unregisterChild);

  let stdoutBuffer = "";
  let pendingText = "";
  let completedAt = null;
  let exitCode = null;
  const conversationLog = [];

  const flushPendingText = async () => {
    const text = pendingText.trim();
    if (!text) return;
    conversationLog.push(text);
    pendingText = "";
    await appendRunEvent(runDirectory, {
      type: "message",
      data: { role: "assistant", text },
    });
  };

  const processLine = async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let event;
    try {
      event = JSON.parse(trimmed);
    } catch {
      return;
    }

    if (event.type === "assistant") {
      const content = event.message?.content ?? [];
      for (const block of content) {
        if (block.type === "text" && block.text) {
          pendingText += (pendingText ? "\n" : "") + block.text;
        } else if (block.type === "tool_use") {
          await flushPendingText();
          await appendRunEvent(runDirectory, {
            type: "tool.started",
            data: { command: block.name, args: [], cwd: workspace.rootPath },
          });
        }
      }
    }

    if (event.type === "result") {
      await flushPendingText();
      if (isRunCanceled(run.id)) {
        completedAt = new Date().toISOString();
        await recordRunCanceled({
          run,
          runDirectory,
        });
        return;
      }
      completedAt = new Date().toISOString();

      const isSuccess = event.subtype === "success" && !event.is_error;

      if (isSuccess) {
        // Ensure output directory exists
        await fs.mkdir(execution.outputDir, { recursive: true });

        // Collect artifacts from both outputDir and workspace directories
        let artifacts = await collectAgentOutputArtifacts({
          commandId: run.commandId,
          commandPath: run.commandPath,
          execution,
          runId: run.id,
          workspace,
          startedAt,
        });

        if (artifacts.length === 0 && conversationLog.length > 0) {
          const artifactPath = path.join(execution.outputDir, "output.md");
          const content = conversationLog.join("\n\n---\n\n");
          await fs.writeFile(artifactPath, content, "utf8");

          artifacts = [createArtifactSummary({
            commandId: run.commandId,
            commandPath: run.commandPath,
            createdAt: completedAt,
            format: "markdown",
            kind: "report",
            path: artifactPath,
            pluginId: run.pluginId,
            runId: run.id,
            title: run.commandPath ? `${run.commandPath} Output` : "Command Output",
          })];
        }

        // Collect program data artifacts (grc-data/ files modified during this run)
        const programArtifacts = await collectProgramDataArtifacts({
          commandId: run.commandId,
          commandPath: run.commandPath,
          startedAt,
          runId: run.id,
          workspace,
        });
        artifacts = [...artifacts, ...programArtifacts];

        const nextRun = {
          ...run,
          artifacts,
          artifactCount: artifacts.length,
          completedAt,
          status: "completed",
        };

        for (const artifact of artifacts) {
          await appendRunEvent(runDirectory, {
            type: "artifact.created",
            data: {
              artifactId: artifact.id,
              title: artifact.title,
              kind: artifact.kind,
              format: artifact.format,
              path: artifact.path,
            },
          });
        }

        await appendRunEvent(runDirectory, {
          type: "run.completed",
          data: { artifactCount: artifacts.length, exitCode: 0 },
        });

        await materializeWorkspaceMetrics(workspace, {
          runId: run.id,
          sourceRef: run.commandPath,
        });

        await writeRun(runDirectory, nextRun);
      } else {
        const message =
          event.result ?? event.message ?? event.error ?? `Agent exited with subtype: ${event.subtype}`;

        await appendRunEvent(runDirectory, {
          type: "run.failed",
          data: { message },
        });

        await writeRun(runDirectory, {
          ...run,
          completedAt,
          status: "failed",
        });
      }
    }
  };

  let stdoutQueue = Promise.resolve();
  child.stdout.on("data", (chunk) => {
    stdoutQueue = stdoutQueue.then(async () => {
      stdoutBuffer += chunk.toString("utf8");
      const lines = stdoutBuffer.split("\n");
      stdoutBuffer = lines.pop() ?? "";
      for (const line of lines) {
        await processLine(line);
      }
    });
  });

  child.stderr.on("data", async (chunk) => {
    const text = chunk.toString("utf8").trim();
    if (text) {
      await appendRunEvent(runDirectory, {
        type: "tool.stderr",
        data: { text },
      });
    }
  });

  child.on("close", async (code) => {
    await stdoutQueue;
    exitCode = code;
    if (stdoutBuffer.trim()) {
      await processLine(stdoutBuffer);
    }
    await flushPendingText();

    if (!completedAt) {
      completedAt = new Date().toISOString();
      if (isRunCanceled(run.id)) {
        await recordRunCanceled({
          run,
          runDirectory,
        });
        return;
      }
      const isSuccess = code === 0;

      if (isSuccess) {
        // Process exited successfully but no result event was received
        // Use outputDir pattern to collect artifacts
        await fs.mkdir(execution.outputDir, { recursive: true });

        let artifacts = await collectAgentOutputArtifacts({
          commandId: run.commandId,
          commandPath: run.commandPath,
          execution,
          runId: run.id,
          workspace,
          startedAt,
        });

        if (artifacts.length === 0 && conversationLog.length > 0) {
          const artifactPath = path.join(execution.outputDir, "output.md");
          const content = conversationLog.join("\n\n---\n\n");
          await fs.writeFile(artifactPath, content, "utf8");

          artifacts = [createArtifactSummary({
            commandId: run.commandId,
            commandPath: run.commandPath,
            createdAt: completedAt,
            format: "markdown",
            kind: "report",
            path: artifactPath,
            pluginId: run.pluginId,
            runId: run.id,
            title: run.commandPath ? `${run.commandPath} Output` : "Command Output",
          })];
        }

        // Collect program data artifacts (grc-data/ files modified during this run)
        const programArtifacts = await collectProgramDataArtifacts({
          commandId: run.commandId,
          commandPath: run.commandPath,
          startedAt,
          runId: run.id,
          workspace,
        });
        artifacts = [...artifacts, ...programArtifacts];

        const nextRun = {
          ...run,
          artifacts,
          artifactCount: artifacts.length,
          completedAt,
          status: "completed",
        };

        for (const artifact of artifacts) {
          await appendRunEvent(runDirectory, {
            type: "artifact.created",
            data: {
              artifactId: artifact.id,
              title: artifact.title,
              kind: artifact.kind,
              format: artifact.format,
              path: artifact.path,
            },
          });
        }

        await appendRunEvent(runDirectory, {
          type: "run.completed",
          data: { artifactCount: artifacts.length, exitCode: 0 },
        });

        await materializeWorkspaceMetrics(workspace, {
          runId: run.id,
          sourceRef: run.commandPath,
        });

        await writeRun(runDirectory, nextRun);
      } else {
        const message = `Agent process exited with code ${code}.`;

        await appendRunEvent(runDirectory, {
          type: "run.failed",
          data: { message },
        });

        await writeRun(runDirectory, {
          ...run,
          completedAt,
          status: "failed",
        });
      }
    }
  });
}

function classifyRunStatus(execution, exitCode) {
  if (execution.syncStrategy === "github-inspector-collect") {
    return exitCode === 0 || exitCode === 4 ? "completed" : "failed";
  }

  return exitCode === 0 ? "completed" : "failed";
}

async function collectRunArtifacts(input) {
  if (input.execution.syncStrategy === "github-inspector-collect") {
    return collectGithubInspectorArtifacts(input);
  }

  if (input.execution.syncStrategy === "aws-inspector-collect") {
    return collectConnectorInspectorArtifacts(input, "aws-inspector");
  }

  if (input.execution.syncStrategy === "gcp-inspector-collect") {
    return collectConnectorInspectorArtifacts(input, "gcp-inspector");
  }

  if (input.execution.syncStrategy === "okta-inspector-collect") {
    return collectConnectorInspectorArtifacts(input, "okta-inspector");
  }

  if (input.execution.syncStrategy === "gap-assessment") {
    return collectGapAssessmentArtifacts(input);
  }

  if (input.execution.outputDir) {
    return collectOutputDirArtifacts(input);
  }

  return [];
}

async function collectOutputDirArtifacts(input) {
  const outputDir = input.execution.outputDir;
  const artifacts = [];
  const completedAt = new Date().toISOString();

  const knownExtensions = new Set([".md", ".json", ".yaml", ".yml", ".txt", ".rego", ".sentinel", ".py", ".tf"]);

  let entries;
  try {
    entries = await fs.readdir(outputDir, { withFileTypes: true });
  } catch {
    return [];
  }

  for (const entry of entries) {
    if (!entry.isFile()) continue;

    const ext = path.extname(entry.name).toLowerCase();
    if (!knownExtensions.has(ext)) continue;

    const filePath = path.join(outputDir, entry.name);
    const format = ext === ".md" ? "markdown"
      : ext === ".json" ? "json"
      : ext === ".yaml" || ext === ".yml" ? "yaml"
      : "text";

    const kind = entry.name.includes("policy") || ext === ".rego" || ext === ".sentinel" || ext === ".tf" ? "code"
      : entry.name.includes("review") || entry.name.includes("report") ? "report"
      : entry.name.includes("risk") ? "document"
      : "document";

    const title = entry.name
      .replace(/\.[^.]+$/, "")
      .split(/[-_]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

    artifacts.push(createArtifactSummary({
      commandId: input.commandId,
      commandPath: input.commandPath,
      createdAt: completedAt,
      format,
      kind,
      path: filePath,
      pluginId: input.execution.pluginId,
      runId: input.runId,
      title,
    }));
  }

  return artifacts;
}

async function collectAgentOutputArtifacts(input) {
  const { execution, workspace, startedAt, runId, commandId, commandPath } = input;
  const artifacts = [];
  const completedAt = new Date().toISOString();
  const knownExtensions = new Set([".md", ".json", ".yaml", ".yml", ".txt", ".rego", ".sentinel", ".py", ".tf"]);
  const seenPaths = new Set();

  const scanDir = async (dir) => {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const filePath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await scanDir(filePath);
        continue;
      }

      if (!entry.isFile()) continue;
      if (seenPaths.has(filePath)) continue;

      const ext = path.extname(entry.name).toLowerCase();
      if (!knownExtensions.has(ext)) continue;

      // For workspace directories, only include files modified after run started
      if (dir !== execution.outputDir && startedAt) {
        try {
          const stats = await fs.stat(filePath);
          if (stats.mtime < startedAt) continue;
        } catch {
          continue;
        }
      }

      seenPaths.add(filePath);

      const format = ext === ".md" ? "markdown"
        : ext === ".json" ? "json"
        : ext === ".yaml" || ext === ".yml" ? "yaml"
        : "text";

      const baseName = entry.name.toLowerCase();
      const kind = baseName.includes("policy") || ext === ".rego" || ext === ".sentinel" || ext === ".tf" ? "code"
        : baseName.includes("review") || baseName.includes("report") ? "report"
        : baseName.includes("risk") ? "document"
        : "document";

      const title = entry.name
        .replace(/\.[^.]+$/, "")
        .split(/[-_]/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");

      artifacts.push(createArtifactSummary({
        commandId,
        commandPath,
        createdAt: completedAt,
        format,
        kind,
        path: filePath,
        pluginId: input.execution.pluginId,
        runId,
        title,
      }));
    }
  };

  // Scan run-specific outputDir first
  if (execution.outputDir) {
    await scanDir(execution.outputDir);
  }

  // Scan workspace directories where Claude is instructed to write
  await scanDir(path.join(workspace.rootPath, "grc-reports"));
  await scanDir(path.join(workspace.rootPath, "evidence"));

  return artifacts;
}

function buildGapAssessmentCommand(input) {
  const toolkitPathValue = JSON.stringify(input.toolkitPath);
  const outputDirValue = JSON.stringify(input.outputDir);
  const frameworks = input.frameworks.join(",");
  const sources = input.sources.join(",");

  return [
    "node",
    `${toolkitPathValue}/plugins/grc-engineer/scripts/gap-assessment.js`,
    frameworks,
    `--sources=${sources}`,
    `--report-dir=${outputDirValue}`,
  ].join(" ");
}

function buildCommandPreview(input) {
  if (input.execution?.kind === "script") {
    const args = [input.execution.scriptPath, ...(input.argsOverride ?? input.execution.args)]
      .map((value) => JSON.stringify(value))
      .join(" ");

    return `cd ${JSON.stringify(input.execution.cwd)} && ${JSON.stringify(input.execution.runtime)} ${args}`;
  }

  if (input.execution?.kind === "agent") {
    const args = buildClaudeArgs({
      commandPath: input.execution.commandPath,
      workspacePath: input.execution.workspacePath,
      args: input.argsOverride ?? input.execution.args,
    })
      .map((value) => JSON.stringify(value))
      .join(" ");

    return `cd ${JSON.stringify(input.execution.cwd)} && "claude" ${args}`;
  }

  return input.prompt;
}

async function readCommandDoc(toolkitPath, pluginId, commandId) {
  const commandPath = path.join(toolkitPath, "plugins", pluginId, "commands", `${commandId}.md`);
  try {
    return await fs.readFile(commandPath, "utf8");
  } catch {
    return null;
  }
}

function buildClaudeArgs(input) {
  const systemPrompt = buildAgentWorkspaceContext(input.workspacePath, input.commandDoc);
  const userPrompt = buildAgentPrompt(input.commandPath, input.args, input.commandDoc);
  return [
    "--print",
    "--output-format", "stream-json",
    "--verbose",
    "--dangerously-skip-permissions",
    "--add-dir", input.workspacePath,
    "--append-system-prompt", systemPrompt,
    userPrompt,
  ];
}

function buildAgentWorkspaceContext(workspacePath, commandDoc) {
  let context = (
    `Active CGE workspace: ${workspacePath}. ` +
    `Write all output files (reports, assessments, analyses, policies) to paths inside this workspace directory. ` +
    `Use ${workspacePath}/grc-reports/ for generated reports.`
  );

  if (commandDoc) {
    context += `\n\nYou have been given a specific task. Follow the instructions provided in the user prompt precisely.`;
  }

  return context;
}

function buildAgentPrompt(commandPath, args, commandDoc) {
  // If we have command documentation, construct a natural language prompt
  // instead of using the slash command syntax (which Claude doesn't recognize)
  if (commandDoc) {
    const argsText = (args ?? []).join(" ");
    return `Please execute the following task:\n\nCommand: ${commandPath} ${argsText}\n\nInstructions:\n${commandDoc}`;
  }

  // Fallback to slash command syntax for backward compatibility
  return [commandPath, ...(args ?? [])].join(" ");
}

function parsePrompt(prompt) {
  const tokens = tokenizePrompt(prompt);
  const commandToken = tokens[0];
  const match = commandToken?.match(
    /^\/(?<pluginId>[a-z0-9-]+):(?<commandId>[a-z0-9-]+)/i,
  );

  if (!match?.groups || !commandToken) {
    return null;
  }

  return {
    commandPath: commandToken,
    argumentTokens: tokens.slice(1),
    pluginId: match.groups.pluginId,
    commandId: match.groups.commandId,
  };
}

function tokenizePrompt(prompt) {
  const tokens = [];
  let current = "";
  let quote = null;

  for (let index = 0; index < prompt.length; index += 1) {
    const char = prompt[index];

    if (quote) {
      if (char === "\\" && index + 1 < prompt.length) {
        current += prompt[index + 1];
        index += 1;
        continue;
      }

      if (char === quote) {
        quote = null;
        continue;
      }

      current += char;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/u.test(char)) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

function redactPromptSecrets(prompt) {
  const tokens = tokenizePrompt(prompt);

  return tokens
    .map((token) => {
      if (!token.startsWith("--")) {
        return quotePromptToken(token);
      }

      const separatorIndex = token.indexOf("=");
      if (separatorIndex === -1) {
        return quotePromptToken(token);
      }

      const flag = token.slice(0, separatorIndex);
      const value = token.slice(separatorIndex + 1);

      if (!isSensitiveFlag(flag)) {
        return `${flag}=${quotePromptToken(value)}`;
      }

      return `${flag}=[REDACTED]`;
    })
    .join(" ");
}

function isSensitiveFlag(flag) {
  return /(token|secret|password|passphrase|api[-_]?key|access[-_]?key)/i.test(
    flag,
  );
}

function quotePromptToken(value) {
  return /\s/u.test(value) ? JSON.stringify(value) : value;
}

function artifactExtension(outputType) {
  if (outputType === "score") {
    return "json";
  }

  if (outputType === "code") {
    return "txt";
  }

  return "md";
}

function artifactFormat(outputType) {
  if (outputType === "score") {
    return "json";
  }

  if (outputType === "code") {
    return "text";
  }

  return "markdown";
}

async function collectGithubInspectorArtifacts(input) {
  return collectConnectorInspectorArtifacts(input, "github-inspector");
}

async function collectConnectorInspectorArtifacts(input, connectorId) {
  const CONNECTOR_TITLES = {
    "aws-inspector": "AWS Findings Cache",
    "gcp-inspector": "GCP Findings Cache",
    "github-inspector": "GitHub Findings Cache",
    "okta-inspector": "Okta Findings Cache",
  };

  const cachePath =
    parseCollectorCachePath(input.stdoutText) ??
    (await findLatestJsonFile(
      path.join(roots.cacheRoot, "findings", connectorId),
    ));

  if (!cachePath) {
    return [];
  }

  const destinationPath = path.join(
    input.workspace.folders.findingsRawConnectors[connectorId],
    path.basename(cachePath),
  );
  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  await fs.copyFile(cachePath, destinationPath);

  return [
    createArtifactSummary({
      commandId: input.commandId,
      commandPath: input.commandPath,
      createdAt: new Date().toISOString(),
      format: "json",
      kind: "findings",
      path: destinationPath,
      pluginId: connectorId,
      runId: input.runId,
      title: CONNECTOR_TITLES[connectorId] ?? "Findings Cache",
    }),
  ];
}

async function collectGapAssessmentArtifacts(input) {
  const reportDir = input.execution.reportDir;
  if (!(await pathExists(reportDir))) {
    return [];
  }

  const entries = await fs.readdir(reportDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(reportDir, entry.name))
    .sort((left, right) => left.localeCompare(right));

  // Sync findings.normalized.json to workspace for findings tab
  const normalizedSource = path.join(reportDir, 'findings.normalized.json');
  if (await pathExists(normalizedSource)) {
    const normalizedDir = input.workspace.folders.findingsNormalized;
    await fs.mkdir(normalizedDir, { recursive: true });

    // Copy as the single latest file (for findings tab)
    const latestPath = path.join(normalizedDir, 'findings.normalized.json');
    await fs.copyFile(normalizedSource, latestPath);

    // Also copy as versioned artifact (for history in artifacts tab)
    const versionedPath = path.join(normalizedDir, `findings.normalized.${input.runId}.json`);
    await fs.copyFile(normalizedSource, versionedPath);
  }

  return files.map((filePath) =>
    createArtifactSummary({
      commandId: input.commandId,
      commandPath: input.commandPath,
      createdAt: new Date().toISOString(),
      format: detectArtifactFormat(filePath),
      kind: inferGapAssessmentArtifactKind(filePath),
      path: filePath,
      pluginId: input.execution.pluginId,
      runId: input.runId,
      title: humanizeArtifactTitle(filePath),
    }),
  );
}

function createArtifactSummary(input) {
  return {
    id: `artifact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    runId: input.runId,
    title: input.title,
    kind: input.kind,
    format: input.format,
    path: input.path,
    createdAt: input.createdAt,
    commandPath: input.commandPath,
    pluginId: input.pluginId,
    commandId: input.commandId,
  };
}

function detectArtifactFormat(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const baseName = path.basename(filePath).toLowerCase();

  if (
    extension === ".json" ||
    extension === ".sarif" ||
    baseName.endsWith(".oscal-ar")
  ) {
    return "json";
  }

  if (extension === ".txt" || extension === ".log") {
    return "text";
  }

  return "markdown";
}

function inferGapAssessmentArtifactKind(filePath) {
  const baseName = path.basename(filePath).toLowerCase();
  if (baseName.includes("normalized")) {
    return "score";
  }

  return "report";
}

function humanizeArtifactTitle(filePath) {
  const baseName = path.basename(filePath).toLowerCase();
  if (baseName === "findings.normalized.json") {
    return "Normalized Findings";
  }

  if (baseName.startsWith("gap-report.")) {
    return "Gap Assessment Report";
  }

  return humanizeId(path.basename(filePath, path.extname(filePath)));
}

const PROGRAM_ENTITY_KINDS = ["risks", "metrics", "exceptions", "vendors", "policies", "controls"];

const PROGRAM_KIND_LABELS = {
  risks: "Risk Record",
  metrics: "Metric Snapshot",
  exceptions: "Exception Record",
  vendors: "Vendor Record",
  policies: "Policy Record",
  controls: "Control Record",
};

async function collectProgramDataArtifacts(input) {
  const { workspace, runId, commandId, commandPath, startedAt } = input;
  const startTime = startedAt ? new Date(startedAt).getTime() : 0;
  const artifacts = [];

  for (const kind of PROGRAM_ENTITY_KINDS) {
    const dirPath = workspace.folders[`program${kind.charAt(0).toUpperCase()}${kind.slice(1)}`];
    if (!dirPath) continue;

    let entries;
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;

      const filePath = path.join(dirPath, entry.name);
      let stat;
      try {
        stat = await fs.stat(filePath);
      } catch {
        continue;
      }

      if (stat.mtimeMs < startTime) continue;

      artifacts.push(createArtifactSummary({
        commandId,
        commandPath,
        createdAt: stat.mtime.toISOString(),
        format: "json",
        kind: "program",
        path: filePath,
        pluginId: input.execution?.pluginId ?? null,
        runId,
        title: PROGRAM_KIND_LABELS[kind] ?? "Program Record",
      }));
    }
  }

  return artifacts;
}

function ensureOption(tokens, flag, value) {
  const existing = readOptionValue(tokens, flag);
  if (existing !== null) {
    return tokens;
  }

  return [...tokens, `${flag}=${value}`];
}

function readOptionValue(tokens, flag) {
  for (const token of tokens) {
    if (token === flag) {
      return "";
    }

    if (token.startsWith(`${flag}=`)) {
      return token.slice(flag.length + 1);
    }
  }

  return null;
}

function parseCollectorCachePath(stdoutText) {
  try {
    const parsed = JSON.parse(stdoutText);
    return typeof parsed.cache_path === "string" ? parsed.cache_path : null;
  } catch {
    return null;
  }
}

async function findLatestJsonFile(targetDirectory) {
  try {
    const entries = await fs.readdir(targetDirectory, { withFileTypes: true });
    const files = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map(async (entry) => {
          const targetPath = path.join(targetDirectory, entry.name);
          const stats = await fs.stat(targetPath);
          return {
            path: targetPath,
            modifiedAt: stats.mtimeMs,
          };
        }),
    );

    return files.sort((left, right) => right.modifiedAt - left.modifiedAt)[0]?.path ?? null;
  } catch {
    return null;
  }
}

function summarizeFailure(stderrText) {
  const lines = String(stderrText ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return lines[0] ?? null;
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function commandExists(command) {
  return new Promise((resolve) => {
    const proc = spawn("which", [command], { stdio: "ignore" });
    proc.on("close", (code) => resolve(code === 0));
    proc.on("error", () => resolve(false));
  });
}

async function countJsonFiles(targetPath) {
  try {
    const entries = await fs.readdir(targetPath);
    return entries.filter((entry) => entry.endsWith(".json")).length;
  } catch {
    return 0;
  }
}


async function resolveWorkspaceFromRequest(roots, workspaceId, xWorkspaceId) {
  if (workspaceId) {
    return readWorkspace(roots, workspaceId);
  }

  if (xWorkspaceId) {
    return readWorkspace(roots, xWorkspaceId);
  }

  const workspaces = await listWorkspaces(roots);
  return workspaces.length === 1 ? workspaces[0] : null;
}


async function resolveWorkspaceFromBody(roots, body) {
  if (typeof body.workspaceId !== "string" || !body.workspaceId.trim()) {
    return null;
  }

  return readWorkspace(roots, body.workspaceId);
}

function coerceArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item) => typeof item === "string");
}

const FINDING_SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

async function readWorkspaceFindings(workspace) {
  const connectorEntries = Object.entries(
    workspace.folders.findingsRawConnectors ?? {},
  );

  const [connectorGroups, gapGroups] = await Promise.all([
    Promise.all(
      connectorEntries.map(async ([connectorId, connectorDir]) => {
        try {
          const files = await fs.readdir(connectorDir);
          const docGroups = await Promise.all(
            files
              .filter((file) => file.endsWith(".json"))
              .map(async (file) => {
                const filePath = path.join(connectorDir, file);
                try {
                  const content = await fs.readFile(filePath, "utf8");
                  const doc = JSON.parse(content);
                  return normalizeFindingDocument(doc, filePath, connectorId);
                } catch {
                  return [];
                }
              }),
          );
          return docGroups.flat();
        } catch {
          return [];
        }
      }),
    ),
    readNormalizedGapFindings(workspace),
  ]);

  return [...connectorGroups.flat(), ...gapGroups].sort((left, right) => {
    const sl = FINDING_SEVERITY_ORDER[left.severity] ?? 5;
    const sr = FINDING_SEVERITY_ORDER[right.severity] ?? 5;
    if (sl !== sr) return sl - sr;
    const tl = left.assessedAt ?? left.collectedAt ?? "";
    const tr = right.assessedAt ?? right.collectedAt ?? "";
    return tr.localeCompare(tl);
  });
}

async function readNormalizedGapFindings(workspace) {
  const filePath = path.join(
    workspace.folders.findingsNormalized,
    "findings.normalized.json",
  );
  try {
    const content = await fs.readFile(filePath, "utf8");
    const doc = JSON.parse(content);
    return normalizeGapAssessmentDoc(doc, filePath);
  } catch {
    return [];
  }
}

function normalizeGapAssessmentDoc(doc, filePath) {
  if (!doc || typeof doc !== "object") {
    return [];
  }

  const runId = doc.run_id ?? "unknown";
  const tiers = [
    { items: doc.tier1 ?? [], severity: "high" },
    { items: doc.tier2 ?? [], severity: "medium" },
    { items: doc.tier3 ?? [], severity: "low" },
    { items: doc.inconclusive ?? [], severity: "info" },
  ];

  const findings = [];

  for (const { items, severity: tierSeverity } of tiers) {
    for (const item of items) {
      const scfId = item.scf_id ?? null;
      const effectiveSeverity = item.severity ?? tierSeverity;
      const failingResources = Array.isArray(item.failing_resources)
        ? item.failing_resources
        : [];
      const status = Array.isArray(doc.inconclusive) && doc.inconclusive.includes(item)
        ? "inconclusive"
        : "fail";

      if (failingResources.length === 0) {
        const id = deriveFindingId("gap-assessment", runId, null, "SCF", scfId);
        findings.push({
          id,
          title: item.title ?? scfId ?? "Gap Finding",
          severity: effectiveSeverity,
          status,
          source: "gap-assessment",
          resourceType: null,
          resourceId: null,
          resourceRegion: null,
          accountId: null,
          controlFramework: "SCF",
          controlId: scfId,
          message: item.family ? `${item.family} — ${item.title ?? scfId}` : (item.title ?? null),
          collectedAt: null,
          assessedAt: null,
          hasRemediation: false,
          resource: {},
          remediation: null,
          evidenceRefs: [],
          rawAttributes: item.frameworks ?? null,
          metadata: { scf_id: scfId, family: item.family ?? null },
          narrativeFindings: [],
          documentPath: filePath,
        });
      } else {
        for (const resource of failingResources) {
          const resourceId = resource.id ?? resource.resource_id ?? null;
          const id = deriveFindingId("gap-assessment", runId, resourceId, "SCF", scfId);
          findings.push({
            id,
            title: item.title ?? scfId ?? "Gap Finding",
            severity: effectiveSeverity,
            status: resource.status ?? status,
            source: "gap-assessment",
            resourceType: resource.type ?? null,
            resourceId,
            resourceRegion: resource.region ?? null,
            accountId: resource.account_id ?? null,
            controlFramework: "SCF",
            controlId: scfId,
            message: resource.message ?? (item.family ? `${item.family} — ${item.title ?? scfId}` : null),
            collectedAt: resource.collected_at ?? null,
            assessedAt: resource.assessed_at ?? null,
            hasRemediation: false,
            resource,
            remediation: null,
            evidenceRefs: [],
            rawAttributes: item.frameworks ?? null,
            metadata: { scf_id: scfId, family: item.family ?? null },
            narrativeFindings: [],
            documentPath: filePath,
          });
        }
      }
    }
  }

  return findings;
}

const METRIC_SCHEMA_VERSION = "1";

async function readWorkspaceMetrics(workspace) {
  const [commandMetrics, snapshots] = await Promise.all([
    readCommandMetricRecords(workspace),
    readMetricSnapshots(workspace),
  ]);
  const latestSnapshot = snapshots[0] ?? null;
  const workspaceMetrics = latestSnapshot?.metrics ?? [];

  return {
    current: resolveCurrentMetricRecords(workspaceMetrics, commandMetrics),
    snapshots: snapshots.map((snapshot) => ({
      snapshot_id: snapshot.snapshot_id,
      recorded_at: snapshot.recorded_at,
      metric_count: snapshot.metrics.length,
    })),
  };
}

async function materializeWorkspaceMetrics(workspace, options = {}) {
  const recordedAt = new Date().toISOString();
  const metrics = await deriveWorkspaceMetricRecords(workspace, {
    recordedAt,
    sourceRef: options.sourceRef,
    runId: options.runId,
  });
  const snapshotId = toSnapshotId(recordedAt);
  const snapshot = {
    schema_version: METRIC_SCHEMA_VERSION,
    snapshot_id: snapshotId,
    workspace_id: workspace.id,
    recorded_at: recordedAt,
    metrics,
  };

  const snapshotsDir = workspace.folders.programMetricSnapshots;
  await fs.mkdir(snapshotsDir, { recursive: true });
  await fs.writeFile(
    path.join(snapshotsDir, `${snapshotId}.json`),
    JSON.stringify(snapshot, null, 2),
    "utf8",
  );

  return snapshot;
}

async function deriveWorkspaceMetricRecords(workspace, options) {
  const [program, findings, connectors] = await Promise.all([
    readWorkspaceProgram(workspace),
    readWorkspaceFindings(workspace),
    readConnectorSummaries(),
  ]);

  const risks = program.risks ?? [];
  const controls = program.controls ?? [];
  const policies = program.policies ?? [];
  const configuredConnectors = connectors.filter((connector) => connector.configured).length;
  const cachedFindings = connectors.reduce((sum, connector) => sum + connector.findingsCached, 0);
  const implementedControls = controls.filter((control) =>
    ["active", "implemented", "passing", "pass", "monitored"].includes(
      String(control.status ?? "").toLowerCase(),
    ),
  ).length;
  const controlsWithEvidence = controls.filter((control) =>
    Array.isArray(control.evidence_refs) && control.evidence_refs.length > 0,
  ).length;
  const openRisks = risks.filter((risk) => String(risk.status ?? "").toLowerCase() === "open").length;
  const residualScores = risks
    .map((risk) => risk.residual?.score ?? risk.inherent?.score)
    .filter((score) => typeof score === "number" && Number.isFinite(score));
  const activePolicies = policies.filter((policy) => String(policy.status ?? "").toLowerCase() === "active").length;
  const severeFindings = findings.filter((finding) =>
    finding.severity === "critical" || finding.severity === "high",
  ).length;

  const metrics = [
    createWorkspaceMetric("connector.configured_count", configuredConnectors, "count", options),
    createWorkspaceMetric("connector.configured_percent", percentValue(configuredConnectors, connectors.length), "percent", options),
    createWorkspaceMetric("connector.cached_findings_count", cachedFindings, "count", options),
    createWorkspaceMetric("findings.open_count", findings.length, "count", options),
    createWorkspaceMetric("findings.severe_count", severeFindings, "count", options),
    createWorkspaceMetric("risk.open_count", openRisks, "count", options),
    createWorkspaceMetric("control.implemented_percent", percentValue(implementedControls, controls.length), "percent", options),
    createWorkspaceMetric("evidence.coverage", percentValue(controlsWithEvidence, controls.length), "percent", options),
    createWorkspaceMetric("policy.active_percent", percentValue(activePolicies, policies.length), "percent", options),
  ];

  if (residualScores.length > 0) {
    metrics.push(
      createWorkspaceMetric(
        "risk.residual_score_avg",
        averageValue(residualScores),
        "score",
        options,
      ),
    );
  }

  return metrics;
}

function createWorkspaceMetric(metricId, value, unit, options) {
  return normalizeMetricRecord({
    schema_version: METRIC_SCHEMA_VERSION,
    metric_id: metricId,
    value,
    unit,
    source: "workspace",
    sourceRef: options.sourceRef,
    runId: options.runId,
    recorded_at: options.recordedAt,
  });
}

async function readCommandMetricRecords(workspace) {
  const metricsDir = workspace.folders.programMetrics;
  let entries;
  try {
    entries = await fs.readdir(metricsDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const groups = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map(async (entry) => {
        const filePath = path.join(metricsDir, entry.name);
        try {
          const [content, stat] = await Promise.all([
            fs.readFile(filePath, "utf8"),
            fs.stat(filePath),
          ]);
          return extractMetricRecords(JSON.parse(content), {
            recordedAt: stat.mtime.toISOString(),
          });
        } catch {
          return [];
        }
      }),
  );

  return groups.flat();
}

async function readMetricSnapshots(workspace) {
  const snapshotsDir = workspace.folders.programMetricSnapshots;
  let entries;
  try {
    entries = await fs.readdir(snapshotsDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const snapshots = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map(async (entry) => {
        const filePath = path.join(snapshotsDir, entry.name);
        try {
          const content = await fs.readFile(filePath, "utf8");
          const parsed = JSON.parse(content);
          const recordedAt = parsed.recorded_at ?? parsed.recordedAt ?? "";
          const metrics = extractMetricRecords(parsed.metrics ?? [], {
            recordedAt,
            defaultSource: "workspace",
          });
          return {
            schema_version: parsed.schema_version ?? METRIC_SCHEMA_VERSION,
            snapshot_id: parsed.snapshot_id ?? path.basename(entry.name, ".json"),
            workspace_id: parsed.workspace_id ?? workspace.id,
            recorded_at: recordedAt,
            metrics,
          };
        } catch {
          return null;
        }
      }),
  );

  return snapshots
    .filter(Boolean)
    .sort((left, right) => right.recorded_at.localeCompare(left.recorded_at));
}

function extractMetricRecords(value, options = {}) {
  const candidates = Array.isArray(value)
    ? value
    : Array.isArray(value?.metrics)
      ? value.metrics
      : [value];

  return candidates
    .map((candidate) =>
      normalizeMetricRecord(candidate, {
        recordedAt: options.recordedAt,
        defaultSource: options.defaultSource ?? "command",
      }),
    )
    .filter(Boolean);
}

function normalizeMetricRecord(record, options = {}) {
  if (!record || typeof record !== "object") return null;
  if (typeof record.metric_id !== "string" || !record.metric_id.trim()) return null;
  const value = Number(record.value);
  if (!Number.isFinite(value)) return null;

  const source = record.source === "workspace" || record.source === "command"
    ? record.source
    : options.defaultSource ?? "command";

  return {
    schema_version: String(record.schema_version ?? METRIC_SCHEMA_VERSION),
    metric_id: record.metric_id.trim(),
    value,
    unit: typeof record.unit === "string" ? record.unit : null,
    subject: typeof record.subject === "string" ? record.subject : null,
    source,
    sourceRef: typeof record.sourceRef === "string" ? record.sourceRef : null,
    runId: typeof record.runId === "string" ? record.runId : null,
    recorded_at: typeof record.recorded_at === "string"
      ? record.recorded_at
      : options.recordedAt ?? new Date().toISOString(),
    dimensions: record.dimensions && typeof record.dimensions === "object"
      ? record.dimensions
      : null,
    window: typeof record.window === "string" ? record.window : "point-in-time",
  };
}

function resolveCurrentMetricRecords(workspaceMetrics, commandMetrics) {
  const byId = new Map();

  for (const metric of latestMetricsById(commandMetrics)) {
    byId.set(metric.metric_id, metric);
  }

  for (const metric of latestMetricsById(workspaceMetrics)) {
    byId.set(metric.metric_id, metric);
  }

  return [...byId.values()].sort((left, right) => left.metric_id.localeCompare(right.metric_id));
}

function latestMetricsById(metrics) {
  const byId = new Map();
  for (const metric of metrics) {
    const current = byId.get(metric.metric_id);
    if (!current || metric.recorded_at.localeCompare(current.recorded_at) > 0) {
      byId.set(metric.metric_id, metric);
    }
  }
  return [...byId.values()];
}

function percentValue(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function averageValue(values) {
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function toSnapshotId(value) {
  return value.replace(/[:.]/g, "-");
}

async function readWorkspaceProgram(workspace) {
  const dirs = {
    risks: workspace.folders.programRisks,
    metrics: workspace.folders.programMetrics,
    exceptions: workspace.folders.programExceptions,
    vendors: workspace.folders.programVendors,
    policies: workspace.folders.programPolicies,
    controls: workspace.folders.programControls,
  };

  const entityGroups = await Promise.all(
    Object.entries(dirs).map(async ([kind, dir]) => {
      try {
        const files = await fs.readdir(dir);
        const records = await Promise.all(
          files
            .filter((f) => f.endsWith(".json"))
            .map(async (file) => {
              try {
                const content = await fs.readFile(path.join(dir, file), "utf8");
                return JSON.parse(content);
              } catch {
                return null;
              }
            }),
        );
        return [kind, records.filter(Boolean)];
      } catch {
        return [kind, []];
      }
    }),
  );

  return Object.fromEntries(entityGroups);
}

function normalizeFindingDocument(doc, filePath, fallbackSource) {
  if (!doc || !Array.isArray(doc.evaluations)) {
    return [];
  }

  const resource = doc.resource ?? {};
  const source = doc.source ?? fallbackSource;

  return doc.evaluations
    .filter((ev) => ev.status === "fail" || ev.status === "inconclusive")
    .map((ev) => ({
      id: deriveFindingId(
        source,
        doc.run_id,
        resource.id,
        ev.control_framework,
        ev.control_id,
      ),
      title: deriveFindingTitle(ev.message, resource.id, ev.control_id),
      severity: ev.severity ?? "info",
      status: ev.status,
      source,
      resourceType: resource.type ?? null,
      resourceId: resource.id ?? null,
      resourceRegion: resource.region ?? null,
      accountId: resource.account_id ?? null,
      controlFramework: ev.control_framework ?? null,
      controlId: ev.control_id ?? null,
      message: ev.message ?? null,
      collectedAt: doc.collected_at ?? null,
      assessedAt: ev.assessed_at ?? null,
      hasRemediation: Boolean(ev.remediation),
      resource,
      remediation: ev.remediation ?? null,
      evidenceRefs: ev.evidence_refs ?? [],
      rawAttributes: doc.raw_attributes ?? null,
      metadata: doc.metadata ?? null,
      narrativeFindings: doc.findings ?? [],
      documentPath: filePath,
    }));
}

function deriveFindingId(source, runId, resourceId, controlFramework, controlId) {
  return [source, runId, resourceId, controlFramework, controlId]
    .map((p) => String(p ?? "unknown").replace(/[^a-z0-9._-]/gi, "_"))
    .join(":");
}

function deriveFindingTitle(message, resourceId, controlId) {
  if (message) {
    const first = message.split(/[.\n]/)[0].trim();
    return first.length > 80 ? `${first.slice(0, 77)}…` : first;
  }

  if (resourceId && controlId) {
    return `${resourceId} / ${controlId}`;
  }

  return resourceId ?? controlId ?? "Finding";
}
