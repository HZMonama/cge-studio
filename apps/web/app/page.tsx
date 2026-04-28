"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { motion } from "motion/react";
import {
  FilesIcon,
  FolderNotchOpenIcon,
  ChartBarIcon,
  LightningIcon,
  MagnifyingGlassIcon,
} from "@phosphor-icons/react";

import { AppSidebar } from "@/components/app-sidebar";
import {
  AppShellHeader,
  type AppHeaderSection,
} from "@/components/app-shell-header";
import { ArtifactsSurface } from "@/components/artifacts-surface";
import { ChatSurface } from "@/components/chat-surface";
import { FindingsSurface } from "@/components/findings-surface";
import { MetricsSurface } from "@/components/metrics-surface";
import { MetricSnapshotsPanel } from "@/components/metric-snapshots-panel";
import { ProgramSurface } from "@/components/program-surface";
import { type ProgramTab } from "@/components/program-tabs";
import { ConfigPanel } from "@/components/config-panel";
import { PluginPanel } from "@/components/plugin-panel";
import { RunnerHistoryPanel } from "@/components/runner-history-panel";
import { SectionSurface } from "@/components/section-surface";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { WorkspaceFooter } from "@/components/workspace-footer";
import {
  buildPromptFromCommandForm,
  createInitialFormValues,
  parsePromptToCommandFormValues,
  type CommandFormValues,
} from "@/lib/command-form";
import { FALLBACK_PLUGINS, getCommandForm, type Command, type Plugin } from "@/lib/plugins";
import {
  fetchConnectors,
  createRun,
  createWorkspace,
  deleteWorkspace,
  exportWorkspace,
  fetchArtifactDetail,
  fetchArtifacts,
  fetchClaudeCodeStatus,
  fetchFindingDetail,
  fetchFindings,
  fetchMetricSnapshot,
  fetchMetrics,
  fetchProgram,
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
  type RunnerFindingDetail,
  type RunnerFindingSummary,
  type RunnerMetricsResponse,
  type RunnerMetricSnapshot,
  type RunnerHealthSnapshot,
  type RunnerRun,
  type RunnerRunEvent,
  type RunnerWorkspace,
  type ProgramSummary,
} from "@/lib/runner";
import { usePluginPanel } from "@/stores/plugin-panel-store";

type AppSection = "runner" | "findings" | "program" | "metrics" | "artifacts";
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
  { id: "findings", label: "Findings", Icon: MagnifyingGlassIcon },
  { id: "program", label: "Program", Icon: FolderNotchOpenIcon },
  { id: "runner", label: "Runner", Icon: LightningIcon },
  { id: "metrics", label: "Metrics", Icon: ChartBarIcon },
  { id: "artifacts", label: "Artifacts", Icon: FilesIcon },
];

const ACTIVE_WORKSPACE_STORAGE_KEY = "cge.active-workspace-id";
const ACTIVE_SECTION_STORAGE_KEY = "cge.active-section";
const runnerClearedKey = (id: string) => `cge.runner-cleared.${id}`;

