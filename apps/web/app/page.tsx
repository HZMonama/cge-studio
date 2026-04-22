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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { WorkspaceFooter } from "@/components/workspace-footer";
import {
  buildPromptFromCommandForm,
  createInitialFormValues,
  type CommandFormValues,
} from "@/lib/command-form";
import { FALLBACK_PLUGINS, type Command, type Plugin } from "@/lib/plugins";
import {
  fetchConnectors,
  createRun,
  createWorkspace,
  deleteWorkspace,
  exportWorkspace,
  fetchArtifactDetail,
  fetchArtifacts,
  fetchClaudeCodeStatus,
  fetchRunnerConfig,
  fetchPluginRegistry,
  fetchRunnerHealth,
  fetchRunEvents,
  fetchRuns,
  fetchWorkspaces,
  refreshWorkspace,
  renameWorkspace,
  respondToRunPrompt,
  updateClaudeCodeConfig,
  updateRunnerConfig,
  type ClaudeCodeStatus,
  type ConnectorSummary,
  type RunnerConfigSnapshot,
  type RunnerArtifactDetail,
  type RunnerArtifactSummary,
  type RunnerHealthSnapshot,
  type RunnerRun,
  type RunnerRunEvent,
  type RunnerWorkspace,
} from "@/lib/runner";
import { usePluginPanel } from "@/stores/plugin-panel-store";

