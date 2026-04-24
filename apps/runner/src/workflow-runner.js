import fs from "node:fs/promises";
import path from "node:path";

const workflowDefinitions = [
  defineWorkflow({
    commandPath: "/pipeline:evidence-to-gap",
    handlerId: "pipeline.evidence-to-gap",
    workflowType: "pipeline",
    start: startEvidenceToGapPipeline,
    respond: respondEvidenceToGapPipeline,
  }),
  defineWorkflow({
    commandPath: "/pipeline:iac-compliance",
    handlerId: "pipeline.iac-compliance",
    workflowType: "pipeline",
    start: startIacCompliancePipeline,
    respond: respondIacCompliancePipeline,
  }),
  defineWorkflow({
    commandPath: "/pipeline:multi-cloud-collect",
    handlerId: "pipeline.multi-cloud-collect",
    workflowType: "pipeline",
    start: startMultiCloudCollectPipeline,
    respond: respondMultiCloudCollectPipeline,
  }),
  defineWorkflow({
    commandPath: "/pipeline:fedramp-package",
    handlerId: "pipeline.fedramp-package",
    workflowType: "pipeline",
    start: startFedRampPackagePipeline,
    respond: respondFedRampPackagePipeline,
  }),
  defineWorkflow({
    commandPath: "/pipeline:new-framework-onboard",
    handlerId: "pipeline.new-framework-onboard",
    workflowType: "pipeline",
    start: startNewFrameworkOnboardPipeline,
    respond: respondNewFrameworkOnboardPipeline,
  }),
  defineWorkflow({
    commandPath: "/pipeline:control-test-and-report",
    handlerId: "pipeline.control-test-and-report",
    workflowType: "pipeline",
    start: startControlTestAndReportPipeline,
    respond: respondControlTestAndReportPipeline,
  }),
  defineWorkflow({
    commandPath: "/pipeline:tprm-assessment",
    handlerId: "pipeline.tprm-assessment",
    workflowType: "pipeline",
    start: startTprmAssessmentPipeline,
    respond: respondTprmAssessmentPipeline,
  }),
  defineWorkflow({
    commandPath: "/pipeline:incident-response",
    handlerId: "pipeline.incident-response",
    workflowType: "pipeline",
    start: startIncidentResponsePipeline,
    respond: respondIncidentResponsePipeline,
  }),
  defineWorkflow({
    commandPath: "/pipeline:audit-prep",
    handlerId: "pipeline.audit-prep",
    workflowType: "pipeline",
    start: startAuditPrepPipeline,
    respond: respondAuditPrepPipeline,
  }),
  defineWorkflow({
    commandPath: "/grc-reporter:exec-summary",
    handlerId: "grc-reporter.exec-summary",
    workflowType: "exec-summary",
    start: startExecSummaryWorkflow,
    respond: respondExecSummaryWorkflow,
  }),
  defineWorkflow({
    commandPath: "/grc-reporter:board-brief",
    handlerId: "grc-reporter.board-brief",
    workflowType: "board-brief",
    start: startBoardBriefWorkflow,
    respond: respondBoardBriefWorkflow,
  }),
  defineWorkflow({
    commandPath: "/grc-reporter:automation-coverage",
    handlerId: "grc-reporter.automation-coverage",
    workflowType: "automation-coverage",
    start: startAutomationCoverageWorkflow,
    respond: respondAutomationCoverageWorkflow,
  }),
  defineWorkflow({
    commandPath: "/grc-reporter:program-health",
    handlerId: "grc-reporter.program-health",
    workflowType: "program-health",
    start: startProgramHealthWorkflow,
    respond: respondProgramHealthWorkflow,
  }),
];

const workflowRegistry = createWorkflowRegistry(workflowDefinitions);

export function resolveWorkflowExecution(parsed) {
  const definition = workflowRegistry.byCommandPath.get(parsed.commandPath);
  if (!definition) {
    return null;
  }

  return {
    kind: "workflow",
    commandPath: parsed.commandPath,
    pluginId: parsed.pluginId,
    commandId: parsed.commandId,
    args: parsed.argumentTokens,
    workflowType: definition.workflowType,
    handlerId: definition.handlerId,
  };
}

export function createWorkflowRuntime(deps) {
  return {
    async executeWorkflowRun(input) {
      const definition = workflowRegistry.byCommandPath.get(
        input.execution.commandPath,
      );

      await deps.appendRunEvent(input.runDirectory, {
        type: "run.started",
        data: {
          commandPreview: input.run.commandPreview,
          handlerId: input.execution.handlerId,
          workflowType: input.execution.workflowType,
        },
      });

      if (!definition) {
        await deps.appendRunEvent(input.runDirectory, {
          type: "run.failed",
          data: {
            message: "Workflow type is not implemented.",
          },
        });
        await deps.writeRun(input.runDirectory, {
          ...input.run,
          completedAt: new Date().toISOString(),
          status: "failed",
        });
        return;
      }

      return definition.start({
        ...input,
        ...deps,
        definition,
      });
    },

    async respondToWorkflowRun(input) {
      const runDirectory =
        typeof input.run?.runDirectory === "string" ? input.run.runDirectory : null;
      if (!runDirectory) {
        return null;
      }

      const workflowState = await readWorkflowState(runDirectory);
      if (!workflowState || workflowState.phase !== "awaiting_input") {
        return null;
      }

      const definition =
        (typeof workflowState.handlerId === "string" &&
          workflowRegistry.byHandlerId.get(workflowState.handlerId)) ||
        (typeof workflowState.type === "string" &&
          workflowRegistry.byWorkflowType.get(workflowState.type)) ||
        null;

      if (!definition) {
        return null;
      }

      return definition.respond({
        ...input,
        ...deps,
        definition,
        runDirectory,
        workflowState,
      });
    },
  };
}

function defineWorkflow(definition) {
  return Object.freeze(definition);
}

function createWorkflowRegistry(definitions) {
  return {
    definitions,
    byCommandPath: new Map(
      definitions.map((definition) => [definition.commandPath, definition]),
    ),
    byHandlerId: new Map(
      definitions.map((definition) => [definition.handlerId, definition]),
    ),
    byWorkflowType: new Map(
      definitions.map((definition) => [definition.workflowType, definition]),
    ),
  };
}

async function startExecSummaryWorkflow(input) {
  const context = await collectExecSummaryContext({
    findLatestJsonFile: input.findLatestJsonFile,
    parsePrompt: input.parsePrompt,
    readRuns: input.readRuns,
    workspace: input.workspace,
  });

  if (!context.hasMinimumContext) {
    await input.appendRunEvent(input.runDirectory, {
      type: "message",
      data: {
        role: "assistant",
        text: [
          "The workspace does not have enough context for `/grc-reporter:exec-summary` yet.",
          "Minimum path: run `/github-inspector:collect`, then `/grc-engineer:gap-assessment SOC2 --sources=github-inspector` before generating the summary.",
        ].join("\n\n"),
      },
    });
    await input.appendRunEvent(input.runDirectory, {
      type: "run.failed",
      data: {
        message:
          "Missing findings context. Populate connector findings and at least one gap-assessment run first.",
      },
    });
    await input.writeRun(input.runDirectory, {
      ...input.run,
      completedAt: new Date().toISOString(),
      status: "failed",
    });
    return;
  }

  const [periodArg, audienceArg] = input.execution.args;
  const workflowState = {
    handlerId: input.definition.handlerId,
    type: input.execution.workflowType,
    phase: "awaiting_input",
    period: periodArg || currentIsoWeek(),
    audience: audienceArg || "ciso",
    context,
  };

  await writeWorkflowState(input.runDirectory, workflowState);
  await input.appendRunEvent(input.runDirectory, {
    type: "message",
    data: {
      role: "assistant",
      text: buildExecSummaryContextMessage({
        audience: workflowState.audience,
        context,
        period: workflowState.period,
      }),
    },
  });
  await input.appendRunEvent(input.runDirectory, {
    type: "prompt.required",
    data: {
      promptId: "exec-summary-context",
      title: "Narrative context required",
      submitLabel: "Generate summary",
      fields: [
        {
          id: "wins",
          label: "Wins this week",
          placeholder:
            "Automations shipped, controls closed, audits passed, programs launched.",
        },
        {
          id: "material_events",
          label: "Material events",
          placeholder:
            "Incidents, new regulatory hits, customer escalations, or 'none'.",
        },
        {
          id: "leadership_asks",
          label: "Leadership asks",
          placeholder:
            "Decisions, budget requests, access blockers, or 'none'.",
        },
      ],
    },
  });
}

