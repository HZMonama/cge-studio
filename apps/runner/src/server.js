import { createServer } from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveCommandForm } from "./form-engine.js";
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
const defaultWorkspaceRoot = path.parse(os.homedir()).root;

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
        workspaceRoot: runnerConfig.value.workspaceRoot ?? defaultWorkspaceRoot,
        runnerConfigPath: getWritableRunnerConfigPath(),
      });
    }

    if (request.method === "PATCH" && url.pathname === "/config") {
      const body = await readJsonBody(request);
      const nextConfig = await writeRunnerConfig({
        toolkitPath:
          typeof body.toolkitPath === "string" ? body.toolkitPath : undefined,
        workspaceRoot:
          typeof body.workspaceRoot === "string"
            ? body.workspaceRoot
            : undefined,
      });

      return json(response, 200, {
        toolkitPath: nextConfig.toolkitPath ?? "",
        workspaceRoot: nextConfig.workspaceRoot ?? defaultWorkspaceRoot,
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
          workspaceRoot: runnerConfig.value.workspaceRoot ?? defaultWorkspaceRoot,
        }),
      );
    }

    if (request.method === "POST" && url.pathname === "/workspaces") {
      const body = await readJsonBody(request);
      const workspaceRoot =
        typeof body.workspaceRoot === "string" && body.workspaceRoot.trim()
          ? body.workspaceRoot
          : runnerConfig.value.workspaceRoot ?? defaultWorkspaceRoot;

      const workspace = await createWorkspace({
        roots,
        title: typeof body.title === "string" ? body.title : null,
        rootPath: typeof body.rootPath === "string" ? body.rootPath : null,
        workspaceRoot,
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
      const runId = decodeURIComponent(url.pathname.slice("/runs/".length));
      const workspace = await resolveWorkspaceFromRequest(roots, request, url);
      if (!workspace) {
        return json(response, 404, { error: "workspace_not_found" });
      }

      const run = await readRun(workspace, runId);

      if (!run) {
        return json(response, 404, { error: "not_found" });
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

  if (input.workspaceRoot !== undefined) {
    if (input.workspaceRoot.trim()) {
      nextValue.workspaceRoot = input.workspaceRoot.trim();
    } else {
      delete nextValue.workspaceRoot;
    }
  }

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
  const commandPreview = buildCommandPreview({
    commandPath: parsed.commandPath,
    prompt: input.prompt,
    toolkitAvailable: input.toolkitAvailable,
    toolkitPath: input.toolkitPath,
  });
  const outputType = inferOutputType(parsed.commandId);
  const artifact = await createRunArtifact({
    commandPath: parsed.commandPath,
    commandId: parsed.commandId,
    outputType,
    pluginId: parsed.pluginId,
    prompt: input.prompt,
    runArtifactsDir,
    runId,
    timestamp: now,
  });

  const run = {
    id: runId,
    status: "completed",
    createdAt: now,
    completedAt: now,
    prompt: input.prompt,
    commandPath: parsed.commandPath,
    pluginId: parsed.pluginId,
    commandId: parsed.commandId,
    workspaceId: input.workspace.id,
    workspaceTitle: input.workspace.title,
    runDirectory,
    outputDir: runArtifactsDir,
    commandPreview,
    artifactCount: 1,
    artifacts: [artifact],
  };

  await persistRunFiles({
    commandPreview,
    prompt: input.prompt,
    run,
    runDirectory,
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
  await fs.writeFile(
    path.join(input.runDirectory, "run.json"),
    JSON.stringify(input.run, null, 2),
    "utf8",
  );
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
}

async function createRunArtifact(input) {
  await fs.mkdir(input.runArtifactsDir, { recursive: true });

  const artifactId = `artifact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const extension = artifactExtension(input.outputType);
  const artifactPath = path.join(
    input.runArtifactsDir,
    `${artifactId}.${extension}`,
  );
  const content = artifactContent({
    commandPath: input.commandPath,
    outputType: input.outputType,
    pluginId: input.pluginId,
    prompt: input.prompt,
    timestamp: input.timestamp,
  });

  await fs.writeFile(artifactPath, content, "utf8");

  return {
    id: artifactId,
    runId: input.runId,
    title: `${humanizeId(input.commandId)} Output`,
    kind: input.outputType,
    format: artifactFormat(input.outputType),
    path: artifactPath,
    createdAt: input.timestamp,
    commandPath: input.commandPath,
    pluginId: input.pluginId,
    commandId: input.commandId,
  };
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
  if (input.toolkitAvailable && input.toolkitPath) {
    return `cd ${JSON.stringify(input.toolkitPath)} && claude ${JSON.stringify(input.prompt)}`;
  }

  return input.prompt;
}

function parsePrompt(prompt) {
  const trimmed = prompt.trim();
  const match = trimmed.match(
    /^\/(?<pluginId>[a-z0-9-]+):(?<commandId>[a-z0-9-]+)/i,
  );

  if (!match?.groups) {
    return null;
  }

  return {
    commandPath: `/${match.groups.pluginId}:${match.groups.commandId}`,
    pluginId: match.groups.pluginId,
    commandId: match.groups.commandId,
  };
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

function artifactContent(input) {
  if (input.outputType === "score") {
    return JSON.stringify(
      {
        commandPath: input.commandPath,
        createdAt: input.timestamp,
        pluginId: input.pluginId,
        prompt: input.prompt,
        status: "recorded",
      },
      null,
      2,
    );
  }

  if (input.outputType === "code") {
    return [
      `# ${input.commandPath}`,
      "",
      "This file was generated by the Studio runner artifact index.",
      "Real CLI execution is not wired yet; this is a tracked output placeholder.",
      "",
      `Prompt: ${input.prompt}`,
      `Recorded: ${input.timestamp}`,
    ].join("\n");
  }

  return [
    `# ${input.commandPath}`,
    "",
    `Recorded at ${input.timestamp}.`,
    "",
    "This artifact was created by the Studio runner so the output can be tracked in Artifacts and Runner history.",
    "Real CLI execution is not wired yet; this file represents the saved output surface for this run.",
    "",
    "## Prompt",
    "",
    `\`${input.prompt}\``,
  ].join("\n");
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
