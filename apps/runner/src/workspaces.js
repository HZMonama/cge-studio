import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const WORKSPACE_VERSION = 1;
const WORKSPACE_DATA_DIR = ".cge";
const WORKSPACE_REGISTRY_DIR = path.join("workspaces", "registry");
const DEFAULT_WORKSPACE_NAME = "Untitled Workspace";

const CONNECTOR_IDS = [
  "aws-inspector",
  "gcp-inspector",
  "github-inspector",
  "okta-inspector",
];

const DIRECTORY_NAMES = {
  dataRoot: WORKSPACE_DATA_DIR,
  state: path.join(WORKSPACE_DATA_DIR, "state"),
  stateIndex: path.join(WORKSPACE_DATA_DIR, "state", "index.sqlite"),
  stateLocks: path.join(WORKSPACE_DATA_DIR, "state", "locks"),
  runner: path.join(WORKSPACE_DATA_DIR, "runner"),
  runs: path.join(WORKSPACE_DATA_DIR, "runner", "runs"),
  findings: path.join(WORKSPACE_DATA_DIR, "findings"),
  findingsRaw: path.join(WORKSPACE_DATA_DIR, "findings", "raw"),
  findingsNormalized: path.join(WORKSPACE_DATA_DIR, "findings", "normalized"),
  findingsIndexes: path.join(WORKSPACE_DATA_DIR, "findings", "indexes"),
  program: path.join(WORKSPACE_DATA_DIR, "program"),
  programRisks: path.join(WORKSPACE_DATA_DIR, "program", "risks"),
  programControls: path.join(WORKSPACE_DATA_DIR, "program", "controls"),
  programEvidence: path.join(WORKSPACE_DATA_DIR, "program", "evidence"),
  programExceptions: path.join(WORKSPACE_DATA_DIR, "program", "exceptions"),
  programTasks: path.join(WORKSPACE_DATA_DIR, "program", "tasks"),
  programNotes: path.join(WORKSPACE_DATA_DIR, "program", "notes"),
  artifacts: path.join(WORKSPACE_DATA_DIR, "artifacts"),
  artifactsGenerated: path.join(WORKSPACE_DATA_DIR, "artifacts", "generated"),
  artifactsExports: path.join(WORKSPACE_DATA_DIR, "artifacts", "exports"),
  artifactsBundles: path.join(WORKSPACE_DATA_DIR, "artifacts", "bundles"),
  dashboards: path.join(WORKSPACE_DATA_DIR, "dashboards"),
  dashboardsLayouts: path.join(WORKSPACE_DATA_DIR, "dashboards", "layouts"),
  dashboardsWidgets: path.join(WORKSPACE_DATA_DIR, "dashboards", "widgets"),
  dashboardsSavedViews: path.join(
    WORKSPACE_DATA_DIR,
    "dashboards",
    "saved-views",
  ),
  dashboardsSnapshots: path.join(
    WORKSPACE_DATA_DIR,
    "dashboards",
    "snapshots",
  ),
};

export async function ensureWorkspaceSystem(roots) {
  await fs.mkdir(getWorkspacesRoot(roots), { recursive: true });
}

export function getWorkspacesRoot(roots) {
  return path.join(roots.appDataRoot, WORKSPACE_REGISTRY_DIR);
}

