import { createServer } from "node:http";
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
  "claude-grc-engineering",
);
const allPersonas = ["engineer", "auditor", "internal", "tprm"];

const knownConnectors = [
  { id: "github-inspector", label: "GitHub Inspector" },
  { id: "aws-inspector", label: "AWS Inspector" },
  { id: "gcp-inspector", label: "GCP Inspector" },
  { id: "okta-inspector", label: "Okta Inspector" },
];

const frameworkCatalog = [
  { id: "SOC2", label: "SOC 2", family: "Trust Services" },
  { id: "FedRAMP-Moderate", label: "FedRAMP Moderate", family: "US Federal" },
  { id: "FedRAMP-High", label: "FedRAMP High", family: "US Federal" },
  { id: "NIST-800-53-r5", label: "NIST 800-53 Rev 5", family: "NIST" },
  { id: "ISO-27001-2022", label: "ISO 27001:2022", family: "ISO" },
  { id: "CIS-v8", label: "CIS Controls v8", family: "CIS" },
];

const roots = {
  configRoot: path.join(os.homedir(), ".config", "claude-grc"),
  cacheRoot: path.join(os.homedir(), ".cache", "claude-grc"),
  appDataRoot: path.join(os.homedir(), ".local", "share", "cge-ui"),
};
const defaultWorkspaceRoot = path.join(os.homedir(), "Documents", "CGE Workspaces");
const workflowRuntime = createWorkflowRuntime({
  appendRunEvent,
  createArtifactSummary,
  findLatestJsonFile,
  parsePrompt,
  readRuns,
  writeRun,
});