async function respondExecSummaryWorkflow(input) {
  const answers = normalizePromptAnswers(input.response);
  const completedAt = new Date().toISOString();
  const reportPath = path.join(
    input.workspace.rootPath,
    "grc-reports",
    `exec-summary-${input.workflowState.period}.md`,
  );

  await fs.mkdir(path.dirname(reportPath), { recursive: true });

  await input.appendRunEvent(input.runDirectory, {
    type: "message",
    data: {
      role: "user",
      text: [
        `Wins: ${answers.wins}`,
        `Material events: ${answers.material_events}`,
        `Leadership asks: ${answers.leadership_asks}`,
      ].join("\n"),
    },
  });

  const reportContent = renderExecSummaryReport({
    answers,
    audience: input.workflowState.audience,
    context: input.workflowState.context,
    period: input.workflowState.period,
  });

  await fs.writeFile(reportPath, reportContent, "utf8");

  const artifact = input.createArtifactSummary({
    commandId: input.run.commandId,
    commandPath: input.run.commandPath,
    createdAt: completedAt,
    format: "markdown",
    kind: "report",
    path: reportPath,
    pluginId: input.run.pluginId,
    runId: input.run.id,
    title: "Executive Summary",
  });

  const nextRun = {
    ...input.run,
    artifacts: [artifact],
    artifactCount: 1,
    completedAt,
    status: "completed",
  };

  await input.appendRunEvent(input.runDirectory, {
    type: "artifact.created",
    data: {
      artifactId: artifact.id,
      title: artifact.title,
      kind: artifact.kind,
      format: artifact.format,
      path: artifact.path,
    },
  });
  await input.appendRunEvent(input.runDirectory, {
    type: "message",
    data: {
      role: "assistant",
      text: `Wrote the weekly brief to ${reportPath}.`,
    },
  });
  await input.appendRunEvent(input.runDirectory, {
    type: "run.completed",
    data: {
      artifactCount: 1,
      exitCode: 0,
    },
  });

  await writeWorkflowState(input.runDirectory, {
    ...input.workflowState,
    phase: "completed",
    answers,
    reportPath,
  });
  await input.writeRun(input.runDirectory, nextRun);

  return nextRun;
}