export function workspaceFolderPaths(rootPath) {
  const resolvedRootPath = resolveWorkspaceRootPath(rootPath);

  return {
    rootPath: resolvedRootPath,
    dataRootPath: path.join(resolvedRootPath, DIRECTORY_NAMES.dataRoot),
    statePath: path.join(resolvedRootPath, DIRECTORY_NAMES.state),
    stateIndexPath: path.join(resolvedRootPath, DIRECTORY_NAMES.stateIndex),
    stateLocksPath: path.join(resolvedRootPath, DIRECTORY_NAMES.stateLocks),
    runnerPath: path.join(resolvedRootPath, DIRECTORY_NAMES.runner),
    runsPath: path.join(resolvedRootPath, DIRECTORY_NAMES.runs),
    findingsPath: path.join(resolvedRootPath, DIRECTORY_NAMES.findings),
    findingsRawPath: path.join(resolvedRootPath, DIRECTORY_NAMES.findingsRaw),
    findingsNormalizedPath: path.join(
      resolvedRootPath,
      DIRECTORY_NAMES.findingsNormalized,
    ),
    findingsIndexesPath: path.join(
      resolvedRootPath,
      DIRECTORY_NAMES.findingsIndexes,
    ),
    findingsRawConnectorPaths: Object.fromEntries(
      CONNECTOR_IDS.map((connectorId) => [
        connectorId,
        path.join(resolvedRootPath, DIRECTORY_NAMES.findingsRaw, connectorId),
      ]),
    ),
    programPath: path.join(resolvedRootPath, DIRECTORY_NAMES.program),
    programRisksPath: path.join(resolvedRootPath, DIRECTORY_NAMES.programRisks),
    programControlsPath: path.join(
      resolvedRootPath,
      DIRECTORY_NAMES.programControls,
    ),
    programEvidencePath: path.join(
      resolvedRootPath,
      DIRECTORY_NAMES.programEvidence,
    ),
    programExceptionsPath: path.join(
      resolvedRootPath,
      DIRECTORY_NAMES.programExceptions,
    ),
    programTasksPath: path.join(resolvedRootPath, DIRECTORY_NAMES.programTasks),
    programNotesPath: path.join(resolvedRootPath, DIRECTORY_NAMES.programNotes),
    artifactsPath: path.join(resolvedRootPath, DIRECTORY_NAMES.artifacts),
    artifactsGeneratedPath: path.join(
      resolvedRootPath,
      DIRECTORY_NAMES.artifactsGenerated,
    ),
    artifactsExportsPath: path.join(
      resolvedRootPath,
      DIRECTORY_NAMES.artifactsExports,
    ),
    artifactsBundlesPath: path.join(
      resolvedRootPath,
      DIRECTORY_NAMES.artifactsBundles,
    ),
    dashboardsPath: path.join(resolvedRootPath, DIRECTORY_NAMES.dashboards),
    dashboardsLayoutsPath: path.join(
      resolvedRootPath,
      DIRECTORY_NAMES.dashboardsLayouts,
    ),
    dashboardsWidgetsPath: path.join(
      resolvedRootPath,
      DIRECTORY_NAMES.dashboardsWidgets,
    ),
    dashboardsSavedViewsPath: path.join(
      resolvedRootPath,
      DIRECTORY_NAMES.dashboardsSavedViews,
    ),
    dashboardsSnapshotsPath: path.join(
      resolvedRootPath,
      DIRECTORY_NAMES.dashboardsSnapshots,
    ),
  };
}

export async function listWorkspaces(roots, options = {}) {
  await ensureWorkspaceSystem(roots);

  if (options.workspaceRoot) {
    const discovered = await discoverWorkspacesInRoot(
      roots,
      options.workspaceRoot,
    );
    return sortWorkspaces(discovered);
  }

  const entries = await listRegistryEntries(getWorkspacesRoot(roots));
  const workspaces = await Promise.all(
    entries.map((entry) => readWorkspace(roots, entry.id)),
  );

  return sortWorkspaces(workspaces.filter(Boolean));
}