const server = createServer(async (request, response) => {
  try {
    setCorsHeaders(response);
    const runnerConfig = await readRunnerConfig();
    const toolkitPath = getToolkitPath(runnerConfig);
    const toolkitAvailable = toolkitPath
      ? await pathExists(toolkitPath)
      : false;
    await ensureWorkspaceSystem(roots);

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
    const pathSegments = url.pathname.split("/").filter(Boolean);

    if (request.method === "GET" && url.pathname === "/health") {
      return json(response, 200, {
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
    }

    if (request.method === "GET" && url.pathname === "/config") {
      return json(response, 200, {
        toolkitPath: runnerConfig.value.toolkitPath ?? "",
        workspaceRoot: getWorkspaceRoot(),
        runnerConfigPath: getWritableRunnerConfigPath(),
      });
    }

    if (request.method === "PATCH" && url.pathname === "/config") {
      const body = await readJsonBody(request);
      const nextConfig = await writeRunnerConfig({
        toolkitPath:
          typeof body.toolkitPath === "string" ? body.toolkitPath : undefined,
      });

      return json(response, 200, {
        toolkitPath: nextConfig.toolkitPath ?? "",
        workspaceRoot: getWorkspaceRoot(),
        runnerConfigPath: getWritableRunnerConfigPath(),
      });
    }

    if (request.method === "GET" && url.pathname === "/registry/plugins") {
      const plugins = toolkitAvailable
        ? await discoverPlugins(toolkitPath)
        : [];

      return json(response, 200, {
        plugins,
        source: toolkitAvailable ? "toolkit" : "unconfigured",
        toolkitPath,
      });
    }

    if (request.method === "GET" && url.pathname === "/frameworks") {
      return json(response, 200, frameworkCatalog);
    }

    if (request.method === "GET" && url.pathname === "/connectors") {
      return json(response, 200, await readConnectorSummaries());
    }

    if (request.method === "GET" && url.pathname === "/workspaces") {
      return json(
        response,
        200,
        await listWorkspaces(roots, {
          workspaceRoot: getWorkspaceRoot(),
        }),
      );
    }

    if (request.method === "POST" && url.pathname === "/workspaces") {
      const body = await readJsonBody(request);
      const workspace = await createWorkspace({
        roots,
        title: typeof body.title === "string" ? body.title : null,
        rootPath: typeof body.rootPath === "string" ? body.rootPath : null,
        workspaceRoot: getWorkspaceRoot(),
      });
      return json(response, 201, workspace);
    }

    if (pathSegments[0] === "workspaces" && typeof pathSegments[1] === "string") {
      const workspaceId = decodeURIComponent(pathSegments[1]);
      const workspace = await readWorkspace(roots, workspaceId);

      if (!workspace) {
        return json(response, 404, { error: "workspace_not_found" });
      }

      if (request.method === "GET" && pathSegments.length === 2) {
        return json(response, 200, workspace);
      }

      if (request.method === "PATCH" && pathSegments.length === 2) {
        const body = await readJsonBody(request);
        if (typeof body.title !== "string" || !body.title.trim()) {
          return json(response, 400, { error: "title is required" });
        }

        const updated = await renameWorkspace(roots, workspaceId, body.title);
        return json(response, 200, updated);
      }

      if (request.method === "DELETE" && pathSegments.length === 2) {
        try {
          const deleted = await deleteWorkspace(roots, workspaceId);
          if (!deleted) {
            return json(response, 404, { error: "workspace_not_found" });
          }

          return json(response, 200, { ok: true });
        } catch (error) {
          if (error instanceof Error && error.message === "cannot_delete_last_workspace") {
            return json(response, 400, { error: error.message });
          }

          throw error;
        }
      }

      if (
        request.method === "POST" &&
        pathSegments.length === 3 &&
        pathSegments[2] === "refresh"
      ) {
        const refreshed = await refreshWorkspace(roots, workspaceId);
        return json(response, 200, refreshed);
      }

      if (
        request.method === "GET" &&
        pathSegments.length === 3 &&
        pathSegments[2] === "export"
      ) {
        const summary = await exportWorkspaceSummary(roots, workspaceId);
        if (!summary) {
          return json(response, 404, { error: "workspace_not_found" });
        }

        return json(response, 200, summary);
      }

      if (
        request.method === "GET" &&
        pathSegments.length === 3 &&
        pathSegments[2] === "runs"
      ) {
        return json(response, 200, await readRuns(workspace));
      }

      if (
        request.method === "POST" &&
        pathSegments.length === 3 &&
        pathSegments[2] === "runs"
      ) {
        const body = await readJsonBody(request);
        if (typeof body.prompt !== "string" || !body.prompt.trim()) {
          return json(response, 400, { error: "prompt is required" });
        }

        if (!parsePrompt(body.prompt)) {
          return json(response, 400, { error: "invalid_command_prompt" });
        }

        const run = await createCommandRun({
          workspace,
          prompt: body.prompt,
          toolkitAvailable,
          toolkitPath,
        });

        return json(response, 201, run);
      }

      if (
        request.method === "GET" &&
        pathSegments.length === 4 &&
        pathSegments[2] === "runs"
      ) {
        const runId = decodeURIComponent(pathSegments[3]);
        const run = await readRun(workspace, runId);

        if (!run) {
          return json(response, 404, { error: "not_found" });
        }

        return json(response, 200, run);
      }

      if (
        request.method === "GET" &&
        pathSegments.length === 5 &&
        pathSegments[2] === "runs" &&
        pathSegments[4] === "events"
      ) {
        const runId = decodeURIComponent(pathSegments[3]);
        const run = await readRun(workspace, runId);

        if (!run) {
          return json(response, 404, { error: "not_found" });
        }

        return json(response, 200, await readRunEvents(workspace, runId));
      }

      if (
        request.method === "POST" &&
        pathSegments.length === 5 &&
        pathSegments[2] === "runs" &&
        pathSegments[4] === "respond"
      ) {
        const runId = decodeURIComponent(pathSegments[3]);
        const run = await readRun(workspace, runId);

        if (!run) {
          return json(response, 404, { error: "not_found" });
        }

        const body = await readJsonBody(request);
        const answered = await respondToWorkflowRun({
          response: body,
          run,
          workspace,
        });

        if (!answered) {
          return json(response, 400, { error: "run_not_waiting_for_input" });
        }

        return json(response, 200, answered);
      }

      if (
        request.method === "GET" &&
        pathSegments.length === 3 &&
        pathSegments[2] === "artifacts"
      ) {
        return json(response, 200, await readArtifacts(workspace));
      }

      if (
        request.method === "GET" &&
        pathSegments.length >= 4 &&
        pathSegments[2] === "artifacts"
      ) {
        const artifactId = decodeURIComponent(pathSegments[3]);
        const artifact = await readArtifact(workspace, artifactId);

        if (!artifact) {
          return json(response, 404, { error: "not_found" });
        }

        if (pathSegments.length === 5 && pathSegments[4] === "content") {
          const content = await fs.readFile(artifact.path, "utf8");
          return json(response, 200, { ...artifact, content });
        }

        return json(response, 200, artifact);
      }
    }

    if (request.method === "GET" && url.pathname === "/runs") {
      const workspace = await resolveWorkspaceFromRequest(roots, request, url);
      if (!workspace) {
        return json(response, 404, { error: "workspace_not_found" });
      }

      return json(response, 200, await readRuns(workspace));
    }

    if (request.method === "POST" && url.pathname === "/runs") {
      const body = await readJsonBody(request);
      if (typeof body.prompt !== "string" || !body.prompt.trim()) {
        return json(response, 400, { error: "prompt is required" });
      }

      if (!parsePrompt(body.prompt)) {
        return json(response, 400, { error: "invalid_command_prompt" });
      }

      const workspace = await resolveWorkspaceFromBody(roots, body);
      if (!workspace) {
        return json(response, 400, { error: "workspaceId is required" });
      }

      const run = await createCommandRun({
        workspace,
        prompt: body.prompt,
        toolkitAvailable,
        toolkitPath,
      });

      return json(response, 201, run);
    }

    if (request.method === "GET" && url.pathname.startsWith("/runs/")) {
      const runPath = url.pathname.slice("/runs/".length);
      const separatorIndex = runPath.indexOf("/");
      const runId = decodeURIComponent(
        separatorIndex === -1 ? runPath : runPath.slice(0, separatorIndex),
      );
      const workspace = await resolveWorkspaceFromRequest(roots, request, url);
      if (!workspace) {
        return json(response, 404, { error: "workspace_not_found" });
      }

      const run = await readRun(workspace, runId);

      if (!run) {
        return json(response, 404, { error: "not_found" });
      }

      if (
        separatorIndex !== -1 &&
        runPath.slice(separatorIndex + 1) === "events"
      ) {
        return json(response, 200, await readRunEvents(workspace, runId));
      }

      return json(response, 200, run);
    }

    if (request.method === "GET" && url.pathname === "/artifacts") {
      const workspace = await resolveWorkspaceFromRequest(roots, request, url);
      if (!workspace) {
        return json(response, 404, { error: "workspace_not_found" });
      }

      return json(response, 200, await readArtifacts(workspace));
    }

    if (request.method === "GET" && url.pathname.startsWith("/artifacts/")) {
      const artifactPath = url.pathname.slice("/artifacts/".length);
      const separatorIndex = artifactPath.indexOf("/");
      const artifactId = decodeURIComponent(
        separatorIndex === -1
          ? artifactPath
          : artifactPath.slice(0, separatorIndex),
      );
      const workspace = await resolveWorkspaceFromRequest(roots, request, url);
      if (!workspace) {
        return json(response, 404, { error: "workspace_not_found" });
      }

      const artifact = await readArtifact(workspace, artifactId);

      if (!artifact) {
        return json(response, 404, { error: "not_found" });
      }

      if (
        separatorIndex !== -1 &&
        artifactPath.slice(separatorIndex + 1) === "content"
      ) {
        const content = await fs.readFile(artifact.path, "utf8");
        return json(response, 200, { ...artifact, content });
      }

      return json(response, 200, artifact);
    }

    if (request.method === "POST" && url.pathname === "/gap-assessment") {
      const body = await readJsonBody(request);
      const frameworks = coerceArray(body.frameworks);
      const sources = coerceArray(body.sources);

      if (!frameworks.length || !sources.length) {
        return json(response, 400, {
          error: "frameworks and sources are required",
        });
      }

      const workspace = await readWorkspace(
        roots,
        typeof body.workspaceId === "string" ? body.workspaceId : "",
      );
      if (!workspace) {
        return json(response, 400, { error: "workspaceId is required" });
      }

      const run = await createPlannedRun({
        workspace,
        frameworks,
        sources,
        toolkitPath,
      });
      return json(response, 202, run);
    }

    return json(response, 404, { error: "not_found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    if (
      message === "workspace_root_path_required" ||
      message === "workspace_id_conflict"
    ) {
      return json(response, 400, { error: message });
    }

    return json(response, 500, { error: message });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`[runner] listening on http://127.0.0.1:${port}`);
});

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
          executionMode: resolveExecutionMode(pluginId, commandId),
          output: inferOutputType(commandId, frontmatter.output),
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

function resolveExecutionMode(pluginId, commandId) {
  if (
    (pluginId === "github-inspector" && commandId === "collect") ||
    (pluginId === "grc-engineer" && commandId === "gap-assessment")
  ) {
    return "script";
  }

  if (pluginId === "grc-reporter" && commandId === "exec-summary") {
    return "workflow";
  }

  return "workflow";
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

function inferOutputType(commandId, declaredOutput) {
  if (
    declaredOutput &&
    ["report", "code", "document", "status", "score"].includes(declaredOutput)
  ) {
    return declaredOutput;
  }

  if (
    commandId.startsWith("status") ||
    commandId === "setup" ||
    commandId.endsWith("status")
  ) {
    return "status";
  }

  if (commandId.startsWith("generate-") || commandId.startsWith("scaffold-")) {
    return "code";
  }

  if (
    commandId.startsWith("report-") ||
    commandId.includes("assessment") ||
    commandId.startsWith("assess")
  ) {
    return "report";
  }

  if (commandId.includes("score")) {
    return "score";
  }

  return "document";
}

function humanizeId(value) {
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
        `${connector.id}.yaml`,
      );
      const cachePath = path.join(roots.cacheRoot, "findings", connector.id);

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
    prompt: input.prompt,
  });

  const run = {
    id: runId,
    status:
      execution.kind === "script" || execution.kind === "workflow"
        ? "running"
        : "failed",
    createdAt: now,
    completedAt:
      execution.kind === "script" || execution.kind === "workflow"
        ? null
        : now,
    prompt: input.prompt,
    commandPath: parsed.commandPath,
    pluginId: parsed.pluginId,
    commandId: parsed.commandId,
    workspaceId: input.workspace.id,
    workspaceTitle: input.workspace.title,
    runDirectory,
    outputDir: runArtifactsDir,
    commandPreview,
    executionMode: execution.kind === "script" ? "script" : "workflow",
    artifactCount: 0,
    artifacts: [],
  };

  await persistRunFiles({
    commandPreview,
    prompt: input.prompt,
    run,
    runDirectory,
  });

  await appendRunEvent(runDirectory, {
    type: "run.created",
    data: {
      commandPath: parsed.commandPath,
      executionMode: run.executionMode,
      prompt: input.prompt,
    },
  });

  if (execution.kind !== "script") {
    if (execution.kind === "workflow") {
      void executeWorkflowRun({
        execution,
        run,
        runDirectory,
        workspace: input.workspace,
      });
      return run;
    }

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
    run,
    runDirectory,
    workspace: input.workspace,
  });

  return run;
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

  if (input.parsed.commandPath === "/github-inspector:collect") {
    return {
      kind: "script",
      cwd: input.toolkitPath,
      runtime: process.execPath,
      scriptPath: path.join(
        input.toolkitPath,
        "plugins",
        "connectors",
        "github-inspector",
        "scripts",
        "collect.js",
      ),
      args: input.parsed.argumentTokens,
      commandPath: input.parsed.commandPath,
      pluginId: input.parsed.pluginId,
      commandId: input.parsed.commandId,
      syncStrategy: "github-inspector-collect",
    };
  }

  if (input.parsed.commandPath === "/grc-engineer:gap-assessment") {
    const reportDir =
      readOptionValue(input.parsed.argumentTokens, "--report-dir") ??
      path.join(input.runArtifactsDir, "gap-assessment");

    return {
      kind: "script",
      cwd: input.toolkitPath,
      runtime: process.execPath,
      scriptPath: path.join(
        input.toolkitPath,
        "plugins",
        "grc-engineer",
        "scripts",
        "gap-assessment.js",
      ),
      args: ensureOption(
        ensureOption(
          input.parsed.argumentTokens,
          "--cache-dir",
          input.workspace.folders.findingsRaw,
        ),
        "--report-dir",
        reportDir,
      ),
      commandPath: input.parsed.commandPath,
      pluginId: input.parsed.pluginId,
      commandId: input.parsed.commandId,
      reportDir,
      syncStrategy: "gap-assessment",
    };
  }

  const workflowExecution = resolveWorkflowExecution(input.parsed);
  if (workflowExecution) {
    return workflowExecution;
  }

  return {
    kind: "unsupported",
    reason:
      "This milestone wires /github-inspector:collect, /grc-engineer:gap-assessment, and /grc-reporter:exec-summary.",
  };
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
      args: [execution.scriptPath, ...execution.args],
      cwd: execution.cwd,
    },
  });

  const child = spawn(
    execution.runtime,
    [execution.scriptPath, ...execution.args],
    {
      cwd: execution.cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

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
        errorMessage: error.message,
        execution,
        exitCode: null,
        run,
        runDirectory,
        status: "failed",
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
        status: classifyRunStatus(execution, exitCode),
        stdoutText: stdoutChunks.join(""),
        stderrText: stderrChunks.join(""),
        workspace,
      }),
    );
  });
}

