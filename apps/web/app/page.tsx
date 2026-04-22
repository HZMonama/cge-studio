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
  fetchArtifactDetail,
  fetchArtifacts,
  fetchPluginRegistry,
  fetchRunnerHealth,
  fetchRuns,
  type RunnerArtifactDetail,
  type RunnerArtifactSummary,
  type RunnerRun,
} from "@/lib/runner";
import { usePluginPanel } from "@/stores/plugin-panel-store";

interface Workspace {
  id: string;
  title: string;
}

type AppSection = "chat" | "dashboards" | "findings" | "program" | "artifacts";

const HEADER_SECTIONS: AppHeaderSection[] = [
  { id: "chat", label: "Runner", Icon: LightningIcon },
  { id: "dashboards", label: "Dashboards", Icon: ChartBarIcon },
  { id: "findings", label: "Findings", Icon: MagnifyingGlassIcon },
  { id: "program", label: "Program", Icon: FolderNotchOpenIcon },
  { id: "artifacts", label: "Artifacts", Icon: FilesIcon },
];

const INITIAL_WORKSPACE: Workspace = {
  id: "workspace-initial",
  title: "Untitled",
};

function newWorkspace(): Workspace {
  return { id: crypto.randomUUID(), title: "Untitled" };
}

export default function Page() {
  const { openHistory } = usePluginPanel();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([
    INITIAL_WORKSPACE,
  ]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(
    INITIAL_WORKSPACE.id,
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
  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === activeWorkspaceId) ??
    workspaces[0];
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
        const [health, registry, nextRuns, items] = await Promise.all([
          fetchRunnerHealth(signal),
          fetchPluginRegistry(signal),
          fetchRuns(signal),
          fetchArtifacts(signal),
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

        setRuns(nextRuns);
        setArtifacts(items);
        setSelectedArtifactId((current) => current ?? items[0]?.id ?? null);
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
    if (!selectedArtifactId) {
      return;
    }

    const controller = new AbortController();

    fetchArtifactDetail(selectedArtifactId, controller.signal).then(
      (artifact) => {
        setSelectedArtifact(artifact);
      },
    );

    return () => controller.abort();
  }, [selectedArtifactId]);

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

  async function refreshRunnerData() {
    const [nextRuns, nextArtifacts] = await Promise.all([
      fetchRuns(),
      fetchArtifacts(),
    ]);

    setRuns(nextRuns);
    setArtifacts(nextArtifacts);
    setSelectedArtifactId((current) =>
      current && nextArtifacts.some((artifact) => artifact.id === current)
        ? current
        : (nextArtifacts[0]?.id ?? null),
    );
  }

  async function runComposerCommand() {
    const prompt = composerPrompt.trim();
    if (!/^\/[a-z0-9-]+:[a-z0-9-]+/i.test(prompt)) {
      return;
    }

    setRunPending(true);
    let run: RunnerRun | null = null;

    try {
      run = await createRun(prompt);
      await refreshRunnerData();
    } finally {
      setRunPending(false);
    }

    if (run?.artifacts?.[0]?.id) {
      setSelectedArtifactId(run.artifacts[0].id);
      openHistory();
    }
  }

  function addWorkspace() {
    const workspace = newWorkspace();
    setWorkspaces((prev) => [...prev, workspace]);
    setActiveWorkspaceId(workspace.id);
  }

  function closeWorkspace(id: string) {
    setWorkspaces((prev) => {
      if (prev.length === 1) return prev;
      const idx = prev.findIndex((workspace) => workspace.id === id);
      const next = prev.filter((workspace) => workspace.id !== id);
      if (activeWorkspaceId === id)
        setActiveWorkspaceId(next[Math.max(0, idx - 1)].id);
      return next;
    });
  }

  function renameActiveWorkspace() {
    const nextTitle = window.prompt("Rename workspace", activeWorkspace.title);
    const title = nextTitle?.trim();
    if (!title) return;

    setWorkspaces((prev) =>
      prev.map((workspace) =>
        workspace.id === activeWorkspace.id
          ? { ...workspace, title }
          : workspace,
      ),
    );
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
            void refreshRunnerConnection();
          }}
          sections={HEADER_SECTIONS}
          syncPending={syncPending}
          syncStatus={syncStatus}
        />

        {activeSection === "chat" && (
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
        )}
        {activeSection === "dashboards" && (
          <SectionSurface
            title="Dashboards"
            description="Dashboard views will live here once the specialized monitoring surfaces are wired in."
          />
        )}
        {activeSection === "findings" && (
          <SectionSurface
            title="Findings"
            description="Structured findings will live here once the findings explorer and remediation links are wired in."
          />
        )}
        {activeSection === "program" && (
          <SectionSurface
            title="Program"
            description="Program state, risks, and operational records will live here as a dedicated interface."
          />
        )}
        {activeSection === "artifacts" && (
          <ArtifactsSurface
            artifact={visibleArtifact}
            loading={artifactLoading}
          />
        )}

        <WorkspaceFooter
          activeWorkspaceId={activeWorkspaceId}
          onAddWorkspace={addWorkspace}
          onCloseWorkspace={closeWorkspace}
          onRenameWorkspace={renameActiveWorkspace}
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
      <ConfigPanel />
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