export async function createWorkspace({
  roots,
  title,
  name,
  id,
  rootPath,
  workspaceRoot,
}) {
  await ensureWorkspaceSystem(roots);

  // When a rootPath is given (importing an existing folder), use it directly.
  // Otherwise generate the ID first and use it as the folder name so the
  // folder is permanently stable — title changes never require moving it.
  if (rootPath) {
    const targetRootPath = resolveWorkspaceRootPath(rootPath);
    const existingRegistry = await findWorkspaceByRootPath(roots, targetRootPath);
    if (existingRegistry) {
      return existingRegistry;
    }

    const existingManifest = await readWorkspaceManifest(targetRootPath);
    const now = new Date().toISOString();
    const workspaceName = normalizeWorkspaceName(
      title ?? name ?? existingManifest?.name ?? path.basename(targetRootPath),
    );
    const workspaceId = sanitizeWorkspaceId(
      existingManifest?.id ?? id ?? createWorkspaceId(workspaceName),
    );
    const current = await readWorkspace(roots, workspaceId);
    if (current && current.rootPath !== targetRootPath) {
      throw new Error("workspace_id_conflict");
    }

    const manifest = {
      version: WORKSPACE_VERSION,
      id: workspaceId,
      name: workspaceName,
      title: workspaceName,
      rootPath: targetRootPath,
      createdAt: existingManifest?.createdAt ?? now,
      updatedAt: now,
      folders: createManifestFolders(),
    };

    await createWorkspaceDirectories(targetRootPath);
    await writeWorkspaceManifest(targetRootPath, manifest);
    await writeWorkspaceRegistryEntry(roots, manifest);
    return hydrateWorkspace(manifest);
  }

  // New workspace: generate the ID first, use it as the folder name.
  const workspaceName = normalizeWorkspaceName(title ?? name);
  const workspaceId = sanitizeWorkspaceId(id ?? createWorkspaceId(workspaceName));
  const existing = await readWorkspace(roots, workspaceId);
  if (existing) {
    return existing;
  }

  const targetRootPath = await resolveNewWorkspaceRootPath({
    workspaceRoot,
    folderName: workspaceId,
  });
  const now = new Date().toISOString();
  const manifest = {
    version: WORKSPACE_VERSION,
    id: workspaceId,
    name: workspaceName,
    title: workspaceName,
    rootPath: targetRootPath,
    createdAt: now,
    updatedAt: now,
    folders: createManifestFolders(),
  };

  await createWorkspaceDirectories(targetRootPath);
  await writeWorkspaceManifest(targetRootPath, manifest);
  await writeWorkspaceRegistryEntry(roots, manifest);
  return hydrateWorkspace(manifest);
}

export async function listWorkspaceDirectories(workspaceRoot) {
  const resolvedWorkspaceRoot = resolveWorkspaceRootPath(workspaceRoot);
  await fs.mkdir(resolvedWorkspaceRoot, { recursive: true });
  const entries = await fs.readdir(resolvedWorkspaceRoot, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(resolvedWorkspaceRoot, entry.name));
}

function sortWorkspaces(workspaces) {
  return workspaces.sort((left, right) => {
    const leftUpdated = left.updatedAt ?? left.createdAt ?? "";
    const rightUpdated = right.updatedAt ?? right.createdAt ?? "";

    if (leftUpdated !== rightUpdated) {
      return rightUpdated.localeCompare(leftUpdated);
    }

    return left.title.localeCompare(right.title);
  });
}

export async function readWorkspace(roots, workspaceId) {
  const registryEntry = await readWorkspaceRegistryEntry(roots, workspaceId);
  if (!registryEntry) {
    return null;
  }

  const manifest = await readWorkspaceManifest(registryEntry.rootPath);
  if (!manifest) {
    return null;
  }

  return hydrateWorkspace({
    ...manifest,
    id: sanitizeWorkspaceId(manifest.id ?? registryEntry.id),
    rootPath: resolveWorkspaceRootPath(
      manifest.rootPath ?? registryEntry.rootPath,
    ),
  });
}