async function executeWorkflowRun(input) {
  return workflowRuntime.executeWorkflowRun(input);
}

async function finalizeCommandRun(input) {
  const completionTime = new Date().toISOString();
  const nextRun = {
    ...input.run,
    status: input.status,
    completedAt: completionTime,
  };

  const artifacts =
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

  if (input.execution.syncStrategy === "gap-assessment") {
    return collectGapAssessmentArtifacts(input);
  }

  return [];
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
    const args = [input.execution.scriptPath, ...input.execution.args]
      .map((value) => JSON.stringify(value))
      .join(" ");

    return `cd ${JSON.stringify(input.execution.cwd)} && ${JSON.stringify(input.execution.runtime)} ${args}`;
  }

  return input.prompt;
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
  const connectorId = "github-inspector";
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
      title: "GitHub Findings Cache",
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

async function countJsonFiles(targetPath) {
  try {
    const entries = await fs.readdir(targetPath);
    return entries.filter((entry) => entry.endsWith(".json")).length;
  } catch {
    return 0;
  }
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (!chunks.length) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function resolveWorkspaceFromRequest(roots, request, url) {
  const workspaceId = url.searchParams.get("workspaceId");
  if (workspaceId) {
    return readWorkspace(roots, workspaceId);
  }

  if (
    request.method === "GET" &&
    request.headers["x-workspace-id"] &&
    typeof request.headers["x-workspace-id"] === "string"
  ) {
    return readWorkspace(roots, request.headers["x-workspace-id"]);
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

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Workspace-Id",
  );
  response.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PATCH,DELETE,OPTIONS",
  );
}

function json(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}
