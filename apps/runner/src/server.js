import { createServer } from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const port = Number(process.env.CGE_RUNNER_PORT ?? 3333);
const toolkitPath = process.env.CGE_TOOLKIT_PATH ?? null;

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
const runsDir = path.join(roots.appDataRoot, "runs");

const server = createServer(async (request, response) => {
  try {
    setCorsHeaders(response);

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    const url = new URL(request.url ?? "/", `http://${request.headers.host}`);

    if (request.method === "GET" && url.pathname === "/health") {
      return json(response, 200, {
        ok: true,
        runnerVersion: "0.1.0",
        toolkitPath,
        appDataRoot: roots.appDataRoot,
        cacheRoot: roots.cacheRoot,
        configRoot: roots.configRoot,
      });
    }

    if (request.method === "GET" && url.pathname === "/frameworks") {
      return json(response, 200, frameworkCatalog);
    }

    if (request.method === "GET" && url.pathname === "/connectors") {
      return json(response, 200, await readConnectorSummaries());
    }

    if (request.method === "GET" && url.pathname === "/runs") {
      return json(response, 200, await readRuns());
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

      const run = await createPlannedRun({ frameworks, sources });
      return json(response, 202, run);
    }

    return json(response, 404, { error: "not_found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return json(response, 500, { error: message });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`[runner] listening on http://127.0.0.1:${port}`);
});

async function readConnectorSummaries() {
  await fs.mkdir(path.join(roots.configRoot, "connectors"), { recursive: true });
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

async function readRuns() {
  await fs.mkdir(runsDir, { recursive: true });
  const files = await fs.readdir(runsDir);
  const runs = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => {
        const contents = await fs.readFile(path.join(runsDir, file), "utf8");
        return JSON.parse(contents);
      }),
  );

  return runs.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

async function createPlannedRun(input) {
  await fs.mkdir(runsDir, { recursive: true });

  const id = `run-${Date.now()}`;
  const outputDir = path.join(roots.appDataRoot, "artifacts", id);
  const run = {
    id,
    status: "planned",
    createdAt: new Date().toISOString(),
    frameworks: input.frameworks,
    sources: input.sources,
    outputDir,
    commandPreview: toolkitPath
      ? buildGapAssessmentCommand({
          toolkitPath,
          frameworks: input.frameworks,
          sources: input.sources,
          outputDir,
        })
      : null,
  };

  await fs.mkdir(path.dirname(outputDir), { recursive: true });
  await fs.writeFile(path.join(runsDir, `${id}.json`), JSON.stringify(run, null, 2));

  return run;
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

function coerceArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item) => typeof item === "string");
}

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
}

function json(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}