export async function renameWorkspace(roots, workspaceId, nextTitle) {
  const workspace = await readWorkspace(roots, workspaceId);
  if (!workspace) {
    return null;
  }

  // Keep the folder path stable — only update the display title in the manifest
  // and registry. Moving the folder would invalidate all stored run/artifact paths.
  const updated = {
    version: workspace.version,
    id: workspace.id,
    name: normalizeWorkspaceName(nextTitle),
    title: normalizeWorkspaceName(nextTitle),
    rootPath: workspace.rootPath,
    createdAt: workspace.createdAt,
    updatedAt: new Date().toISOString(),
    folders: createManifestFolders(),
  };

  await writeWorkspaceManifest(workspace.rootPath, updated);
  await writeWorkspaceRegistryEntry(roots, updated);

  return hydrateWorkspace(updated);
}

export async function refreshWorkspace(roots, workspaceId) {
  const workspace = await readWorkspace(roots, workspaceId);
  if (!workspace) {
    return null;
  }

  await createWorkspaceDirectories(workspace.rootPath);
  await writeWorkspaceManifest(workspace.rootPath, {
    version: workspace.version,
    id: workspace.id,
    name: workspace.title,
    title: workspace.title,
    rootPath: workspace.rootPath,
    createdAt: workspace.createdAt,
    updatedAt: new Date().toISOString(),
    folders: createManifestFolders(),
  });

  return readWorkspace(roots, workspaceId);
}

export async function deleteWorkspace(roots, workspaceId) {
  const workspace = await readWorkspace(roots, workspaceId);
  if (!workspace) {
    return false;
  }

  await fs.rm(workspace.folders.dataRoot, {
    recursive: true,
    force: true,
  });
  await fs.rm(workspaceRegistryEntryPath(roots, workspace.id), {
    force: true,
  });

  return true;
}

export async function exportWorkspaceSummary(roots, workspaceId) {
  const workspace = await readWorkspace(roots, workspaceId);
  if (!workspace) {
    return null;
  }

  return {
    workspace,
    exportedAt: new Date().toISOString(),
    summary: {
      runs: await countWorkspaceRuns(workspace),
      artifacts: await countWorkspaceArtifacts(workspace),
    },
  };
}

async function createWorkspaceDirectories(rootPath) {
  const folders = workspaceFolderPaths(rootPath);

  await fs.mkdir(folders.rootPath, { recursive: true });
  await Promise.all([
    fs.mkdir(folders.dataRootPath, { recursive: true }),
    fs.mkdir(folders.statePath, { recursive: true }),
    fs.mkdir(folders.stateLocksPath, { recursive: true }),
    fs.mkdir(folders.runnerPath, { recursive: true }),
    fs.mkdir(folders.runsPath, { recursive: true }),
    fs.mkdir(folders.findingsPath, { recursive: true }),
    fs.mkdir(folders.findingsRawPath, { recursive: true }),
    fs.mkdir(folders.findingsNormalizedPath, { recursive: true }),
    fs.mkdir(folders.findingsIndexesPath, { recursive: true }),
    ...Object.values(folders.findingsRawConnectorPaths).map((targetPath) =>
      fs.mkdir(targetPath, { recursive: true }),
    ),
    fs.mkdir(folders.programPath, { recursive: true }),
    fs.mkdir(folders.programRisksPath, { recursive: true }),
    fs.mkdir(folders.programControlsPath, { recursive: true }),
    fs.mkdir(folders.programEvidencePath, { recursive: true }),
    fs.mkdir(folders.programExceptionsPath, { recursive: true }),
    fs.mkdir(folders.programTasksPath, { recursive: true }),
    fs.mkdir(folders.programNotesPath, { recursive: true }),
    fs.mkdir(folders.artifactsPath, { recursive: true }),
    fs.mkdir(folders.artifactsGeneratedPath, { recursive: true }),
    fs.mkdir(folders.artifactsExportsPath, { recursive: true }),
    fs.mkdir(folders.artifactsBundlesPath, { recursive: true }),
    fs.mkdir(folders.dashboardsPath, { recursive: true }),
    fs.mkdir(folders.dashboardsLayoutsPath, { recursive: true }),
    fs.mkdir(folders.dashboardsWidgetsPath, { recursive: true }),
    fs.mkdir(folders.dashboardsSavedViewsPath, { recursive: true }),
    fs.mkdir(folders.dashboardsSnapshotsPath, { recursive: true }),
  ]);

  await touchFile(folders.stateIndexPath);
}