type AppSection = "chat" | "dashboards" | "findings" | "program" | "artifacts";
type AppModalState =
  | { type: "closed" }
  | {
      type: "alert";
      title: string;
      description: string;
      confirmLabel?: string;
    }
  | {
      type: "confirm";
      title: string;
      description: string;
      confirmLabel: string;
      confirmVariant?: "default" | "outline";
      onConfirm: () => Promise<void>;
    }
  | {
      type: "prompt";
      title: string;
      description: string;
      confirmLabel: string;
      defaultValue: string;
      placeholder?: string;
      onConfirm: (value: string) => Promise<void>;
    };

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
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRunEvents, setSelectedRunEvents] = useState<RunnerRunEvent[]>([]);
  const [runEventsPending, setRunEventsPending] = useState(false);
  const [runnerSurfaceCleared, setRunnerSurfaceCleared] = useState(false);
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
  const [runnerHealth, setRunnerHealth] = useState<RunnerHealthSnapshot | null>(
    null,
  );
  const [connectors, setConnectors] = useState<ConnectorSummary[]>([]);
  const [configSavePending, setConfigSavePending] = useState(false);
  const [claudeCodeStatus, setClaudeCodeStatus] = useState<ClaudeCodeStatus | null>(null);
  const [claudeCodeSavePending, setClaudeCodeSavePending] = useState(false);
  const [modalState, setModalState] = useState<AppModalState>({ type: "closed" });
  const [modalInputValue, setModalInputValue] = useState("");
  const [modalPending, setModalPending] = useState(false);
  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === activeWorkspaceId) ??
    null;
  const selectedRun =
    runnerSurfaceCleared
      ? null
      : (runs.find((run) => run.id === selectedRunId) ?? null);
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
        const [health, config, registry, nextWorkspaces, nextConnectors, nextClaudeCodeStatus] =
          await Promise.all([
            fetchRunnerHealth(signal),
            fetchRunnerConfig(signal),
            fetchPluginRegistry(signal),
            fetchWorkspaces(signal),
            fetchConnectors(signal),
            fetchClaudeCodeStatus(signal),
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

        setRunnerHealth(health);
        setRunnerConfig(config);
        setConnectors(nextConnectors);
        setClaudeCodeStatus(nextClaudeCodeStatus);
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
      setSelectedRunId(null);
      setSelectedRunEvents([]);
      setRunnerSurfaceCleared(false);
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
      setSelectedRunId((current) =>
        current && nextRuns.some((run) => run.id === current)
          ? current
          : (runnerSurfaceCleared ? null : (nextRuns[0]?.id ?? null)),
      );
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
    if (!activeWorkspaceId || !selectedRunId || runnerSurfaceCleared) {
      setSelectedRunEvents([]);
      setRunEventsPending(false);
      return;
    }

    const controller = new AbortController();
    setRunEventsPending(true);

    fetchRunEvents(activeWorkspaceId, selectedRunId, controller.signal).then(
      (events) => {
        if (!controller.signal.aborted) {
          setSelectedRunEvents(events);
          setRunEventsPending(false);
        }
      },
    );

    return () => controller.abort();
  }, [activeWorkspaceId, runnerSurfaceCleared, selectedRunId]);

  useEffect(() => {
    if (!activeWorkspaceId || !runs.some((run) => run.status === "running")) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshRunnerData(activeWorkspaceId);
      if (selectedRunId) {
        void fetchRunEvents(activeWorkspaceId, selectedRunId).then(
          (events) => setSelectedRunEvents(events),
        );
      }
    }, 2000);

    return () => window.clearInterval(intervalId);
  }, [activeWorkspaceId, runs, selectedRunId]);

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

  function openAlert(title: string, description: string) {
    setModalState({
      type: "alert",
      title,
      description,
    });
  }

  function openPrompt(input: Extract<AppModalState, { type: "prompt" }>) {
    setModalInputValue(input.defaultValue);
    setModalState(input);
  }

  function openConfirm(input: Extract<AppModalState, { type: "confirm" }>) {
    setModalState(input);
  }

  function closeModal() {
    if (modalPending) {
      return;
    }

    setModalState({ type: "closed" });
    setModalInputValue("");
  }

  async function handleModalConfirm() {
    if (modalState.type === "closed") {
      return;
    }

    if (modalState.type === "alert") {
      closeModal();
      return;
    }

    setModalPending(true);

    try {
      if (modalState.type === "prompt") {
        const value = modalInputValue.trim();
        if (!value) {
          throw new Error("A value is required.");
        }

        await modalState.onConfirm(value);
      }

      if (modalState.type === "confirm") {
        await modalState.onConfirm();
      }

      setModalState({ type: "closed" });
      setModalInputValue("");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong.";
      setModalState({
        type: "alert",
        title: "Action failed",
        description: message,
      });
      setModalInputValue("");
    } finally {
      setModalPending(false);
    }
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
    setSelectedRunId((current) =>
      current && nextRuns.some((run) => run.id === current)
        ? current
        : (runnerSurfaceCleared ? null : (nextRuns[0]?.id ?? null)),
    );
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
      setRunnerSurfaceCleared(false);
      setSelectedRunId(run?.id ?? null);
      setSelectedRunEvents([]);
      setActiveSection("chat");
      await refreshRunnerData(activeWorkspaceId);
    } finally {
      setRunPending(false);
    }

    if (run?.artifacts?.[0]?.id) {
      setSelectedArtifactId(run.artifacts[0].id);
    }
  }

  async function addWorkspace() {
    openPrompt({
      type: "prompt",
      title: "Add workspace",
      description: "Create a new workspace folder in the default workspace location.",
      confirmLabel: "Create workspace",
      defaultValue: "Untitled Workspace",
      placeholder: "Workspace name",
      onConfirm: async (title) => {
        const workspace = await createWorkspace({
          title,
        });

        if (!workspace) {
          throw new Error("Workspace creation failed. Check the workspace location and try again.");
        }

        setWorkspaces((prev) => {
          const withoutExisting = prev.filter((item) => item.id !== workspace.id);
          return [workspace, ...withoutExisting];
        });
        setActiveWorkspaceId(workspace.id);
      },
    });
  }

  async function closeWorkspace(id: string) {
    const workspace = workspaces.find((item) => item.id === id);
    if (!workspace) {
      return;
    }

    openConfirm({
      type: "confirm",
      title: "Delete workspace",
      description: `Remove "${workspace.title}"? This deletes ${workspace.folders.dataRoot} but leaves the rest of ${workspace.rootPath} intact.`,
      confirmLabel: "Delete workspace",
      confirmVariant: "outline",
      onConfirm: async () => {
        const deleted = await deleteWorkspace(id);
        if (!deleted) {
          throw new Error("Workspace deletion failed.");
        }

        const nextWorkspaces = workspaces.filter((item) => item.id !== id);
        setWorkspaces(nextWorkspaces);
        setActiveWorkspaceId((current) =>
          current === id ? (nextWorkspaces[0]?.id ?? null) : current,
        );
      },
    });
  }

  async function renameActiveWorkspace() {
    if (!activeWorkspace) {
      return;
    }

    openPrompt({
      type: "prompt",
      title: "Rename workspace",
      description: "Update the workspace name shown throughout the app.",
      confirmLabel: "Save name",
      defaultValue: activeWorkspace.title,
      placeholder: "Workspace name",
      onConfirm: async (title) => {
        const updated = await renameWorkspace(activeWorkspace.id, title);
        if (!updated) {
          throw new Error("Workspace rename failed.");
        }

        setWorkspaces((prev) =>
          prev.map((workspace) =>
            workspace.id === updated.id ? updated : workspace,
          ),
        );
      },
    });
  }

  async function exportActiveWorkspace() {
    if (!activeWorkspace) {
      return;
    }

    const summary = await exportWorkspace(activeWorkspace.id);
    if (!summary) {
      openAlert("Export failed", "Workspace export failed.");
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
        openAlert("Refresh failed", "Workspace refresh failed.")
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
  }) {
    setConfigSavePending(true);

    try {
      const nextConfig = await updateRunnerConfig(input);
      if (!nextConfig) {
        openAlert("Configuration save failed", "The runner configuration could not be saved.");
        return;
      }

      setRunnerConfig(nextConfig);
      await refreshRunnerConnection();
    } finally {
      setConfigSavePending(false);
    }
  }

  async function saveClaudeCodeConfiguration(input: { model: string }) {
    setClaudeCodeSavePending(true);

    try {
      const next = await updateClaudeCodeConfig({ model: input.model });
      if (!next) {
        openAlert("Claude Code save failed", "The Claude Code configuration could not be saved.");
        return;
      }

      setClaudeCodeStatus(next);
    } finally {
      setClaudeCodeSavePending(false);
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
          claudeCodeStatus={claudeCodeStatus}
          health={runnerHealth}
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
            events={selectedRunEvents}
            focusToken={composerFocusToken}
            loadingEvents={runEventsPending}
            onClearRunner={() => {
              setRunnerSurfaceCleared(true);
              setSelectedRunId(null);
              setSelectedRunEvents([]);
              setSelectedArtifactId(null);
              setSelectedArtifact(null);
              clearSelectedCommand();
              setComposerPrompt("");
            }}
            onClearSelectedCommand={clearSelectedCommand}
            onCommandFormChange={updateSelectedCommandForm}
            onOpenArtifact={(artifactId) => {
              setSelectedArtifactId(artifactId);
              setActiveSection("artifacts");
            }}
            onOpenHistory={openHistory}
            onSubmitPrompt={async (_promptId, answers) => {
              if (!activeWorkspaceId || !selectedRunId) {
                return;
              }

              const updated = await respondToRunPrompt(
                activeWorkspaceId,
                selectedRunId,
                answers,
              );

              if (!updated) {
                openAlert(
                  "Reply failed",
                  "The workflow input could not be submitted.",
                );
                return;
              }

              await refreshRunnerData(activeWorkspaceId);
              const nextEvents = await fetchRunEvents(
                activeWorkspaceId,
                selectedRunId,
              );
              setSelectedRunEvents(nextEvents);

              if (updated.artifacts?.[0]?.id) {
                setSelectedArtifactId(updated.artifacts[0].id);
              }
            }}
            onRun={runComposerCommand}
            onSelectCommand={insertComposerCommand}
            plugins={plugins}
            prompt={composerPrompt}
            runPending={runPending}
            run={selectedRun}
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
          activeWorkspaceId={activeWorkspaceId}
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
        onSelectRun={(runId) => {
          setRunnerSurfaceCleared(false);
          setSelectedRunId(runId);
          setActiveSection("chat");
        }}
        onSelectArtifact={(artifactId) => {
          setSelectedArtifactId(artifactId);
          setActiveSection("artifacts");
        }}
        runs={runs}
        selectedRunId={selectedRunId}
      />
      <ConfigPanel
        claudeCodeStatus={claudeCodeStatus}
        claudeCodeSavePending={claudeCodeSavePending}
        config={runnerConfig}
        connectors={connectors}
        health={runnerHealth}
        onSave={saveRunnerConfiguration}
        onSaveClaudeCode={saveClaudeCodeConfiguration}
        savePending={configSavePending}
      />
      <Dialog open={modalState.type !== "closed"} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modalState.type === "closed" ? "" : modalState.title}</DialogTitle>
            {modalState.type !== "closed" ? (
              <DialogDescription>{modalState.description}</DialogDescription>
            ) : null}
          </DialogHeader>
          {modalState.type === "prompt" ? (
            <DialogBody>
              <Input
                autoFocus
                value={modalInputValue}
                onChange={(event) => setModalInputValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    void handleModalConfirm()
                  }
                }}
                placeholder={modalState.placeholder}
              />
            </DialogBody>
          ) : null}
          <DialogFooter>
            {modalState.type === "alert" ? null : (
              <Button variant="ghost" onClick={closeModal} disabled={modalPending}>
                Cancel
              </Button>
            )}
            <Button
              variant={modalState.type === "confirm" ? modalState.confirmVariant ?? "default" : "default"}
              onClick={() => void handleModalConfirm()}
              disabled={modalPending}
            >
              {modalPending
                ? "Working..."
                : modalState.type === "closed"
                  ? "Close"
                  : modalState.type === "alert"
                    ? modalState.confirmLabel ?? "Close"
                    : modalState.confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
