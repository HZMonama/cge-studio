import fs from "node:fs/promises";
import path from "node:path";

const workflowDefinitions = [
  defineWorkflow({
    commandPath: "/grc-reporter:exec-summary",
    handlerId: "grc-reporter.exec-summary",
    workflowType: "exec-summary",
    start: startExecSummaryWorkflow,
    respond: respondExecSummaryWorkflow,
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
      const workflowState = await readWorkflowState(input.run.runDirectory);
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