async function readWorkspaceManifest(rootPath) {
  try {
    const contents = await fs.readFile(workspaceManifestPath(rootPath), "utf8");
    return JSON.parse(contents);
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }

    throw error;
  }
}

async function writeWorkspaceManifest(rootPath, manifest) {
  await fs.writeFile(
    workspaceManifestPath(rootPath),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );
}

async function readWorkspaceRegistryEntry(roots, workspaceId) {
  try {
    const contents = await fs.readFile(
      workspaceRegistryEntryPath(roots, workspaceId),
      "utf8",
    );
    return JSON.parse(contents);
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }

    throw error;
  }
}

async function writeWorkspaceRegistryEntry(roots, manifest) {
  await ensureWorkspaceSystem(roots);
  await fs.writeFile(
    workspaceRegistryEntryPath(roots, manifest.id),
    JSON.stringify(
      {
        id: manifest.id,
        rootPath: resolveWorkspaceRootPath(manifest.rootPath),
        name: normalizeWorkspaceName(manifest.name ?? manifest.title),
        updatedAt: manifest.updatedAt ?? null,
      },
      null,
      2,
    ),
    "utf8",
  );
}

async function listRegistryEntries(registryRoot) {
  const entries = await fs.readdir(registryRoot, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => ({
      id: entry.name.replace(/\.json$/u, ""),
    }));
}

async function discoverWorkspacesInRoot(roots, workspaceRoot) {
  const workspaceDirectories = await listWorkspaceDirectories(workspaceRoot);
  const discovered = await Promise.all(
    workspaceDirectories.map(async (directoryPath) => {
      const manifest = await readWorkspaceManifest(directoryPath);
      if (!manifest) {
        return null;
      }

      const hydrated = hydrateWorkspace({
        ...manifest,
        id: sanitizeWorkspaceId(manifest.id),
        rootPath: resolveWorkspaceRootPath(
          manifest.rootPath ?? directoryPath,
        ),
      });
      await writeWorkspaceRegistryEntry(roots, hydrated);
      return hydrated;
    }),
  );

  return discovered.filter(Boolean);
}

async function findWorkspaceByRootPath(roots, rootPath) {
  const workspaces = await listWorkspaces(roots);
  return (
    workspaces.find(
      (workspace) => workspace.rootPath === resolveWorkspaceRootPath(rootPath),
    ) ?? null
  );
}

async function countWorkspaceRuns(workspace) {
  try {
    const entries = await fs.readdir(workspace.folders.runs, {
      withFileTypes: true,
    });
    return entries.filter((entry) => entry.isDirectory()).length;
  } catch {
    return 0;
  }
}

async function countWorkspaceArtifacts(workspace) {
  try {
    const runEntries = await fs.readdir(workspace.folders.artifactsGenerated, {
      withFileTypes: true,
    });

    let count = 0;
    for (const entry of runEntries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const artifactEntries = await fs.readdir(
        path.join(workspace.folders.artifactsGenerated, entry.name),
        {
          withFileTypes: true,
        },
      );
      count += artifactEntries.filter((artifactEntry) => artifactEntry.isFile())
        .length;
    }

    return count;
  } catch {
    return 0;
  }
}

async function touchFile(targetPath) {
  try {
    await fs.access(targetPath);
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }

    await fs.writeFile(targetPath, "", "utf8");
  }
}

function workspaceRegistryEntryPath(roots, workspaceId) {
  return path.join(getWorkspacesRoot(roots), `${sanitizeWorkspaceId(workspaceId)}.json`);
}

function workspaceManifestPath(rootPath) {
  return path.join(resolveWorkspaceRootPath(rootPath), WORKSPACE_DATA_DIR, "workspace.json");
}