export default function Page() {
  const { openHistory, openMetricHistory } = usePluginPanel();
  const [workspaces, setWorkspaces] = useState<RunnerWorkspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(
    null,
  );
  const [activeSection, setActiveSection] = useState<AppSection>("runner");
  const [plugins, setPlugins] = useState<Plugin[]>(FALLBACK_PLUGINS);
  const [runs, setRuns] = useState<RunnerRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRunEvents, setSelectedRunEvents] = useState<RunnerRunEvent[]>([]);
  const [runEventsPending, setRunEventsPending] = useState(false);
  const [runnerSurfaceCleared, setRunnerSurfaceCleared] = useState(false);
  // Ref used to invalidate in-flight run-events fetches when the surface is cleared
  const runEventsFetchIdRef = useRef(0);
  // Ref to hold the most recently created run so the timeline can render
  // optimistically before refreshRunnerData catches up.
  const lastCreatedRunRef = useRef<RunnerRun | null>(null);
  const [artifacts, setArtifacts] = useState<RunnerArtifactSummary[]>([]);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(
    null,
  );
  const [selectedArtifact, setSelectedArtifact] =
    useState<RunnerArtifactDetail | null>(null);
  const [artifactLoading, setArtifactLoading] = useState(false);
  const [artifactError, setArtifactError] = useState<string | null>(null);
  const [findings, setFindings] = useState<RunnerFindingSummary[]>([]);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [selectedFinding, setSelectedFinding] = useState<RunnerFindingDetail | null>(null);
  const [findingLoading, setFindingLoading] = useState(false);
  const [program, setProgram] = useState<ProgramSummary | null>(null);
  const [metrics, setMetrics] = useState<RunnerMetricsResponse | null>(null);
  const [selectedMetricSnapshotId, setSelectedMetricSnapshotId] = useState<string | null>(null);
  const [selectedMetricSnapshot, setSelectedMetricSnapshot] = useState<RunnerMetricSnapshot | null>(null);
  const [programLoading, setProgramLoading] = useState(false);
  const [activeProgramTab, setActiveProgramTab] = useState<ProgramTab>(() => {
    if (typeof window === "undefined") return "risks";
    const stored = window.localStorage.getItem("cge.program-active-tab");
    return isProgramTab(stored) ? stored : "risks";
  });
  const [selectedProgramItemId, setSelectedProgramItemId] = useState<string | null>(null);
  const [runPending, setRunPending] = useState(false);
  const [healthPending, setHealthPending] = useState(true);
  const [composerFocusToken, setComposerFocusToken] = useState(0);
  const [composerPrompt, setComposerPrompt] = useState("");
  const [selectedCommandPath, setSelectedCommandPath] = useState<string | null>(
    null,
  );
  const [commandFormValues, setCommandFormValues] = useState<CommandFormValues>(
    {},
  );
  const [sidebarFocusSearchToken, setSidebarFocusSearchToken] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("cge.sidebarOpen");
      return stored ? stored === "true" : false;
    }
    return false;
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Persist sidebar state to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("cge.sidebarOpen", String(sidebarOpen));
    }
  }, [sidebarOpen]);

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
  const [modalState, setModalState] = useState<AppModalState>({ type: "closed" });
  const [modalInputValue, setModalInputValue] = useState("");
  const [modalPending, setModalPending] = useState(false);
  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === activeWorkspaceId) ??
    null;
  const selectedRun =
    runnerSurfaceCleared
      ? null
      : (runs.find((run) => run.id === selectedRunId) ??
         (lastCreatedRunRef.current?.id === selectedRunId ? lastCreatedRunRef.current : null));
  const selectedCommand = selectedCommandPath
    ? findCommandByPath(plugins, selectedCommandPath)
    : null;
  const visibleMetrics = selectedMetricSnapshot
    ? {
        current: selectedMetricSnapshot.metrics,
        snapshots: metrics?.snapshots ?? [],
      }
    : metrics;
  const selectedMetricSnapshotSummary = selectedMetricSnapshotId
    ? metrics?.snapshots.find((snapshot) => snapshot.snapshot_id === selectedMetricSnapshotId) ?? null
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

    const storedSection = window.localStorage.getItem(ACTIVE_SECTION_STORAGE_KEY);
    const validSections: AppSection[] = ["runner", "findings", "program", "metrics", "artifacts"];
    if (storedSection && validSections.includes(storedSection as AppSection)) {
      setActiveSection(storedSection as AppSection);
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
        setHealthPending(true);
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
          setHealthPending(false);
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
    window.localStorage.setItem(ACTIVE_SECTION_STORAGE_KEY, activeSection);
  }, [activeSection]);

  useEffect(() => {
    if (!activeWorkspaceId) {
      setRuns([]);
      setSelectedRunId(null);
      setSelectedRunEvents([]);
      setRunnerSurfaceCleared(false);
      setArtifacts([]);
      setSelectedArtifactId(null);
      setSelectedArtifact(null);
      setArtifactLoading(false);
      setArtifactError(null);
      setFindings([]);
      setSelectedFindingId(null);
      setSelectedFinding(null);
      setProgram(null);
      setMetrics(null);
      setSelectedMetricSnapshotId(null);
      setSelectedMetricSnapshot(null);
      return;
    }

    setSelectedMetricSnapshotId(null);
    setSelectedMetricSnapshot(null);

    const controller = new AbortController();

    const cleared = localStorage.getItem(runnerClearedKey(activeWorkspaceId)) === "true";
    if (cleared) {
      setRunnerSurfaceCleared(true);
    }

    Promise.all([
      fetchRuns(activeWorkspaceId, controller.signal),
      fetchArtifacts(activeWorkspaceId, controller.signal),
      fetchFindings(activeWorkspaceId, controller.signal),
      fetchProgram(activeWorkspaceId, controller.signal),
      fetchMetrics(activeWorkspaceId, controller.signal),
    ]).then(([nextRuns, nextArtifacts, nextFindings, nextProgram, nextMetrics]) => {
      if (controller.signal.aborted) {
        return;
      }

      setRuns(nextRuns);
      setSelectedRunId((current) =>
        cleared ? null : current && nextRuns.some((run) => run.id === current)
          ? current
          : (nextRuns[0]?.id ?? null),
      );
      setArtifacts(nextArtifacts);
      setSelectedArtifact(null);
      setArtifactLoading(false);
      setArtifactError(null);
      setSelectedArtifactId((current) =>
        current && nextArtifacts.some((artifact) => artifact.id === current)
          ? current
          : (nextArtifacts[0]?.id ?? null),
      );
      setFindings(nextFindings);
      setSelectedFindingId((current) =>
        current && nextFindings.some((f) => f.id === current)
          ? current
          : (nextFindings[0]?.id ?? null),
      );
      setProgram(nextProgram);
      setMetrics(nextMetrics);
    });

    return () => controller.abort();
  }, [activeWorkspaceId]);

  useEffect(() => {
    if (!selectedMetricSnapshotId || !metrics) {
      return;
    }

    if (!metrics.snapshots.some((snapshot) => snapshot.snapshot_id === selectedMetricSnapshotId)) {
      setSelectedMetricSnapshotId(null);
      setSelectedMetricSnapshot(null);
    }
  }, [metrics, selectedMetricSnapshotId]);

  useEffect(() => {
    if (!program) {
      setSelectedProgramItemId(null);
      return;
    }

    const ids = getProgramRecordIds(program, activeProgramTab);
    setSelectedProgramItemId((current) =>
      current && ids.includes(current) ? current : (ids[0] ?? null),
    );
  }, [activeProgramTab, program]);

  useEffect(() => {
    // If there's no active workspace or no selected run, or the surface has been cleared,
    // ensure we don't show events and invalidate any in-flight fetch.
    if (!activeWorkspaceId || !selectedRunId || runnerSurfaceCleared) {
      runEventsFetchIdRef.current += 1; // invalidate pending fetches
      setSelectedRunEvents([]);
      setRunEventsPending(false);
      return;
    }

    const controller = new AbortController();
    const fetchId = ++runEventsFetchIdRef.current;
    setRunEventsPending(true);

    fetchRunEvents(activeWorkspaceId, selectedRunId, controller.signal)
      .then((events) => {
        // ignore if aborted or superseded by a newer fetch/clear
        if (controller.signal.aborted) return;
        if (fetchId !== runEventsFetchIdRef.current) return;

        setSelectedRunEvents(events);
        setRunEventsPending(false);
      })
      .catch(() => {
        // on error, clear pending flag if this is the latest request
        if (fetchId === runEventsFetchIdRef.current) {
          setRunEventsPending(false);
        }
      });

    return () => {
      controller.abort();
      runEventsFetchIdRef.current += 1; // invalidate this fetch
    };
  }, [activeWorkspaceId, runnerSurfaceCleared, selectedRunId]);

  useEffect(() => {
    if (!activeWorkspaceId || !runs.some((run) => run.status === "running" || run.status === "pending")) {
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
      setArtifactLoading(false);
      setArtifactError(null);
      return;
    }

    const controller = new AbortController();
    setArtifactLoading(true);
    setArtifactError(null);

    fetchArtifactDetail(activeWorkspaceId, selectedArtifactId, controller.signal)
      .then((artifact) => {
        if (!controller.signal.aborted) {
          setSelectedArtifact(artifact);
          if (artifact === null) {
            setArtifactError("Artifact not found or no longer available.");
          }
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setSelectedArtifact(null);
          setArtifactError(error instanceof Error ? error.message : "Failed to load artifact");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setArtifactLoading(false);
        }
      });

    return () => controller.abort();
  }, [activeWorkspaceId, selectedArtifactId]);

  useEffect(() => {
    if (!activeWorkspaceId || !selectedFindingId) {
      setSelectedFinding(null);
      setFindingLoading(false);
      return;
    }

    const controller = new AbortController();
    setFindingLoading(true);

    fetchFindingDetail(activeWorkspaceId, selectedFindingId, controller.signal).then(
      (finding) => {
        if (!controller.signal.aborted) {
          setSelectedFinding(finding);
          setFindingLoading(false);
        }
      },
    );

    return () => controller.abort();
  }, [activeWorkspaceId, selectedFindingId]);

  const visibleArtifact = selectedArtifactId ? selectedArtifact : null;

  function insertComposerCommand(path: string) {
    setActiveSection("runner");
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

  function editAndRerunRun(run: RunnerRun | null) {
    if (!run) {
      return;
    }

    const prompt =
      run.prompt?.trim() ||
      run.commandPreview?.trim() ||
      run.commandPath?.trim() ||
      "";
    const commandPath = run.commandPath ?? extractCommandPath(prompt);

    setActiveSection("runner");
    setRunnerSurfaceCleared(false);
    setSelectedRunId(run.id);
    setComposerFocusToken((prev) => prev + 1);

    if (!commandPath) {
      setSelectedCommandPath(null);
      setCommandFormValues({});
      setComposerPrompt(prompt);
      return;
    }

    const command = findCommandByPath(plugins, commandPath);
    if (!command) {
      setSelectedCommandPath(null);
      setCommandFormValues({});
      setComposerPrompt(prompt);
      return;
    }

    if (!command.form) {
      setSelectedCommandPath(commandPath);
      setCommandFormValues({});
      setComposerPrompt(prompt || commandPath);
      return;
    }

    if (!prompt) {
      insertComposerCommand(commandPath);
      return;
    }

    const parsedValues = parsePromptToCommandFormValues(
      commandPath,
      command.form,
      prompt,
    );

    if (parsedValues === null) {
      setSelectedCommandPath(null);
      setCommandFormValues({});
      setComposerPrompt(prompt);
      return;
    }

    setSelectedCommandPath(commandPath);
    setCommandFormValues(parsedValues);
    setComposerPrompt(
      buildPromptFromCommandForm(commandPath, command.form, parsedValues),
    );
  }

  function updateSelectedCommandForm(values: CommandFormValues) {
    setCommandFormValues(values);

    const form = getCommandForm(selectedCommand);
    if (selectedCommandPath && form) {
      setComposerPrompt(
        buildPromptFromCommandForm(
          selectedCommandPath,
          form,
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
      setArtifactLoading(false);
      setArtifactError(null);
      setFindings([]);
      setSelectedFindingId(null);
      setSelectedFinding(null);
      setProgram(null);
      setMetrics(null);
      setSelectedMetricSnapshotId(null);
      setSelectedMetricSnapshot(null);
      return;
    }

    const [nextRuns, nextArtifacts, nextFindings, nextProgram, nextMetrics, nextConnectors] = await Promise.all([
      fetchRuns(workspaceId),
      fetchArtifacts(workspaceId),
      fetchFindings(workspaceId),
      fetchProgram(workspaceId),
      fetchMetrics(workspaceId),
      fetchConnectors(),
    ]);

    const refreshCleared = localStorage.getItem(runnerClearedKey(workspaceId)) === "true";
    setRuns(nextRuns);
    setSelectedRunId((current) =>
      refreshCleared ? null : current ?? nextRuns[0]?.id ?? null,
    );
    setArtifacts(nextArtifacts);
    setSelectedArtifactId((current) =>
      current && nextArtifacts.some((artifact) => artifact.id === current)
        ? current
        : (nextArtifacts[0]?.id ?? null),
    );
    setFindings(nextFindings);
    setSelectedFindingId((current) =>
      current && nextFindings.some((f) => f.id === current)
        ? current
        : (nextFindings[0]?.id ?? null),
    );
    setProgram(nextProgram);
    setMetrics(nextMetrics);
    setConnectors(nextConnectors);
  }

  async function selectMetricSnapshot(snapshotId: string) {
    if (!activeWorkspaceId) {
      return;
    }

    setActiveSection("metrics");
    setSelectedMetricSnapshotId(snapshotId);

    const snapshot = await fetchMetricSnapshot(activeWorkspaceId, snapshotId);
    if (!snapshot) {
      openAlert("Snapshot unavailable", "The selected metric snapshot could not be loaded.");
      setSelectedMetricSnapshotId(null);
      setSelectedMetricSnapshot(null);
      return;
    }

    setSelectedMetricSnapshot(snapshot);
  }

  async function runComposerCommand() {
    const prompt = composerPrompt.trim();
    const form = getCommandForm(selectedCommand);
    const redactedPrompt =
      selectedCommandPath && form
        ? buildPromptFromCommandForm(
            selectedCommandPath,
            form,
            commandFormValues,
            { redactSecrets: true },
          )
        : prompt;

    if (!activeWorkspaceId || !/^\/[a-z0-9-]+:[a-z0-9-]+/i.test(prompt)) {
      return;
    }

    setRunPending(true);
    let run: RunnerRun | null = null;

    try {
      run = await createRun(activeWorkspaceId, prompt, redactedPrompt);
      setRunnerSurfaceCleared(false);
      localStorage.removeItem(runnerClearedKey(activeWorkspaceId));
      if (run) {
        const createdRun = { ...run, artifacts: run.artifacts ?? [] };
        lastCreatedRunRef.current = createdRun;
        setRuns((prev) => {
          if (prev.some((r) => r.id === createdRun.id)) return prev;
          return [createdRun, ...prev];
        });
      }
      setSelectedRunId(run?.id ?? null);
      setSelectedRunEvents([]);
      setActiveSection("runner");
      if (run !== null) {
        clearSelectedCommand();
        setComposerPrompt("");
      }
      await refreshRunnerData(activeWorkspaceId);
    } finally {
      setRunPending(false);
    }

    if (run?.artifacts?.[0]?.id) {
      setSelectedArtifactId(run.artifacts[0].id);
    }
  }

  async function runPipeline(pipelinePath: string) {
    if (!activeWorkspaceId) return;
    setRunPending(true);
    let run: RunnerRun | null = null;
    try {
      run = await createRun(activeWorkspaceId, pipelinePath, pipelinePath);
      setRunnerSurfaceCleared(false);
      localStorage.removeItem(runnerClearedKey(activeWorkspaceId));
      if (run) {
        const createdRun = { ...run, artifacts: run.artifacts ?? [] };
        lastCreatedRunRef.current = createdRun;
        setRuns((prev) => {
          if (prev.some((r) => r.id === createdRun.id)) return prev;
          return [createdRun, ...prev];
        });
      }
      setSelectedRunId(run?.id ?? null);
      setSelectedRunEvents([]);
      setActiveSection("runner");
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
    try {
      const next = await updateClaudeCodeConfig({ model: input.model });
      if (!next) {
        openAlert("Claude Code save failed", "The Claude Code configuration could not be saved.");
        return;
      }

      setClaudeCodeStatus(next);
    } catch {
      openAlert("Claude Code save failed", "The Claude Code configuration could not be saved.");
    }
  }

  const isSidebarVisible =
    activeSection === "metrics" ? false : activeSection === "runner" ? sidebarOpen : true

  return (
    <div className="grid h-screen grid-rows-[auto_1fr_auto] overflow-hidden bg-[var(--editor-bg)]">
      {/* App Header - Full Width */}
      <AppShellHeader
        activeSection={activeSection}
        onSelectSection={(section) => setActiveSection(section as AppSection)}
        sections={HEADER_SECTIONS}
      />

      {/* Main Content Area - Sidebar + Content */}
      <div className="flex min-h-0 overflow-hidden">
        <motion.div
          initial={false}
          animate={{
            width: mounted && isSidebarVisible ? "var(--app-sidebar-w)" : 0,
            opacity: mounted && isSidebarVisible ? 1 : 0,
          }}
          transition={{ duration: 0.2 }}
          className="h-full shrink-0 overflow-hidden"
        >
          <div className="h-full w-[var(--app-sidebar-w)]">
            <AppSidebar
                activeSection={activeSection}
                activeProgramTab={activeProgramTab}
                artifacts={artifacts}
                findings={findings}
                focusSearchToken={sidebarFocusSearchToken}
                onSelectArtifact={(artifactId) => {
                  setActiveSection("artifacts");
                  setSelectedArtifactId(artifactId);
                }}
                onSelectFinding={(findingId) => {
                  setActiveSection("findings");
                  setSelectedFindingId(findingId);
                  setSelectedFinding(null);
                }}
                onSelectProgramItem={(itemId) => setSelectedProgramItemId(itemId)}
                plugins={plugins}
                program={program}
                selectedArtifactId={selectedArtifactId}
                selectedFindingId={selectedFindingId}
                selectedProgramItemId={selectedProgramItemId}
              />
            </div>
          </motion.div>
        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col basis-0 overflow-hidden bg-background">
          {!activeWorkspace ? (
            <SectionSurface
              title="Create a workspace"
              description="Choose a filesystem folder to initialize a .cge workspace before running commands or browsing artifacts."
            />
          ) : activeSection === "runner" ? (
            <ChatSurface
              commandFormValues={commandFormValues}
              events={selectedRunEvents}
              focusToken={composerFocusToken}
              loadingEvents={runEventsPending}
              onEditAndRerun={() => editAndRerunRun(selectedRun)}
              onClearRunner={() => {
                setRunnerSurfaceCleared(true);
                setSelectedRunId(null);
                setSelectedRunEvents([]);
                setSelectedArtifactId(null);
                setSelectedArtifact(null);
                setArtifactLoading(false);
                setArtifactError(null);
                clearSelectedCommand();
                setComposerPrompt("");
                if (activeWorkspaceId) {
                  localStorage.setItem(runnerClearedKey(activeWorkspaceId), "true");
                }
              }}
              onClearSelectedCommand={clearSelectedCommand}
              onCommandFormChange={updateSelectedCommandForm}
              onOpenArtifact={(artifactId) => {
                setSelectedArtifactId(artifactId);
                setActiveSection("artifacts");
              }}
              onOpenHistory={openHistory}
              onSubmitPrompt={async (promptId, answers) => {
                if (!activeWorkspaceId || !selectedRunId) {
                  return;
                }

                const updated = await respondToRunPrompt(
                  activeWorkspaceId,
                  selectedRunId,
                  promptId,
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
              onRunPipeline={runPipeline}
              onSelectCommand={insertComposerCommand}
              onToggleSidebar={() => setSidebarOpen((v) => !v)}
              plugins={plugins}
              prompt={composerPrompt}
              runPending={runPending}
              run={selectedRun}
              selectedCommand={selectedCommand}
              selectedCommandPath={selectedCommandPath}
              setPrompt={setComposerPrompt}
              sidebarOpen={sidebarOpen}
            />
          ) : activeSection === "findings" ? (
            <FindingsSurface
              finding={selectedFindingId ? selectedFinding : null}
              loading={findingLoading && selectedFindingId !== null}
            />
          ) : activeSection === "program" ? (
            <ProgramSurface
              activeTab={activeProgramTab}
              program={program}
              loading={programLoading}
              selectedItemId={selectedProgramItemId}
              onSelectTab={(tab) => setActiveProgramTab(tab)}
            />
          ) : activeSection === "metrics" ? (
            <MetricsSurface
              connectors={connectors}
              findings={findings}
              metrics={visibleMetrics}
              onClearSnapshot={() => {
                setSelectedMetricSnapshotId(null);
                setSelectedMetricSnapshot(null);
              }}
              onOpenHistory={openMetricHistory}
              program={program}
              loading={programLoading}
              selectedSnapshotRecordedAt={
                selectedMetricSnapshot?.recorded_at ??
                selectedMetricSnapshotSummary?.recorded_at ??
                null
              }
              selectedSnapshotId={selectedMetricSnapshotId}
              workspaceName={activeWorkspace?.title}
              plugins={plugins}
            />
          ) : (
            <ArtifactsSurface
              artifact={visibleArtifact}
              loading={artifactLoading}
              error={artifactError}
            />
          )}
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
            setActiveSection("runner");
          }}
          onSelectArtifact={(artifactId) => {
            setSelectedArtifactId(artifactId);
            setActiveSection("artifacts");
          }}
          runs={runs}
          selectedRunId={selectedRunId}
        />
        <MetricSnapshotsPanel
          onSelectSnapshot={(snapshotId) => void selectMetricSnapshot(snapshotId)}
          selectedSnapshotId={selectedMetricSnapshotId}
          snapshots={metrics?.snapshots ?? []}
        />
        <ConfigPanel
          claudeCodeStatus={claudeCodeStatus}
          config={runnerConfig}
          health={runnerHealth}
          onSaveModel={saveClaudeCodeConfiguration}
        />
        <Dialog open={modalState.type !== "closed"} onOpenChange={(open) => !open && closeModal()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{modalState.type === "closed" ? "" : modalState.title}</DialogTitle>
            </DialogHeader>
            {modalState.type === "prompt" ? (
              <Input
                autoFocus
                className="border-x-0 border-b-0 border-t border-border/60 px-6 py-5 h-auto rounded-none"
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

      {/* App Footer - Full Width */}
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

function isProgramTab(value: string | null): value is ProgramTab {
  return (
    value === "risks" ||
    value === "exceptions" ||
    value === "vendors" ||
    value === "policies" ||
    value === "controls"
  );
}

function getProgramRecordIds(program: ProgramSummary, tab: ProgramTab): string[] {
  switch (tab) {
    case "risks":
      return program.risks.map((risk) => risk.risk_id);
    case "exceptions":
      return program.exceptions.map((exception) => exception.exception_id);
    case "vendors":
      return program.vendors.map((vendor) => vendor.vendor_id);
    case "policies":
      return program.policies.map((policy) => policy.policy_id);
    case "controls":
      return program.controls.map((control) => control.control_id);
  }
}

function extractCommandPath(prompt: string | null | undefined): string | null {
  const match = prompt?.trim().match(/^\/[a-z0-9-]+:[a-z0-9-]+/i);
  return match ? match[0] : null;
}
