"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChartBarIcon,
  FilesIcon,
  FolderNotchOpenIcon,
  LightningIcon,
  MagnifyingGlassIcon,
} from "@phosphor-icons/react";

import { AppSidebar } from "@/components/app-sidebar";
import {
  AppShellHeader,
  type AppHeaderSection,
  type SyncStatus,
} from "@/components/app-shell-header";
import { ArtifactsSurface } from "@/components/artifacts-surface";
import { ChatSurface } from "@/components/chat-surface";
import { ConfigPanel } from "@/components/config-panel";
import { PluginPanel } from "@/components/plugin-panel";
import { RunnerHistoryPanel } from "@/components/runner-history-panel";
import { SectionSurface } from "@/components/section-surface";
import { WorkspaceFooter } from "@/components/workspace-footer";
import {
  buildPromptFromCommandForm,
  createInitialFormValues,
  type CommandFormValues,
} from "@/lib/command-form";
import { FALLBACK_PLUGINS, type Command, type Plugin } from "@/lib/plugins";
import {
  createRun,
  createWorkspace,
  deleteWorkspace,
  exportWorkspace,
  fetchArtifactDetail,
  fetchArtifacts,
  fetchRunnerConfig,
  fetchPluginRegistry,
  fetchRunnerHealth,
  fetchRuns,
  fetchWorkspaces,
  refreshWorkspace,
  renameWorkspace,
  updateRunnerConfig,
  type RunnerConfigSnapshot,
  type RunnerArtifactDetail,
  type RunnerArtifactSummary,
  type RunnerRun,
  type RunnerWorkspace,
} from "@/lib/runner";
import { usePluginPanel } from "@/stores/plugin-panel-store";

type AppSection = "chat" | "dashboards" | "findings" | "program" | "artifacts";

const HEADER_SECTIONS: AppHeaderSection[] = [
  { id: "chat", label: "Runner", Icon: LightningIcon },
  { id: "dashboards", label: "Dashboards", Icon: ChartBarIcon },
  { id: "findings", label: "Findings", Icon: MagnifyingGlassIcon },
  { id: "program", label: "Program", Icon: FolderNotchOpenIcon },
  { id: "artifacts", label: "Artifacts", Icon: FilesIcon },
];

const ACTIVE_WORKSPACE_STORAGE_KEY = "cge.active-workspace-id";