function createManifestFolders() {
  return { ...DIRECTORY_NAMES };
}

function hydrateWorkspace(manifest) {
  const folders = workspaceFolderPaths(manifest.rootPath);

  return {
    version: manifest.version ?? WORKSPACE_VERSION,
    id: sanitizeWorkspaceId(manifest.id),
    name: normalizeWorkspaceName(manifest.name ?? manifest.title),
    title: normalizeWorkspaceName(manifest.title ?? manifest.name),
    createdAt: manifest.createdAt ?? null,
    updatedAt: manifest.updatedAt ?? manifest.createdAt ?? null,
    rootPath: folders.rootPath,
    folders: {
      dataRoot: folders.dataRootPath,
      state: folders.statePath,
      stateIndex: folders.stateIndexPath,
      stateLocks: folders.stateLocksPath,
      runner: folders.runnerPath,
      runs: folders.runsPath,
      findings: folders.findingsPath,
      findingsRaw: folders.findingsRawPath,
      findingsNormalized: folders.findingsNormalizedPath,
      findingsIndexes: folders.findingsIndexesPath,
      findingsRawConnectors: folders.findingsRawConnectorPaths,
      program: folders.programPath,
      programRisks: folders.programRisksPath,
      programControls: folders.programControlsPath,
      programEvidence: folders.programEvidencePath,
      programExceptions: folders.programExceptionsPath,
      programTasks: folders.programTasksPath,
      programNotes: folders.programNotesPath,
      artifacts: folders.artifactsPath,
      artifactsGenerated: folders.artifactsGeneratedPath,
      artifactsExports: folders.artifactsExportsPath,
      artifactsBundles: folders.artifactsBundlesPath,
      dashboards: folders.dashboardsPath,
      dashboardsLayouts: folders.dashboardsLayoutsPath,
      dashboardsWidgets: folders.dashboardsWidgetsPath,
      dashboardsSavedViews: folders.dashboardsSavedViewsPath,
      dashboardsSnapshots: folders.dashboardsSnapshotsPath,
    },
  };
}

function normalizeWorkspaceName(value) {
  const title = String(value ?? "").trim();
  return title.length > 0 ? title : DEFAULT_WORKSPACE_NAME;
}

async function resolveNewWorkspaceRootPath(input) {
  const workspaceRoot = resolveWorkspaceRootPath(input.workspaceRoot);
  await fs.mkdir(workspaceRoot, { recursive: true });

  // Accept a pre-computed folderName (ID-based) or fall back to title-slug for
  // legacy callers.
  const baseFolderName = input.folderName ?? createWorkspaceFolderName(input.workspaceName);
  let candidatePath = path.join(workspaceRoot, baseFolderName);
  let counter = 1;

  while (await pathExists(candidatePath)) {
    const manifest = await readWorkspaceManifest(candidatePath);
    if (manifest) {
      return candidatePath;
    }

    counter += 1;
    candidatePath = path.join(
      workspaceRoot,
      `${baseFolderName}-${String(counter).padStart(2, "0")}`,
    );
  }

  return candidatePath;
}

function createWorkspaceId(name) {
  const slug = normalizeWorkspaceName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  const suffix = Math.random().toString(36).slice(2, 8);
  return `${slug || "workspace"}-${suffix}`;
}

function createWorkspaceFolderName(name) {
  const slug = normalizeWorkspaceName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return slug || "workspace";
}

function sanitizeWorkspaceId(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!normalized) {
    throw new Error("invalid_workspace_id");
  }

  return normalized;
}

function resolveWorkspaceRootPath(rootPath) {
  const value = String(rootPath ?? "").trim();
  if (!value) {
    throw new Error("workspace_root_path_required");
  }

  if (value === "~") {
    return os.homedir();
  }

  if (value.startsWith("~/")) {
    return path.join(os.homedir(), value.slice(2));
  }

  return path.resolve(value);
}

function isNotFoundError(error) {
  return (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}