async function readWorkflowState(runDirectory) {
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

async function writeWorkflowState(runDirectory, state) {
  await fs.writeFile(
    path.join(runDirectory, "workflow-state.json"),
    JSON.stringify(state, null, 2),
    "utf8",
  );
}

async function collectExecSummaryContext(input) {
  const findingsBySource = await Promise.all(
    Object.entries(input.workspace.folders.findingsRawConnectors).map(
      async ([source, sourcePath]) => {
        const latestFile = await input.findLatestJsonFile(sourcePath);
        if (!latestFile) {
          return null;
        }

        const stats = await fs.stat(latestFile);
        let resources = 0;
        let evaluations = 0;

        try {
          const payload = JSON.parse(await fs.readFile(latestFile, "utf8"));
          const docs = Array.isArray(payload) ? payload : [payload];
          resources = docs.length;
          evaluations = docs.reduce(
            (total, doc) =>
              total +
              (Array.isArray(doc?.evaluations) ? doc.evaluations.length : 0),
            0,
          );
        } catch {
          resources = 0;
          evaluations = 0;
        }

        return {
          latestFile,
          resources,
          evaluations,
          source,
          updatedAt: stats.mtime.toISOString(),
        };
      },
    ),
  );

  const recentSources = findingsBySource.filter(Boolean);
  const latestGapRun = (
    await input.readRuns(input.workspace)
  ).find(
    (run) =>
      run.commandPath === "/grc-engineer:gap-assessment" &&
      run.status === "completed",
  );
  const frameworks = parseGapAssessmentFrameworks(
    latestGapRun?.prompt ?? "",
    input.parsePrompt,
  );

  return {
    frameworks,
    hasMinimumContext: recentSources.length > 0,
    latestGapRun: latestGapRun
      ? {
          id: latestGapRun.id,
          artifactPath:
            latestGapRun.artifacts?.find((artifact) =>
              path.basename(artifact.path).startsWith("gap-report."),
            )?.path ??
            latestGapRun.artifacts?.[0]?.path ??
            null,
          prompt: latestGapRun.prompt ?? "",
        }
      : null,
    recentSources,
  };
}

function parseGapAssessmentFrameworks(prompt, parsePrompt) {
  const parsed = parsePrompt(prompt);
  if (!parsed || parsed.commandPath !== "/grc-engineer:gap-assessment") {
    return [];
  }

  const [frameworksArg] = parsed.argumentTokens;
  if (!frameworksArg) {
    return [];
  }

  return frameworksArg
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function buildExecSummaryContextMessage(input) {
  const sourceSummary = input.context.recentSources
    .map(
      (source) =>
        `${source.source}: ${source.resources} resources, ${source.evaluations} evaluations (${source.updatedAt.slice(0, 10)})`,
    )
    .join("\n");

  const frameworks =
    input.context.frameworks.length > 0
      ? input.context.frameworks.join(", ")
      : "No recent gap-assessment frameworks detected";

  return [
    `Preparing a weekly brief for ${input.audience} (${input.period}).`,
    "",
    "Available context:",
    sourceSummary,
    `Frameworks in scope: ${frameworks}`,
    input.context.latestGapRun?.artifactPath
      ? `Latest gap report: ${input.context.latestGapRun.artifactPath}`
      : "Latest gap report: none detected",
    "",
    "Provide the narrative context that the toolkit cannot infer from findings alone.",
  ].join("\n");
}

function normalizePromptAnswers(response) {
  const answers =
    response?.answers && typeof response.answers === "object"
      ? response.answers
      : response;

  return {
    wins: normalizeAnswerValue(answers?.wins),
    material_events: normalizeAnswerValue(answers?.material_events),
    leadership_asks: normalizeAnswerValue(answers?.leadership_asks),
  };
}

function normalizeAnswerValue(value) {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : "none";
}

function renderExecSummaryReport(input) {
  const topSource = input.context.recentSources[0];
  const frameworkSummary =
    input.context.frameworks.length > 0
      ? input.context.frameworks.join(", ")
      : "findings-only";
  const topGapPath = input.context.latestGapRun?.artifactPath ?? "none recorded";

  return [
    `# Weekly Brief - ${input.period}`,
    "",
    `Audience: ${input.audience}`,
    "",
    "## Headline",
    "",
    `- ${buildExecHeadline(input)}`,
    "",
    "## Wins",
    "",
    ...toBulletLines(input.answers.wins),
    "",
    "## What Moved",
    "",
    `- ${topSource ? `${topSource.source} produced ${topSource.resources} recent resources and ${topSource.evaluations} evaluations across the current evidence set.` : "Recent evidence is limited; the current summary is grounded in the available findings cache only."}`,
    `- ${input.context.latestGapRun ? `The latest gap-assessment run mapped current findings across ${frameworkSummary}.` : "No recent gap-assessment run was found, so cross-framework posture is inferred from connector findings only."}`,
    ...toBulletLines(input.answers.material_events),
    "",
    "## Blockers",
    "",
    ...buildBlockers(input),
    "",
    "## Asks",
    "",
    ...toBulletLines(input.answers.leadership_asks),
    "",
    "## Appendix",
    "",
    `- Findings sources: ${input.context.recentSources.map((source) => source.source).join(", ")}`,
    `- Frameworks covered: ${frameworkSummary}`,
    `- Full gap report: ${topGapPath}`,
  ].join("\n");
}

function buildExecHeadline(input) {
  if (input.answers.material_events !== "none") {
    return "The week moved on active evidence and material events; leadership attention is needed on the items named below.";
  }

  if (input.answers.leadership_asks !== "none") {
    return "Evidence collection is current, but leadership decisions are needed to unblock the next round of control and remediation work.";
  }

  return `Evidence remains current across ${input.context.recentSources.length} source${input.context.recentSources.length === 1 ? "" : "s"}, with the main story this week coming from delivered wins rather than new blockers.`;
}

function buildBlockers(input) {
  if (
    input.answers.material_events === "none" &&
    input.answers.leadership_asks === "none"
  ) {
    return [
      "- No new blocker was supplied this cycle. Keep pressure on closing open findings and refresh the next gap-assessment after the next collection run.",
    ];
  }

  const bullets = [];
  if (input.answers.material_events !== "none") {
    bullets.push(...toBulletLines(input.answers.material_events));
  }
  if (input.answers.leadership_asks !== "none") {
    bullets.push(...toBulletLines(input.answers.leadership_asks));
  }

  return bullets;
}

function toBulletLines(value) {
  return String(value)
    .split(/\n+/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (line.startsWith("-") ? line : `- ${line}`));
}

function currentIsoWeek() {
  const now = new Date();
  const date = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function currentIsoQuarter() {
  const now = new Date();
  const q = Math.ceil((now.getUTCMonth() + 1) / 3);
  return `${now.getUTCFullYear()}-Q${q}`;
}

function currentIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Board Brief ─────────────────────────────────────────────────────────────

async function collectBoardBriefContext(input) {
  const findingsBySource = await Promise.all(
    Object.entries(input.workspace.folders.findingsRawConnectors).map(
      async ([source, sourcePath]) => {
        const latestFile = await input.findLatestJsonFile(sourcePath);
        if (!latestFile) return null;
        const stats = await fs.stat(latestFile);
        let evaluations = 0;
        let resources = 0;
        try {
          const payload = JSON.parse(await fs.readFile(latestFile, "utf8"));
          const docs = Array.isArray(payload) ? payload : [payload];
          resources = docs.length;
          evaluations = docs.reduce(
            (t, d) => t + (Array.isArray(d?.evaluations) ? d.evaluations.length : 0),
            0,
          );
        } catch { /* tolerate malformed files */ }
        return { source, resources, evaluations, updatedAt: stats.mtime.toISOString() };
      },
    ),
  );

  const allRuns = await input.readRuns(input.workspace);
  const gapRuns = allRuns.filter(
    (r) => r.commandPath === "/grc-engineer:gap-assessment" && r.status === "completed",
  );
  const frameworks = [
    ...new Set(
      gapRuns.flatMap((r) => parseGapAssessmentFrameworks(r.prompt ?? "", input.parsePrompt)),
    ),
  ];

  return {
    hasMinimumContext: findingsBySource.filter(Boolean).length > 0 || gapRuns.length > 0,
    recentSources: findingsBySource.filter(Boolean),
    frameworks,
    gapRunCount: gapRuns.length,
    latestGapRun: gapRuns[0] ?? null,
  };
}

async function startBoardBriefWorkflow(input) {
  const context = await collectBoardBriefContext({
    findLatestJsonFile: input.findLatestJsonFile,
    parsePrompt: input.parsePrompt,
    readRuns: input.readRuns,
    workspace: input.workspace,
  });

  const [quarterArg, audienceArg] = input.execution.args;
  const quarter = quarterArg || currentIsoQuarter();
  const audience = audienceArg || "audit-committee";

  const workflowState = {
    handlerId: input.definition.handlerId,
    type: input.execution.workflowType,
    phase: "awaiting_input",
    quarter,
    audience,
    context,
  };

  await writeWorkflowState(input.runDirectory, workflowState);

  const sourceSummary = context.recentSources.length > 0
    ? context.recentSources
        .map((s) => `${s.source}: ${s.resources} resources, ${s.evaluations} evaluations`)
        .join("\n")
    : "No connector findings cached.";

  const frameworkLine = context.frameworks.length > 0
    ? context.frameworks.join(", ")
    : "No gap-assessment runs detected";

  await input.appendRunEvent(input.runDirectory, {
    type: "message",
    data: {
      role: "assistant",
      text: [
        `Preparing ${audience} brief for ${quarter}.`,
        "",
        "Available context:",
        sourceSummary,
        `Frameworks in scope: ${frameworkLine}`,
        `Gap-assessment runs: ${context.gapRunCount}`,
        "",
        "Provide the narrative context to complete the brief.",
      ].join("\n"),
    },
  });

  await input.appendRunEvent(input.runDirectory, {
    type: "prompt.required",
    data: {
      promptId: "board-brief-context",
      title: "Quarterly narrative required",
      submitLabel: "Generate brief",
      fields: [
        {
          id: "material_events",
          label: "Material events this quarter",
          placeholder: "Incidents, audits, regulatory changes, framework renewals — or 'none'.",
        },
        {
          id: "decisions_requested",
          label: "Decisions / asks for the committee",
          placeholder: "Budget requests, risk acceptances, access blockers — or 'none'.",
        },
        {
          id: "strategic_initiatives",
          label: "Strategic initiatives to highlight",
          placeholder: "Automation programs, org changes, tooling investments — or 'none'.",
        },
      ],
    },
  });
}

async function respondBoardBriefWorkflow(input) {
  const answers = normalizeBoardBriefAnswers(input.response);
  const completedAt = new Date().toISOString();
  const { quarter, audience, context } = input.workflowState;
  const slug = `${quarter}-${audience}`.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const reportPath = path.join(
    input.workspace.rootPath,
    "grc-reports",
    `board-brief-${slug}.md`,
  );

  await fs.mkdir(path.dirname(reportPath), { recursive: true });

  await input.appendRunEvent(input.runDirectory, {
    type: "message",
    data: {
      role: "user",
      text: [
        `Material events: ${answers.material_events}`,
        `Decisions requested: ${answers.decisions_requested}`,
        `Strategic initiatives: ${answers.strategic_initiatives}`,
      ].join("\n"),
    },
  });

  const reportContent = renderBoardBriefReport({ answers, quarter, audience, context });
  await fs.writeFile(reportPath, reportContent, "utf8");

  const artifact = input.createArtifactSummary({
    commandId: input.run.commandId,
    commandPath: input.run.commandPath,
    createdAt: completedAt,
    format: "markdown",
    kind: "report",
    path: reportPath,
    pluginId: input.run.pluginId,
    runId: input.run.id,
    title: `Board Brief — ${quarter}`,
  });

  const nextRun = {
    ...input.run,
    artifacts: [artifact],
    artifactCount: 1,
    completedAt,
    status: "completed",
  };

  await input.appendRunEvent(input.runDirectory, {
    type: "artifact.created",
    data: { artifactId: artifact.id, title: artifact.title, kind: artifact.kind, format: artifact.format, path: artifact.path },
  });
  await input.appendRunEvent(input.runDirectory, {
    type: "message",
    data: { role: "assistant", text: `Wrote the ${audience} brief for ${quarter} to ${reportPath}.` },
  });
  await input.appendRunEvent(input.runDirectory, {
    type: "run.completed",
    data: { artifactCount: 1, exitCode: 0 },
  });

  await writeWorkflowState(input.runDirectory, {
    ...input.workflowState,
    phase: "completed",
    answers,
    reportPath,
  });
  await input.writeRun(input.runDirectory, nextRun);

  return nextRun;
}

function normalizeBoardBriefAnswers(response) {
  const answers = response?.answers && typeof response.answers === "object"
    ? response.answers : response;
  return {
    material_events: normalizeAnswerValue(answers?.material_events),
    decisions_requested: normalizeAnswerValue(answers?.decisions_requested),
    strategic_initiatives: normalizeAnswerValue(answers?.strategic_initiatives),
  };
}

function renderBoardBriefReport({ answers, quarter, audience, context }) {
  const audienceLabel = {
    "board": "Full Board",
    "audit-committee": "Audit Committee",
    "risk-committee": "Risk Committee",
  }[audience] ?? audience;

  const frameworkRows = context.frameworks.length > 0
    ? context.frameworks.map((fw) => `| ${fw} | — | — | — |`).join("\n")
    : "| (no gap-assessment runs on record) | — | — | — |";

  const topRiskNote = context.recentSources.length > 0
    ? context.recentSources
        .map((s) => `| (open) | stable | — | — | — |`)
        .slice(0, 5)
        .join("\n")
    : "| (no findings data) | — | — | — | — |";

  const headline = buildBoardBriefHeadline({ answers, context });

  return [
    `# ${audienceLabel} Brief — ${quarter}`,
    "",
    "## Headline",
    "",
    headline,
    "",
    "## Program Posture",
    "",
    "| Framework | Coverage | Δ from last quarter | Commentary |",
    "|---|---|---|---|",
    frameworkRows,
    "",
    "## Material Events",
    "",
    ...toBulletLines(answers.material_events),
    "",
    "## Residual Risk",
    "",
    "| Risk | Trend | Treatment | Owner | Expected close |",
    "|---|---|---|---|---|",
    topRiskNote,
    "",
    "## Program Initiatives",
    "",
    ...toBulletLines(answers.strategic_initiatives),
    "",
    "## Asks",
    "",
    ...toBulletLines(answers.decisions_requested),
    "",
    "## Appendix",
    "",
    `- Findings sources: ${context.recentSources.length > 0 ? context.recentSources.map((s) => s.source).join(", ") : "none"}`,
    `- Frameworks in scope: ${context.frameworks.length > 0 ? context.frameworks.join(", ") : "none on record"}`,
    `- Gap-assessment runs: ${context.gapRunCount}`,
  ].join("\n");
}

function buildBoardBriefHeadline({ answers, context }) {
  if (answers.material_events !== "none") {
    return "Material events this quarter require committee attention; details and proposed responses are in the sections below.";
  }
  if (answers.decisions_requested !== "none") {
    return "The program is on track; committee decisions are needed to unblock the next phase of risk treatment.";
  }
  return `The GRC program advanced across ${context.frameworks.length || context.recentSources.length} area${context.frameworks.length !== 1 ? "s" : ""} this quarter with no material incidents to report.`;
}

// ─── Automation Coverage ─────────────────────────────────────────────────────

async function collectAutomationCoverageContext(input) {
  const allRuns = await input.readRuns(input.workspace);
  const gapRuns = allRuns
    .filter((r) => r.commandPath === "/grc-engineer:gap-assessment" && r.status === "completed")
    .slice(0, 6);

  const current = gapRuns[0] ?? null;
  const previous = gapRuns[1] ?? null;

  const frameworks = [
    ...new Set(
      gapRuns.flatMap((r) => parseGapAssessmentFrameworks(r.prompt ?? "", input.parsePrompt)),
    ),
  ];

  const metricRows = await readMetricRows(input.workspace.rootPath, input.period);

  return {
    hasMinimumContext: gapRuns.length >= 1,
    hasDelta: gapRuns.length >= 2,
    frameworks,
    currentRun: current,
    previousRun: previous,
    metricRows,
  };
}

async function readMetricRows(workspaceRootPath, period) {
  const metricsDir = path.join(workspaceRootPath, "grc-data", "metrics");
  try {
    const entries = await fs.readdir(metricsDir, { withFileTypes: true });
    const rows = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      try {
        const contents = await fs.readFile(path.join(metricsDir, entry.name), "utf8");
        const parsed = JSON.parse(contents);
        const docRows = Array.isArray(parsed) ? parsed : [parsed];
        rows.push(...docRows);
      } catch { /* skip malformed */ }
    }
    if (period) {
      return rows.filter((r) => r.window_label === period || r.recorded_at?.startsWith(period));
    }
    return rows;
  } catch {
    return [];
  }
}

async function startAutomationCoverageWorkflow(input) {
  const [periodArg, frameworksArg] = input.execution.args;
  const period = periodArg || currentIsoWeek();

  const context = await collectAutomationCoverageContext({
    findLatestJsonFile: input.findLatestJsonFile,
    parsePrompt: input.parsePrompt,
    readRuns: input.readRuns,
    workspace: input.workspace,
    period,
  });

  const workflowState = {
    handlerId: input.definition.handlerId,
    type: input.execution.workflowType,
    phase: "awaiting_input",
    period,
    frameworksFilter: frameworksArg ?? null,
    context,
  };

  await writeWorkflowState(input.runDirectory, workflowState);

  const deltaNote = context.hasDelta
    ? `Current run: ${context.currentRun.id} (${context.currentRun.createdAt.slice(0, 10)})\nPrevious run: ${context.previousRun.id} (${context.previousRun.createdAt.slice(0, 10)})`
    : context.hasMinimumContext
      ? `Only one gap-assessment run found (${context.currentRun.id}). Week-over-week delta will not be available.`
      : "No gap-assessment runs found. Coverage delta cannot be computed.";

  await input.appendRunEvent(input.runDirectory, {
    type: "message",
    data: {
      role: "assistant",
      text: [
        `Preparing automation coverage report for ${period}.`,
        "",
        deltaNote,
        `Frameworks in scope: ${context.frameworks.length > 0 ? context.frameworks.join(", ") : "none detected"}`,
        `Metric rows loaded: ${context.metricRows.length}`,
        "",
        "Provide narrative context to complete the coverage report.",
      ].join("\n"),
    },
  });

  await input.appendRunEvent(input.runDirectory, {
    type: "prompt.required",
    data: {
      promptId: "automation-coverage-context",
      title: "Coverage narrative required",
      submitLabel: "Generate report",
      fields: [
        {
          id: "engineering_initiatives",
          label: "GRC engineering work landing this period",
          placeholder: "Automations shipped, controls newly automated, pipeline changes — or 'none'.",
        },
        {
          id: "scope_changes",
          label: "Scope changes affecting the denominator",
          placeholder: "New framework added, controls de-scoped, or 'none'.",
        },
        {
          id: "audience",
          label: "Audience for this report",
          placeholder: "CISO 1:1, engineering team, leadership update — defaults to CISO 1:1.",
        },
      ],
    },
  });
}

async function respondAutomationCoverageWorkflow(input) {
  const answers = normalizeAutomationCoverageAnswers(input.response);
  const completedAt = new Date().toISOString();
  const { period, context } = input.workflowState;
  const reportPath = path.join(
    input.workspace.rootPath,
    "grc-reports",
    `automation-coverage-${period}.md`,
  );

  await fs.mkdir(path.dirname(reportPath), { recursive: true });

  await input.appendRunEvent(input.runDirectory, {
    type: "message",
    data: {
      role: "user",
      text: [
        `Engineering initiatives: ${answers.engineering_initiatives}`,
        `Scope changes: ${answers.scope_changes}`,
        `Audience: ${answers.audience}`,
      ].join("\n"),
    },
  });

  const reportContent = renderAutomationCoverageReport({ answers, period, context });
  await fs.writeFile(reportPath, reportContent, "utf8");

  const artifact = input.createArtifactSummary({
    commandId: input.run.commandId,
    commandPath: input.run.commandPath,
    createdAt: completedAt,
    format: "markdown",
    kind: "report",
    path: reportPath,
    pluginId: input.run.pluginId,
    runId: input.run.id,
    title: `Automation Coverage — ${period}`,
  });

  const nextRun = {
    ...input.run,
    artifacts: [artifact],
    artifactCount: 1,
    completedAt,
    status: "completed",
  };

  await input.appendRunEvent(input.runDirectory, {
    type: "artifact.created",
    data: { artifactId: artifact.id, title: artifact.title, kind: artifact.kind, format: artifact.format, path: artifact.path },
  });
  await input.appendRunEvent(input.runDirectory, {
    type: "message",
    data: { role: "assistant", text: `Wrote automation coverage report for ${period} to ${reportPath}.` },
  });
  await input.appendRunEvent(input.runDirectory, {
    type: "run.completed",
    data: { artifactCount: 1, exitCode: 0 },
  });

  await writeWorkflowState(input.runDirectory, {
    ...input.workflowState,
    phase: "completed",
    answers,
    reportPath,
  });
  await input.writeRun(input.runDirectory, nextRun);

  return nextRun;
}

function normalizeAutomationCoverageAnswers(response) {
  const answers = response?.answers && typeof response.answers === "object"
    ? response.answers : response;
  return {
    engineering_initiatives: normalizeAnswerValue(answers?.engineering_initiatives),
    scope_changes: normalizeAnswerValue(answers?.scope_changes),
    audience: normalizeAnswerValue(answers?.audience) || "CISO 1:1",
  };
}

function renderAutomationCoverageReport({ answers, period, context }) {
  const coverageRows = context.frameworks.length > 0
    ? context.frameworks.map((fw) => `| ${fw} | — | — | — | — |`).join("\n")
    : "| (no framework data) | — | — | — | — |";

  const deltaAvailable = context.hasDelta;
  const currentRunRef = context.currentRun
    ? `${context.currentRun.id} (${context.currentRun.createdAt.slice(0, 10)})`
    : "none";
  const previousRunRef = context.previousRun
    ? `${context.previousRun.id} (${context.previousRun.createdAt.slice(0, 10)})`
    : "none";

  const headline = deltaAvailable
    ? `Coverage data available for ${period}; week-over-week delta requires operator-supplied metric rows.`
    : context.hasMinimumContext
      ? `First gap-assessment run on record (${context.currentRun?.id ?? "unknown"}); baseline established, delta available next period.`
      : "No gap-assessment runs found this period. Run `/grc-engineer:gap-assessment` first, then re-run this command.";

  return [
    `# Automation Coverage — ${period}`,
    "",
    "## Headline",
    "",
    headline,
    "",
    "## Coverage Snapshot",
    "",
    "| Framework | Total controls | Automated this period | Previous period | Delta |",
    "|---|---|---|---|---|",
    coverageRows,
    "",
    "## What Moved This Period",
    "",
    "### Gains",
    "",
    ...toBulletLines(answers.engineering_initiatives),
    "",
    "### Scope Changes",
    "",
    ...toBulletLines(answers.scope_changes),
    "",
    "## ROI Framing",
    "",
    `Audience: ${answers.audience}. Each control shifted from manual to automated evidence removes recurring human effort from the evidence collection cycle. Precise hour savings require operator-supplied baseline data.`,
    "",
    "## Appendix",
    "",
    `Current-period run: ${currentRunRef}`,
    `Previous-period run: ${previousRunRef}`,
    `Metric rows loaded: ${context.metricRows.length}`,
  ].join("\n");
}

// ─── Program Health ───────────────────────────────────────────────────────────

async function collectProgramHealthContext(input) {
  const allRuns = await input.readRuns(input.workspace);
  const gapRuns = allRuns.filter(
    (r) => r.commandPath === "/grc-engineer:gap-assessment" && r.status === "completed",
  );

  const frameworkRunMap = new Map();
  for (const run of gapRuns) {
    const fws = parseGapAssessmentFrameworks(run.prompt ?? "", input.parsePrompt);
    for (const fw of fws) {
      if (!frameworkRunMap.has(fw)) {
        frameworkRunMap.set(fw, run);
      }
    }
  }

  const findingsBySource = await Promise.all(
    Object.entries(input.workspace.folders.findingsRawConnectors).map(
      async ([source, sourcePath]) => {
        const latestFile = await input.findLatestJsonFile(sourcePath);
        if (!latestFile) return null;
        const stats = await fs.stat(latestFile);
        return { source, updatedAt: stats.mtime.toISOString() };
      },
    ),
  );

  return {
    hasMinimumContext: frameworkRunMap.size >= 1,
    frameworkRunMap,
    frameworks: [...frameworkRunMap.keys()],
    recentSources: findingsBySource.filter(Boolean),
    totalGapRuns: gapRuns.length,
  };
}

async function startProgramHealthWorkflow(input) {
  const [asOfArg, frameworksArg] = input.execution.args;
  const asOf = asOfArg || currentIsoDate();

  const context = await collectProgramHealthContext({
    findLatestJsonFile: input.findLatestJsonFile,
    parsePrompt: input.parsePrompt,
    readRuns: input.readRuns,
    workspace: input.workspace,
  });

  if (!context.hasMinimumContext) {
    await input.appendRunEvent(input.runDirectory, {
      type: "message",
      data: {
        role: "assistant",
        text: [
          "Program health needs at least one completed `/grc-engineer:gap-assessment` run.",
          "Run a gap assessment first, then re-run `/grc-reporter:program-health`.",
        ].join("\n\n"),
      },
    });
    await input.appendRunEvent(input.runDirectory, {
      type: "run.failed",
      data: { message: "No gap-assessment runs found. Run gap assessment first." },
    });
    await input.writeRun(input.runDirectory, {
      ...input.run,
      completedAt: new Date().toISOString(),
      status: "failed",
    });
    return;
  }

  const workflowState = {
    handlerId: input.definition.handlerId,
    type: input.execution.workflowType,
    phase: "awaiting_input",
    asOf,
    frameworksFilter: frameworksArg ?? null,
    context,
  };

  await writeWorkflowState(input.runDirectory, workflowState);

  const frameworkSummary = context.frameworks.join(", ");
  const sourcesSummary = context.recentSources.length > 0
    ? context.recentSources.map((s) => `${s.source} (${s.updatedAt.slice(0, 10)})`).join(", ")
    : "none";

  await input.appendRunEvent(input.runDirectory, {
    type: "message",
    data: {
      role: "assistant",
      text: [
        `Preparing program health snapshot as of ${asOf}.`,
        "",
        `Frameworks with gap-assessment runs: ${frameworkSummary}`,
        `Connector findings: ${sourcesSummary}`,
        `Total gap-assessment runs: ${context.totalGapRuns}`,
        "",
        "Provide narrative context to complete the snapshot.",
      ].join("\n"),
    },
  });

  await input.appendRunEvent(input.runDirectory, {
    type: "prompt.required",
    data: {
      promptId: "program-health-context",
      title: "Program narrative required",
      submitLabel: "Generate snapshot",
      fields: [
        {
          id: "priority_order",
          label: "Framework priority order",
          placeholder: "e.g. SOC2 > FedRAMP-Moderate > ISO-27001, or 'default'.",
        },
        {
          id: "excluded_frameworks",
          label: "Frameworks to exclude from this view",
          placeholder: "Comma-separated, or 'none'.",
        },
        {
          id: "known_initiatives",
          label: "Known initiatives not yet in findings",
          placeholder: "Work landing soon that the data doesn't reflect yet — or 'none'.",
        },
      ],
    },
  });
}

async function respondProgramHealthWorkflow(input) {
  const answers = normalizeProgramHealthAnswers(input.response);
  const completedAt = new Date().toISOString();
  const { asOf, context } = input.workflowState;
  const reportPath = path.join(
    input.workspace.rootPath,
    "grc-reports",
    `program-health-${asOf}.md`,
  );

  await fs.mkdir(path.dirname(reportPath), { recursive: true });

  await input.appendRunEvent(input.runDirectory, {
    type: "message",
    data: {
      role: "user",
      text: [
        `Priority order: ${answers.priority_order}`,
        `Excluded frameworks: ${answers.excluded_frameworks}`,
        `Known initiatives: ${answers.known_initiatives}`,
      ].join("\n"),
    },
  });

  const excludedSet = new Set(
    answers.excluded_frameworks === "none"
      ? []
      : answers.excluded_frameworks.split(",").map((s) => s.trim()).filter(Boolean),
  );

  const reportContent = renderProgramHealthReport({ answers, asOf, context, excludedSet });
  await fs.writeFile(reportPath, reportContent, "utf8");

  const artifact = input.createArtifactSummary({
    commandId: input.run.commandId,
    commandPath: input.run.commandPath,
    createdAt: completedAt,
    format: "markdown",
    kind: "report",
    path: reportPath,
    pluginId: input.run.pluginId,
    runId: input.run.id,
    title: `Program Health — ${asOf}`,
  });

  const nextRun = {
    ...input.run,
    artifacts: [artifact],
    artifactCount: 1,
    completedAt,
    status: "completed",
  };

  await input.appendRunEvent(input.runDirectory, {
    type: "artifact.created",
    data: { artifactId: artifact.id, title: artifact.title, kind: artifact.kind, format: artifact.format, path: artifact.path },
  });
  await input.appendRunEvent(input.runDirectory, {
    type: "message",
    data: { role: "assistant", text: `Wrote program health snapshot to ${reportPath}.` },
  });
  await input.appendRunEvent(input.runDirectory, {
    type: "run.completed",
    data: { artifactCount: 1, exitCode: 0 },
  });

  await writeWorkflowState(input.runDirectory, {
    ...input.workflowState,
    phase: "completed",
    answers,
    reportPath,
  });
  await input.writeRun(input.runDirectory, nextRun);

  return nextRun;
}

function normalizeProgramHealthAnswers(response) {
  const answers = response?.answers && typeof response.answers === "object"
    ? response.answers : response;
  return {
    priority_order: normalizeAnswerValue(answers?.priority_order) || "default",
    excluded_frameworks: normalizeAnswerValue(answers?.excluded_frameworks),
    known_initiatives: normalizeAnswerValue(answers?.known_initiatives),
  };
}

function renderProgramHealthReport({ answers, asOf, context, excludedSet }) {
  const visibleFrameworks = context.frameworks.filter((fw) => !excludedSet.has(fw));

  const portfolioRows = visibleFrameworks.length > 0
    ? visibleFrameworks.map((fw) => {
        const run = context.frameworkRunMap.get(fw);
        const runDate = run?.createdAt?.slice(0, 10) ?? "—";
        return `| ${fw} | — | — | — | — |`;
      }).join("\n")
    : "| (no frameworks with assessment data) | — | — | — | — |";

  const sourcesLine = context.recentSources.length > 0
    ? context.recentSources.map((s) => `${s.source} (${s.updatedAt.slice(0, 10)})`).join(", ")
    : "none";

  const crossFrameworkNote = visibleFrameworks.length > 1
    ? `${visibleFrameworks.length} frameworks in scope. Controls appearing in multiple frameworks are leverage points — a single remediation can close gaps across the whole portfolio.`
    : "Single-framework view. Add a second framework assessment to unlock cross-framework pattern detection.";

  return [
    `# Program Health — ${asOf}`,
    "",
    "## Portfolio Snapshot",
    "",
    "| Framework | Coverage | 30-day trend | Top gap | Owner |",
    "|---|---|---|---|---|",
    portfolioRows,
    "",
    "## Cross-Framework Patterns",
    "",
    crossFrameworkNote,
    "",
    "## Program Momentum",
    "",
    ...toBulletLines(answers.known_initiatives),
    "",
    "## Watch List",
    "",
    `- Review frameworks approaching assessment expiry or with stale findings (>30 days).`,
    ...(answers.excluded_frameworks !== "none"
      ? [`- Excluded from this view: ${answers.excluded_frameworks}`]
      : []),
    "",
    "## Appendix",
    "",
    `Per-framework gap-assessment runs: ${context.totalGapRuns}`,
    `Connector findings: ${sourcesLine}`,
    `Priority order: ${answers.priority_order}`,
  ].join("\n");
}

// ─── Pipeline helpers ─────────────────────────────────────────────────────────

async function runPipelineStep(input, { stepIndex, commandPath, args, label }) {
  await input.appendRunEvent(input.runDirectory, {
    type: "message",
    data: { role: "assistant", text: `Step ${stepIndex + 1}: ${label}` },
  });

  const result = await input.executeStep({
    commandPath,
    args,
    stepIndex,
    runId: input.run.id,
    runDirectory: input.runDirectory,
    workspace: input.workspace,
    toolkitPath: input.toolkitPath,
  });

  return result;
}

async function failPipeline(input, { message, completedAt }) {
  await input.appendRunEvent(input.runDirectory, {
    type: "run.failed",
    data: { message },
  });
  await input.writeRun(input.runDirectory, {
    ...input.run,
    completedAt,
    status: "failed",
  });
}

async function completePipeline(input, { artifacts, completedAt }) {
  const artifactCount = artifacts.length;
  for (const artifact of artifacts) {
    await input.appendRunEvent(input.runDirectory, {
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
  await input.appendRunEvent(input.runDirectory, {
    type: "run.completed",
    data: { artifactCount, exitCode: 0 },
  });
  await input.writeRun(input.runDirectory, {
    ...input.run,
    artifacts,
    artifactCount,
    completedAt,
    status: "completed",
  });
}

// ─── Pipeline: evidence-to-gap ───────────────────────────────────────────────

async function startEvidenceToGapPipeline(input) {
  await input.appendRunEvent(input.runDirectory, {
    type: "run.started",
    data: { commandPreview: input.run.commandPreview },
  });
  await input.appendRunEvent(input.runDirectory, {
    type: "prompt.required",
    data: {
      promptId: "evidence-to-gap-inputs",
      title: "Pipeline inputs",
      submitLabel: "Run pipeline",
      fields: [
        {
          id: "connector",
          label: "Connector",
          placeholder: "github-inspector",
          options: [
            { label: "GitHub Inspector", value: "github-inspector" },
            { label: "AWS Inspector", value: "aws-inspector" },
            { label: "GCP Inspector", value: "gcp-inspector" },
            { label: "Okta Inspector", value: "okta-inspector" },
          ],
        },
        {
          id: "framework",
          label: "Framework",
          placeholder: "SOC2",
        },
      ],
    },
  });
  await writeWorkflowState(input.runDirectory, {
    handlerId: input.definition.handlerId,
    type: input.execution.workflowType,
    phase: "awaiting_input",
  });
}

async function respondEvidenceToGapPipeline(input) {
  const answers = input.response?.answers ?? input.response ?? {};
  const connector = String(answers.connector ?? "github-inspector").trim();
  const framework = String(answers.framework ?? "SOC2").trim();
  const completedAt = new Date().toISOString();

  await input.appendRunEvent(input.runDirectory, {
    type: "message",
    data: {
      role: "user",
      text: `Connector: ${connector}\nFramework: ${framework}`,
    },
  });

  // Step 1: collect
  const collectResult = await runPipelineStep(input, {
    stepIndex: 0,
    commandPath: `/${connector}:collect`,
    args: [],
    label: `Collect findings (${connector})`,
  });

  if (collectResult.status !== "completed") {
    return failPipeline(input, {
      message: `${connector}:collect failed (exit ${collectResult.exitCode}).`,
      completedAt,
    });
  }

  // Step 2: gap-assessment
  const gapResult = await runPipelineStep(input, {
    stepIndex: 1,
    commandPath: "/grc-engineer:gap-assessment",
    args: [framework, `--sources=${connector}`],
    label: `Gap assessment (${framework})`,
  });

  if (gapResult.status !== "completed") {
    return failPipeline(input, {
      message: `gap-assessment failed (exit ${gapResult.exitCode}).`,
      completedAt,
    });
  }

  await writeWorkflowState(input.runDirectory, {
    ...input.workflowState,
    phase: "completed",
  });

  return completePipeline(input, {
    artifacts: [...collectResult.artifacts, ...gapResult.artifacts],
    completedAt,
  });
}

// ─── Pipeline: iac-compliance ─────────────────────────────────────────────────

async function startIacCompliancePipeline(input) {
  await input.appendRunEvent(input.runDirectory, {
    type: "run.started",
    data: { commandPreview: input.run.commandPreview },
  });
  await input.appendRunEvent(input.runDirectory, {
    type: "prompt.required",
    data: {
      promptId: "iac-compliance-inputs",
      title: "Pipeline inputs",
      submitLabel: "Run pipeline",
      fields: [
        {
          id: "directory",
          label: "IaC directory",
          placeholder: "./terraform",
        },
        {
          id: "frameworks",
          label: "Frameworks (comma-separated)",
          placeholder: "SOC2,NIST-800-53",
        },
      ],
    },
  });
  await writeWorkflowState(input.runDirectory, {
    handlerId: input.definition.handlerId,
    type: input.execution.workflowType,
    phase: "awaiting_input",
  });
}

async function respondIacCompliancePipeline(input) {
  const answers = input.response?.answers ?? input.response ?? {};
  const directory = String(answers.directory ?? "./terraform").trim();
  const frameworks = String(answers.frameworks ?? "SOC2").trim();
  const completedAt = new Date().toISOString();

  await input.appendRunEvent(input.runDirectory, {
    type: "message",
    data: {
      role: "user",
      text: `Directory: ${directory}\nFrameworks: ${frameworks}`,
    },
  });

  // Step 1: scan-iac
  const scanResult = await runPipelineStep(input, {
    stepIndex: 0,
    commandPath: "/grc-engineer:scan-iac",
    args: [directory, frameworks],
    label: `Scan IaC (${directory})`,
  });

  if (scanResult.status !== "completed") {
    return failPipeline(input, {
      message: `scan-iac failed (exit ${scanResult.exitCode}).`,
      completedAt,
    });
  }

  // Step 2: optimize-multi-framework
  const optimizeResult = await runPipelineStep(input, {
    stepIndex: 1,
    commandPath: "/grc-engineer:optimize-multi-framework",
    args: [frameworks],
    label: `Optimise frameworks (${frameworks})`,
  });

  if (optimizeResult.status !== "completed") {
    return failPipeline(input, {
      message: `optimize-multi-framework failed (exit ${optimizeResult.exitCode}).`,
      completedAt,
    });
  }

  await writeWorkflowState(input.runDirectory, {
    ...input.workflowState,
    phase: "completed",
  });

  return completePipeline(input, {
    artifacts: [...scanResult.artifacts, ...optimizeResult.artifacts],
    completedAt,
  });
}

// ─── Pipeline: multi-cloud-collect ───────────────────────────────────────────

async function startMultiCloudCollectPipeline(input) {
  await input.appendRunEvent(input.runDirectory, {
    type: "run.started",
    data: { commandPreview: input.run.commandPreview },
  });
  await input.appendRunEvent(input.runDirectory, {
    type: "prompt.required",
    data: {
      promptId: "multi-cloud-collect-inputs",
      title: "Pipeline inputs",
      submitLabel: "Run pipeline",
      fields: [
        {
          id: "framework",
          label: "Framework",
          placeholder: "SOC2",
        },
        {
          id: "connectors",
          label: "Connectors to run (comma-separated)",
          placeholder: "aws-inspector,gcp-inspector,github-inspector,okta-inspector",
        },
      ],
    },
  });
  await writeWorkflowState(input.runDirectory, {
    handlerId: input.definition.handlerId,
    type: input.execution.workflowType,
    phase: "awaiting_input",
  });
}

async function respondMultiCloudCollectPipeline(input) {
  const answers = input.response?.answers ?? input.response ?? {};
  const framework = String(answers.framework ?? "SOC2").trim();
  const connectorInput = String(
    answers.connectors ?? "aws-inspector,gcp-inspector,github-inspector,okta-inspector",
  ).trim();
  const connectors = connectorInput
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  const completedAt = new Date().toISOString();

  await input.appendRunEvent(input.runDirectory, {
    type: "message",
    data: {
      role: "user",
      text: `Connectors: ${connectors.join(", ")}\nFramework: ${framework}`,
    },
  });

  const allArtifacts = [];

  // Steps 1–N: collect from each connector sequentially
  for (let i = 0; i < connectors.length; i++) {
    const connector = connectors[i];
    const result = await runPipelineStep(input, {
      stepIndex: i,
      commandPath: `/${connector}:collect`,
      args: [],
      label: `Collect findings (${connector})`,
    });

    if (result.status !== "completed") {
      await input.appendRunEvent(input.runDirectory, {
        type: "message",
        data: {
          role: "assistant",
          text: `Warning: ${connector}:collect failed (exit ${result.exitCode}), continuing with remaining connectors.`,
        },
      });
    } else {
      allArtifacts.push(...result.artifacts);
    }
  }

  // Final step: gap-assessment across all connectors
  const sources = connectors.join(",");
  const gapResult = await runPipelineStep(input, {
    stepIndex: connectors.length,
    commandPath: "/grc-engineer:gap-assessment",
    args: [framework, `--sources=${sources}`],
    label: `Gap assessment (${framework})`,
  });

  if (gapResult.status !== "completed") {
    return failPipeline(input, {
      message: `gap-assessment failed (exit ${gapResult.exitCode}).`,
      completedAt,
    });
  }

  allArtifacts.push(...gapResult.artifacts);

  await writeWorkflowState(input.runDirectory, {
    ...input.workflowState,
    phase: "completed",
  });

  return completePipeline(input, { artifacts: allArtifacts, completedAt });
}

// ─── Pipeline: fedramp-package ────────────────────────────────────────────────

async function startFedRampPackagePipeline(input) {
  await input.appendRunEvent(input.runDirectory, {
    type: "run.started",
    data: { commandPreview: input.run.commandPreview },
  });
  await input.appendRunEvent(input.runDirectory, {
    type: "prompt.required",
    data: {
      promptId: "fedramp-package-inputs",
      title: "Pipeline inputs",
      submitLabel: "Run pipeline",
      fields: [
        {
          id: "ssp_path",
          label: "SSP file path",
          placeholder: "./fedramp-ssp.xml",
        },
        {
          id: "framework",
          label: "Framework variant",
          placeholder: "fedramp-rev5",
          options: [
            { label: "FedRAMP Rev5", value: "fedramp-rev5" },
            { label: "FedRAMP 20x", value: "fedramp-20x" },
          ],
        },
      ],
    },
  });
  await writeWorkflowState(input.runDirectory, {
    handlerId: input.definition.handlerId,
    type: input.execution.workflowType,
    phase: "awaiting_input",
  });
}

async function respondFedRampPackagePipeline(input) {
  const answers = input.response?.answers ?? input.response ?? {};
  const sspPath = String(answers.ssp_path ?? "").trim();
  const framework = String(answers.framework ?? "fedramp-rev5").trim();
  const completedAt = new Date().toISOString();

  await input.appendRunEvent(input.runDirectory, {
    type: "message",
    data: {
      role: "user",
      text: `SSP path: ${sspPath || "(default)"}\nFramework: ${framework}`,
    },
  });

  // Step 1: convert SSP
  const convertArgs = sspPath ? [sspPath] : [];
  const convertResult = await runPipelineStep(input, {
    stepIndex: 0,
    commandPath: "/fedramp-ssp:convert",
    args: convertArgs,
    label: "Convert SSP",
  });

  if (convertResult.status !== "completed") {
    return failPipeline(input, {
      message: `fedramp-ssp:convert failed (exit ${convertResult.exitCode}).`,
      completedAt,
    });
  }

  // Step 2: validate OSCAL
  const validateResult = await runPipelineStep(input, {
    stepIndex: 1,
    commandPath: "/oscal:validate",
    args: [],
    label: "Validate OSCAL output",
  });

  if (validateResult.status !== "completed") {
    return failPipeline(input, {
      message: `oscal:validate failed (exit ${validateResult.exitCode}). Fix schema violations before gap assessment.`,
      completedAt,
    });
  }

  // Step 3: gap assessment
  const gapResult = await runPipelineStep(input, {
    stepIndex: 2,
    commandPath: "/grc-engineer:gap-assessment",
    args: [framework],
    label: `Gap assessment (${framework})`,
  });

  if (gapResult.status !== "completed") {
    return failPipeline(input, {
      message: `gap-assessment failed (exit ${gapResult.exitCode}).`,
      completedAt,
    });
  }

  await writeWorkflowState(input.runDirectory, {
    ...input.workflowState,
    phase: "completed",
  });

  return completePipeline(input, {
    artifacts: [
      ...convertResult.artifacts,
      ...validateResult.artifacts,
      ...gapResult.artifacts,
    ],
    completedAt,
  });
}

// ─── Pipeline: new-framework-onboard ─────────────────────────────────────────

async function startNewFrameworkOnboardPipeline(input) {
  await input.appendRunEvent(input.runDirectory, {
    type: "run.started",
    data: { commandPreview: input.run.commandPreview },
  });
  await input.appendRunEvent(input.runDirectory, {
    type: "prompt.required",
    data: {
      promptId: "new-framework-onboard-inputs",
      title: "Pipeline inputs",
      submitLabel: "Run pipeline",
      fields: [
        {
          id: "framework",
          label: "New framework",
          placeholder: "DORA",
        },
        {
          id: "existing_frameworks",
          label: "Existing frameworks for overlap analysis (comma-separated)",
          placeholder: "SOC2,NIST-800-53",
        },
      ],
    },
  });
  await writeWorkflowState(input.runDirectory, {
    handlerId: input.definition.handlerId,
    type: input.execution.workflowType,
    phase: "awaiting_input",
  });
}

async function respondNewFrameworkOnboardPipeline(input) {
  const answers = input.response?.answers ?? input.response ?? {};
  const framework = String(answers.framework ?? "").trim();
  const existingFrameworks = String(answers.existing_frameworks ?? "").trim();
  const completedAt = new Date().toISOString();

  if (!framework) {
    return failPipeline(input, {
      message: "Framework is required.",
      completedAt,
    });
  }

  await input.appendRunEvent(input.runDirectory, {
    type: "message",
    data: {
      role: "user",
      text: [
        `Framework: ${framework}`,
        existingFrameworks ? `Existing frameworks: ${existingFrameworks}` : null,
      ].filter(Boolean).join("\n"),
    },
  });

  // Step 1: scaffold
  const scaffoldResult = await runPipelineStep(input, {
    stepIndex: 0,
    commandPath: "/grc-engineer:scaffold-framework",
    args: [framework],
    label: `Scaffold ${framework}`,
  });

  if (scaffoldResult.status !== "completed") {
    return failPipeline(input, {
      message: `scaffold-framework failed (exit ${scaffoldResult.exitCode}).`,
      completedAt,
    });
  }

  // Step 2: initial gap assessment
  const gapResult = await runPipelineStep(input, {
    stepIndex: 1,
    commandPath: "/grc-engineer:gap-assessment",
    args: [framework],
    label: `Initial gap assessment (${framework})`,
  });

  if (gapResult.status !== "completed") {
    return failPipeline(input, {
      message: `gap-assessment failed (exit ${gapResult.exitCode}).`,
      completedAt,
    });
  }

  // Step 3: overlap analysis (only if existing frameworks provided)
  const optimizeArgs = existingFrameworks
    ? [`${framework},${existingFrameworks}`]
    : [framework];

  const optimizeResult = await runPipelineStep(input, {
    stepIndex: 2,
    commandPath: "/grc-engineer:optimize-multi-framework",
    args: optimizeArgs,
    label: "Cross-framework overlap analysis",
  });

  if (optimizeResult.status !== "completed") {
    return failPipeline(input, {
      message: `optimize-multi-framework failed (exit ${optimizeResult.exitCode}).`,
      completedAt,
    });
  }

  await writeWorkflowState(input.runDirectory, {
    ...input.workflowState,
    phase: "completed",
  });

  return completePipeline(input, {
    artifacts: [
      ...scaffoldResult.artifacts,
      ...gapResult.artifacts,
      ...optimizeResult.artifacts,
    ],
    completedAt,
  });
}

// ─── Pipeline: control-test-and-report ───────────────────────────────────────

async function startControlTestAndReportPipeline(input) {
  await input.appendRunEvent(input.runDirectory, {
    type: "run.started",
    data: { commandPreview: input.run.commandPreview },
  });
  await input.appendRunEvent(input.runDirectory, {
    type: "prompt.required",
    data: {
      promptId: "control-test-and-report-inputs",
      title: "Pipeline inputs",
      submitLabel: "Run pipeline",
      fields: [
        {
          id: "control",
          label: "Control ID",
          placeholder: "access_control_account_management",
        },
        {
          id: "cloud",
          label: "Cloud provider",
          placeholder: "aws",
          options: [
            { label: "AWS", value: "aws" },
            { label: "GCP", value: "gcp" },
            { label: "Azure", value: "azure" },
            { label: "Kubernetes", value: "kubernetes" },
          ],
        },
      ],
    },
  });
  await writeWorkflowState(input.runDirectory, {
    handlerId: input.definition.handlerId,
    type: input.execution.workflowType,
    phase: "awaiting_input",
  });
}

async function respondControlTestAndReportPipeline(input) {
  const answers = input.response?.answers ?? input.response ?? {};
  const control = String(answers.control ?? "").trim();
  const cloud = String(answers.cloud ?? "aws").trim();
  const completedAt = new Date().toISOString();

  if (!control) {
    return failPipeline(input, {
      message: "Control ID is required.",
      completedAt,
    });
  }

  await input.appendRunEvent(input.runDirectory, {
    type: "message",
    data: {
      role: "user",
      text: `Control: ${control}\nCloud: ${cloud}`,
    },
  });

  // Step 1: test control
  const testResult = await runPipelineStep(input, {
    stepIndex: 0,
    commandPath: "/grc-engineer:test-control",
    args: [control, cloud],
    label: `Test control (${control})`,
  });

  if (testResult.status !== "completed") {
    return failPipeline(input, {
      message: `test-control failed (exit ${testResult.exitCode}).`,
      completedAt,
    });
  }

  // Step 2: collect evidence
  const evidenceResult = await runPipelineStep(input, {
    stepIndex: 1,
    commandPath: "/grc-engineer:collect-evidence",
    args: [control, cloud],
    label: `Collect evidence (${control})`,
  });

  if (evidenceResult.status !== "completed") {
    return failPipeline(input, {
      message: `collect-evidence failed (exit ${evidenceResult.exitCode}).`,
      completedAt,
    });
  }

  // Step 3: record automation metrics
  const metricsResult = await runPipelineStep(input, {
    stepIndex: 2,
    commandPath: "/grc-engineer:record-automation-metrics",
    args: [control, cloud],
    label: "Record automation metrics",
  });

  if (metricsResult.status !== "completed") {
    return failPipeline(input, {
      message: `record-automation-metrics failed (exit ${metricsResult.exitCode}).`,
      completedAt,
    });
  }

  await writeWorkflowState(input.runDirectory, {
    ...input.workflowState,
    phase: "completed",
  });

  return completePipeline(input, {
    artifacts: [
      ...testResult.artifacts,
      ...evidenceResult.artifacts,
      ...metricsResult.artifacts,
    ],
    completedAt,
  });
}

// ─── Pipeline: tprm-assessment ────────────────────────────────────────────────

async function startTprmAssessmentPipeline(input) {
  await input.appendRunEvent(input.runDirectory, {
    type: "run.started",
    data: { commandPreview: input.run.commandPreview },
  });
  await input.appendRunEvent(input.runDirectory, {
    type: "prompt.required",
    data: {
      promptId: "tprm-assessment-inputs",
      title: "Pipeline inputs",
      submitLabel: "Run pipeline",
      fields: [
        {
          id: "vendor",
          label: "Vendor name",
          placeholder: "Acme Corp",
        },
        {
          id: "framework",
          label: "Framework (optional)",
          placeholder: "SOC2",
        },
      ],
    },
  });
  await writeWorkflowState(input.runDirectory, {
    handlerId: input.definition.handlerId,
    type: input.execution.workflowType,
    phase: "awaiting_input",
  });
}

async function respondTprmAssessmentPipeline(input) {
  const answers = input.response?.answers ?? input.response ?? {};
  const vendor = String(answers.vendor ?? "").trim();
  const framework = String(answers.framework ?? "").trim();
  const completedAt = new Date().toISOString();

  if (!vendor) {
    return failPipeline(input, { message: "Vendor name is required.", completedAt });
  }

  await input.appendRunEvent(input.runDirectory, {
    type: "message",
    data: {
      role: "user",
      text: [`Vendor: ${vendor}`, framework ? `Framework: ${framework}` : null]
        .filter(Boolean)
        .join("\n"),
    },
  });

  // Step 1: TPRM assess (agent)
  const assessArgs = [vendor, ...(framework ? [framework] : [])];
  const assessResult = await runPipelineStep(input, {
    stepIndex: 0,
    commandPath: "/grc-tprm:assess",
    args: assessArgs,
    label: `TPRM assessment (${vendor})`,
  });

  if (assessResult.status !== "completed") {
    return failPipeline(input, {
      message: `grc-tprm:assess failed for vendor "${vendor}".`,
      completedAt,
    });
  }

  // Step 2: transform risk (script)
  const transformArgs = [vendor, ...(framework ? [framework] : [])];
  const transformResult = await runPipelineStep(input, {
    stepIndex: 1,
    commandPath: "/grc-engineer:transform-risk",
    args: transformArgs,
    label: "Transform risk register",
  });

  if (transformResult.status !== "completed") {
    return failPipeline(input, {
      message: `transform-risk failed (exit ${transformResult.exitCode}).`,
      completedAt,
    });
  }

  // Step 3: generate vendor policy (script)
  const policyArgs = ["vendor-management", ...(framework ? [framework] : [])];
  const policyResult = await runPipelineStep(input, {
    stepIndex: 2,
    commandPath: "/grc-engineer:generate-policy",
    args: policyArgs,
    label: "Generate vendor management policy",
  });

  if (policyResult.status !== "completed") {
    return failPipeline(input, {
      message: `generate-policy failed (exit ${policyResult.exitCode}).`,
      completedAt,
    });
  }

  await writeWorkflowState(input.runDirectory, { ...input.workflowState, phase: "completed" });

  return completePipeline(input, {
    artifacts: [
      ...assessResult.artifacts,
      ...transformResult.artifacts,
      ...policyResult.artifacts,
    ],
    completedAt,
  });
}

// ─── Pipeline: incident-response ──────────────────────────────────────────────

async function startIncidentResponsePipeline(input) {
  await input.appendRunEvent(input.runDirectory, {
    type: "run.started",
    data: { commandPreview: input.run.commandPreview },
  });
  await input.appendRunEvent(input.runDirectory, {
    type: "prompt.required",
    data: {
      promptId: "incident-response-inputs",
      title: "Pipeline inputs",
      submitLabel: "Run pipeline",
      fields: [
        {
          id: "framework",
          label: "Framework",
          placeholder: "DORA",
          options: [
            { label: "DORA", value: "DORA" },
            { label: "NIST 800-53", value: "NIST-800-53" },
          ],
        },
        {
          id: "incident_summary",
          label: "Incident summary",
          placeholder: "Brief description of the incident",
        },
      ],
    },
  });
  await writeWorkflowState(input.runDirectory, {
    handlerId: input.definition.handlerId,
    type: input.execution.workflowType,
    phase: "awaiting_input",
  });
}

async function respondIncidentResponsePipeline(input) {
  const answers = input.response?.answers ?? input.response ?? {};
  const framework = String(answers.framework ?? "DORA").trim();
  const incidentSummary = String(answers.incident_summary ?? "").trim();
  const completedAt = new Date().toISOString();

  await input.appendRunEvent(input.runDirectory, {
    type: "message",
    data: {
      role: "user",
      text: [
        `Framework: ${framework}`,
        incidentSummary ? `Incident: ${incidentSummary}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    },
  });

  // Step 1: incident reporting (agent — framework persona)
  const reportingArgs = [incidentSummary, framework].filter(Boolean);
  const reportingResult = await runPipelineStep(input, {
    stepIndex: 0,
    commandPath: `/${framework.toLowerCase().replace(/[^a-z0-9]/g, "-")}:incident-reporting`,
    args: reportingArgs,
    label: `Incident reporting (${framework})`,
  });

  if (reportingResult.status !== "completed") {
    return failPipeline(input, {
      message: `Incident reporting step failed for framework "${framework}".`,
      completedAt,
    });
  }

  // Step 2: auditor review (agent)
  const reviewResult = await runPipelineStep(input, {
    stepIndex: 1,
    commandPath: "/grc-auditor:review",
    args: [framework],
    label: "Auditor review",
  });

  if (reviewResult.status !== "completed") {
    return failPipeline(input, {
      message: `grc-auditor:review failed.`,
      completedAt,
    });
  }

  // Step 3: post-incident policy document (script)
  const policyResult = await runPipelineStep(input, {
    stepIndex: 2,
    commandPath: "/grc-engineer:generate-policy",
    args: ["incident-response", framework],
    label: "Generate post-incident policy",
  });

  if (policyResult.status !== "completed") {
    return failPipeline(input, {
      message: `generate-policy failed (exit ${policyResult.exitCode}).`,
      completedAt,
    });
  }

  await writeWorkflowState(input.runDirectory, { ...input.workflowState, phase: "completed" });

  return completePipeline(input, {
    artifacts: [
      ...reportingResult.artifacts,
      ...reviewResult.artifacts,
      ...policyResult.artifacts,
    ],
    completedAt,
  });
}

// ─── Pipeline: audit-prep ────────────────────────────────────────────────────

async function startAuditPrepPipeline(input) {
  await input.appendRunEvent(input.runDirectory, {
    type: "run.started",
    data: { commandPreview: input.run.commandPreview },
  });
  await input.appendRunEvent(input.runDirectory, {
    type: "prompt.required",
    data: {
      promptId: "audit-prep-inputs",
      title: "Pipeline inputs",
      submitLabel: "Run pipeline",
      fields: [
        {
          id: "framework",
          label: "Framework",
          placeholder: "SOC2",
        },
        {
          id: "audit_date",
          label: "Audit date (optional)",
          placeholder: "2026-06-01",
        },
      ],
    },
  });
  await writeWorkflowState(input.runDirectory, {
    handlerId: input.definition.handlerId,
    type: input.execution.workflowType,
    phase: "awaiting_input",
  });
}

async function respondAuditPrepPipeline(input) {
  const answers = input.response?.answers ?? input.response ?? {};
  const framework = String(answers.framework ?? "").trim();
  const auditDate = String(answers.audit_date ?? "").trim();
  const completedAt = new Date().toISOString();

  if (!framework) {
    return failPipeline(input, { message: "Framework is required.", completedAt });
  }

  await input.appendRunEvent(input.runDirectory, {
    type: "message",
    data: {
      role: "user",
      text: [
        `Framework: ${framework}`,
        auditDate ? `Audit date: ${auditDate}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    },
  });

  // Step 1: gap assessment
  const gapResult = await runPipelineStep(input, {
    stepIndex: 0,
    commandPath: "/grc-engineer:gap-assessment",
    args: [framework],
    label: `Gap assessment (${framework})`,
  });

  if (gapResult.status !== "completed") {
    return failPipeline(input, {
      message: `gap-assessment failed (exit ${gapResult.exitCode}).`,
      completedAt,
    });
  }

  // Step 2: collect evidence
  const evidenceResult = await runPipelineStep(input, {
    stepIndex: 1,
    commandPath: "/grc-engineer:collect-evidence",
    args: [framework],
    label: "Collect evidence",
  });

  if (evidenceResult.status !== "completed") {
    return failPipeline(input, {
      message: `collect-evidence failed (exit ${evidenceResult.exitCode}).`,
      completedAt,
    });
  }

  // Step 3: generate policy
  const policyResult = await runPipelineStep(input, {
    stepIndex: 2,
    commandPath: "/grc-engineer:generate-policy",
    args: [framework],
    label: `Generate ${framework} policy`,
  });

  if (policyResult.status !== "completed") {
    return failPipeline(input, {
      message: `generate-policy failed (exit ${policyResult.exitCode}).`,
      completedAt,
    });
  }

  await writeWorkflowState(input.runDirectory, { ...input.workflowState, phase: "completed" });

  return completePipeline(input, {
    artifacts: [
      ...gapResult.artifacts,
      ...evidenceResult.artifacts,
      ...policyResult.artifacts,
    ],
    completedAt,
  });
}