export default function Page() {
  const { openHistory } = usePluginPanel();
  const [workspaces, setWorkspaces] = useState<RunnerWorkspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(
    null,
  );
  const [activeSection, setActiveSection] = useState<AppSection>("chat");
  const [plugins, setPlugins] = useState<Plugin[]>(FALLBACK_PLUGINS);
  const [runs, setRuns] = useState<RunnerRun[]>([]);
  const [artifacts, setArtifacts] = useState<RunnerArtifactSummary[]>([]);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(
    null,
  );
  const [selectedArtifact, setSelectedArtifact] =
    useState<RunnerArtifactDetail | null>(null);
  const [runPending, setRunPending] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("fallback");
  const [syncPending, setSyncPending] = useState(true);
  const [composerFocusToken, setComposerFocusToken] = useState(0);
  const [composerPrompt, setComposerPrompt] = useState("");
  const [selectedCommandPath, setSelectedCommandPath] = useState<string | null>(
    null,
  );
  const [commandFormValues, setCommandFormValues] = useState<CommandFormValues>(
    {},
  );
  const [sidebarFocusSearchToken, setSidebarFocusSearchToken] = useState(0);
  const [workspaceRefreshPending, setWorkspaceRefreshPending] = useState(false);
  const [runnerConfig, setRunnerConfig] = useState<RunnerConfigSnapshot | null>(
    null,
  );
  const [configSavePending, setConfigSavePending] = useState(false);
  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === activeWorkspaceId) ??
    null;
  const selectedCommand = selectedCommandPath
    ? findCommandByPath(plugins, selectedCommandPath)
    : null;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "s") {
        event.preventDefault();
        setSidebarFocusSearchToken((prev) => prev + 1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const storedWorkspaceId = window.localStorage.getItem(
      ACTIVE_WORKSPACE_STORAGE_KEY,
    );

    if (storedWorkspaceId) {
      setActiveWorkspaceId(storedWorkspaceId);
    }
  }, []);

  const refreshRunnerConnection = useCallback(
    async ({
      signal,
      preservePending = false,
    }: {
      signal?: AbortSignal;
      preservePending?: boolean;
    } = {}) => {
      if (!preservePending) {
        setSyncPending(true);
      }

      try {
        const [health, config, registry, nextWorkspaces] = await Promise.all([
          fetchRunnerHealth(signal),
          fetchRunnerConfig(signal),
          fetchPluginRegistry(signal),
          fetchWorkspaces(signal),
        ]);

        if (signal?.aborted) {
          return;
        }

        if (registry) {
          setPlugins(registry);
          setSyncStatus("synced");
        } else {
          setSyncStatus(health ? "fallback" : "offline");
        }

        setRunnerConfig(config);
        setWorkspaces(nextWorkspaces);
        setActiveWorkspaceId((current) => {
          const nextActiveWorkspaceId =
            (current && nextWorkspaces.some((workspace) => workspace.id === current)
              ? current
              : null) ??
            nextWorkspaces[0]?.id ??
            null;

          if (nextActiveWorkspaceId) {
            window.localStorage.setItem(
              ACTIVE_WORKSPACE_STORAGE_KEY,
              nextActiveWorkspaceId,
            );
          } else {
            window.localStorage.removeItem(ACTIVE_WORKSPACE_STORAGE_KEY);
          }

          return nextActiveWorkspaceId;
        });
      } finally {
        if (!signal?.aborted) {
          setSyncPending(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();

    queueMicrotask(() => {
      void refreshRunnerConnection({
        signal: controller.signal,
        preservePending: true,
      });
    });

    return () => controller.abort();
  }, [refreshRunnerConnection]);

  useEffect(() => {
    if (activeWorkspaceId) {
      window.localStorage.setItem(
        ACTIVE_WORKSPACE_STORAGE_KEY,
        activeWorkspaceId,
      );
    } else {
      window.localStorage.removeItem(ACTIVE_WORKSPACE_STORAGE_KEY);
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    if (!activeWorkspaceId) {
      setRuns([]);
      setArtifacts([]);
      setSelectedArtifactId(null);
      setSelectedArtifact(null);
      return;
    }

    const controller = new AbortController();

    Promise.all([
      fetchRuns(activeWorkspaceId, controller.signal),
      fetchArtifacts(activeWorkspaceId, controller.signal),
    ]).then(([nextRuns, nextArtifacts]) => {
      if (controller.signal.aborted) {
        return;
      }

      setRuns(nextRuns);
      setArtifacts(nextArtifacts);
      setSelectedArtifact(null);
      setSelectedArtifactId((current) =>
        current && nextArtifacts.some((artifact) => artifact.id === current)
          ? current
          : (nextArtifacts[0]?.id ?? null),
      );
    });

    return () => controller.abort();
  }, [activeWorkspaceId]);

  useEffect(() => {
    if (!activeWorkspaceId || !selectedArtifactId) {
      setSelectedArtifact(null);
      return;
    }

    const controller = new AbortController();

    fetchArtifactDetail(activeWorkspaceId, selectedArtifactId, controller.signal).then(
      (artifact) => {
        if (!controller.signal.aborted) {
          setSelectedArtifact(artifact);
        }
      },
    );

    return () => controller.abort();
  }, [activeWorkspaceId, selectedArtifactId]);

  const visibleArtifact = selectedArtifactId ? selectedArtifact : null;
  const artifactLoading =
    selectedArtifactId !== null &&
    (selectedArtifact === null || selectedArtifact.id !== selectedArtifactId);

  function insertComposerCommand(path: string) {
    setActiveSection("chat");
    setSelectedCommandPath(path);
    const command = findCommandByPath(plugins, path);
    const nextFormValues = createInitialFormValues(command);
    setCommandFormValues(nextFormValues);
    setComposerPrompt(
      command?.form
        ? buildPromptFromCommandForm(path, command.form, nextFormValues)
        : `${path} `,
    );
    setComposerFocusToken((prev) => prev + 1);
  }

  function updateSelectedCommandForm(values: CommandFormValues) {
    setCommandFormValues(values);

    if (selectedCommandPath && selectedCommand?.form) {
      setComposerPrompt(
        buildPromptFromCommandForm(
          selectedCommandPath,
          selectedCommand.form,
          values,
        ),
      );
    }
  }

  function clearSelectedCommand() {
    setSelectedCommandPath(null);
    setCommandFormValues({});
    setComposerFocusToken((prev) => prev + 1);
  }

  async function refreshRunnerData(workspaceId: string | null = activeWorkspaceId) {
    if (!workspaceId) {
      setRuns([]);
      setArtifacts([]);
      setSelectedArtifactId(null);
      setSelectedArtifact(null);
      return;
    }

    const [nextRuns, nextArtifacts] = await Promise.all([
      fetchRuns(workspaceId),
      fetchArtifacts(workspaceId),
    ]);

    setRuns(nextRuns);
    setArtifacts(nextArtifacts);
    setSelectedArtifact(null);
    setSelectedArtifactId((current) =>
      current && nextArtifacts.some((artifact) => artifact.id === current)
        ? current
        : (nextArtifacts[0]?.id ?? null),
    );
  }

  async function runComposerCommand() {
    const prompt = composerPrompt.trim();
    if (!activeWorkspaceId || !/^\/[a-z0-9-]+:[a-z0-9-]+/i.test(prompt)) {
      return;
    }

    setRunPending(true);
    let run: RunnerRun | null = null;

    try {
      run = await createRun(activeWorkspaceId, prompt);
      await refreshRunnerData(activeWorkspaceId);
    } finally {
      setRunPending(false);
    }

    if (run?.artifacts?.[0]?.id) {
      setSelectedArtifactId(run.artifacts[0].id);
      openHistory();
    }
  }

  async function addWorkspace() {
    const title = window.prompt("Workspace name", "Untitled Workspace")?.trim();
    if (!title) {
      return;
    }

    const workspace = await createWorkspace({
      title: title || undefined,
      workspaceRoot: runnerConfig?.workspaceRoot,
    });

    if (!workspace) {
      window.alert("Workspace creation failed. Check the configured workspace root and try again.");
      return;
    }

    setWorkspaces((prev) => {
      const withoutExisting = prev.filter((item) => item.id !== workspace.id);
      return [workspace, ...withoutExisting];
    });
    setActiveWorkspaceId(workspace.id);
  }

  async function closeWorkspace(id: string) {
    const workspace = workspaces.find((item) => item.id === id);
    if (!workspace) {
      return;
    }

    const confirmed = window.confirm(
      `Remove workspace "${workspace.title}"? This deletes ${workspace.folders.dataRoot} but leaves the rest of ${workspace.rootPath} intact.`,
    );
    if (!confirmed) {
      return;
    }

    const deleted = await deleteWorkspace(id);
    if (!deleted) {
      window.alert("Workspace deletion failed.");
      return;
    }

    const nextWorkspaces = workspaces.filter((item) => item.id !== id);
    setWorkspaces(nextWorkspaces);
    setActiveWorkspaceId((current) =>
      current === id ? (nextWorkspaces[0]?.id ?? null) : current,
    );
  }

  async function renameActiveWorkspace() {
    if (!activeWorkspace) {
      return;
    }

    const nextTitle = window.prompt("Rename workspace", activeWorkspace.title);
    const title = nextTitle?.trim();
    if (!title) return;

    const updated = await renameWorkspace(activeWorkspace.id, title);
    if (!updated) {
      window.alert("Workspace rename failed.");
      return;
    }

    setWorkspaces((prev) =>
      prev.map((workspace) =>
        workspace.id === updated.id ? updated : workspace,
      ),
    );
  }

  async function exportActiveWorkspace() {
    if (!activeWorkspace) {
      return;
    }

    const summary = await exportWorkspace(activeWorkspace.id);
    if (!summary) {
      window.alert("Workspace export failed.");
      return;
    }

    const blob = new Blob([JSON.stringify(summary, null, 2)], {
      type: "application/json",
    });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${summary.workspace.id}-export.json`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  }

  async function refreshActiveWorkspace() {
    if (!activeWorkspace) {
      return;
    }

    setWorkspaceRefreshPending(true);

    try {
      const refreshed = await refreshWorkspace(activeWorkspace.id)
      if (!refreshed) {
        window.alert("Workspace refresh failed.")
        return
      }

      setWorkspaces((prev) =>
        prev.map((workspace) =>
          workspace.id === refreshed.id ? refreshed : workspace,
        ),
      )
      await refreshRunnerData(refreshed.id)
    } finally {
      setWorkspaceRefreshPending(false)
    }
  }

  async function saveRunnerConfiguration(input: {
    toolkitPath: string;
    workspaceRoot: string;
  }) {
    setConfigSavePending(true);

    try {
      const nextConfig = await updateRunnerConfig(input);
      if (!nextConfig) {
        window.alert("Configuration save failed.");
        return;
      }

      setRunnerConfig(nextConfig);
      await refreshRunnerConnection();
    } finally {
      setConfigSavePending(false);
    }
  }

  return (
    <div className="flex h-svh overflow-hidden bg-sidebar">
      <AppSidebar
        activeSection={activeSection}
        artifacts={artifacts}
        focusSearchToken={sidebarFocusSearchToken}
        onSelectArtifact={(artifactId) => {
          setActiveSection("artifacts");
          setSelectedArtifactId(artifactId);
        }}
        plugins={plugins}
        selectedArtifactId={selectedArtifactId}
      />
      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
        <AppShellHeader
          activeSection={activeSection}
          onSelectSection={(section) => setActiveSection(section as AppSection)}
          onRefreshSync={() => {
            void Promise.all([
              refreshRunnerConnection(),
              refreshRunnerData(activeWorkspaceId),
            ]);
          }}
          sections={HEADER_SECTIONS}
          syncPending={syncPending}
          syncStatus={syncStatus}
        />

        {!activeWorkspace ? (
          <SectionSurface
            title="Create a workspace"
            description="Choose a filesystem folder to initialize a .cge workspace before running commands or browsing artifacts."
          />
        ) : activeSection === "chat" ? (
          <ChatSurface
            commandFormValues={commandFormValues}
            focusToken={composerFocusToken}
            onClearSelectedCommand={clearSelectedCommand}
            onCommandFormChange={updateSelectedCommandForm}
            onOpenHistory={openHistory}
            onRun={runComposerCommand}
            onSelectCommand={insertComposerCommand}
            plugins={plugins}
            prompt={composerPrompt}
            runPending={runPending}
            selectedCommand={selectedCommand}
            selectedCommandPath={selectedCommandPath}
            setPrompt={setComposerPrompt}
          />
        ) : activeSection === "dashboards" ? (
          <SectionSurface
            title="Dashboards"
            description="Dashboard views will live here once the specialized monitoring surfaces are wired in."
          />
        ) : activeSection === "findings" ? (
          <SectionSurface
            title="Findings"
            description="Structured findings will live here once the findings explorer and remediation links are wired in."
          />
        ) : activeSection === "program" ? (
          <SectionSurface
            title="Program"
            description="Program state, risks, and operational records will live here as a dedicated interface."
          />
        ) : (
          <ArtifactsSurface
            artifact={visibleArtifact}
            loading={artifactLoading}
          />
        )}

        <WorkspaceFooter
          activeArtifactCount={artifacts.length}
          activeWorkspaceId={activeWorkspaceId}
          activeWorkspaceRunCount={runs.length}
          onAddWorkspace={addWorkspace}
          onCloseWorkspace={closeWorkspace}
          onExportWorkspace={exportActiveWorkspace}
          onRefreshWorkspace={refreshActiveWorkspace}
          onRenameWorkspace={renameActiveWorkspace}
          refreshPending={workspaceRefreshPending}
          setActiveWorkspaceId={setActiveWorkspaceId}
          workspaces={workspaces}
        />
      </main>

      <PluginPanel
        onSelectCommand={(pluginId, command) => {
          insertComposerCommand(`/${pluginId}:${command.id}`);
        }}
      />
      <RunnerHistoryPanel
        onSelectArtifact={(artifactId) => {
          setSelectedArtifactId(artifactId);
          setActiveSection("artifacts");
        }}
        runs={runs}
      />
      <ConfigPanel
        config={runnerConfig}
        savePending={configSavePending}
        onSave={saveRunnerConfiguration}
      />
    </div>
  );
}

function findCommandByPath(plugins: Plugin[], path: string): Command | null {
  const match = path.match(/^\/([a-z0-9-]+):([a-z0-9-]+)$/i);
  if (!match) {
    return null;
  }

  const pluginId = match[1];
  const commandId = match[2];
  const plugin = plugins.find((item) => item.id === pluginId);
  const command = plugin?.commands.find((item) => item.id === commandId);

  return command ?? null;
}
