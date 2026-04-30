"use client";

import { FileTextIcon } from "@phosphor-icons/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { type RunnerRunEvent } from "@/lib/runner";
import { coerceString } from "./utils";
import { PromptForm } from "./prompt-form";

function toolInputSummary(data: Record<string, unknown>): string | null {
  const tool = coerceString(data.command);
  const input = (data.toolInput ?? {}) as Record<string, unknown>;
  switch (tool) {
    case "Read":
      return coerceString(input.file_path) || null;
    case "Write":
      return coerceString(input.file_path) || null;
    case "Edit":
    case "MultiEdit":
      return coerceString(input.file_path) || null;
    case "Bash":
      return coerceString(input.description) || coerceString(input.command)?.split("\n")[0] || null;
    case "Glob":
      return coerceString(input.pattern) || null;
    case "Grep":
      return coerceString(input.pattern) || null;
    case "WebFetch":
      return coerceString(input.url) || null;
    case "WebSearch":
      return coerceString(input.query) || null;
    default:
      return null;
  }
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function EventBody({
  event,
  onSubmitPrompt,
  onSelectArtifact,
  answeredPromptIds,
  runStatus,
}: {
  event: RunnerRunEvent;
  onSubmitPrompt: (promptId: string, answers: Record<string, string>) => Promise<void>;
  onSelectArtifact: (artifactId: string) => void;
  answeredPromptIds?: Set<string>;
  runStatus?: string;
}) {
  if (event.type === "run.created") {
    return (
      <div>
        <p className="text-sm leading-6 text-muted-foreground">
          {coerceString(event.data.commandPath)}
        </p>
      </div>
    );
  }

  if (event.type === "run.started") {
    const command = Array.isArray(event.data.args)
      ? [coerceString(event.data.command), ...event.data.args.map((value) => String(value))]
      : [];
    const preview = coerceString(event.data.commandPreview);

    return (
      <div>
        {preview ? (
          <pre className="overflow-x-auto whitespace-pre-wrap wrap-break-word border border-border/60 bg-muted/20 px-3 py-2 text-xs leading-5 text-foreground">
            {preview}
          </pre>
        ) : null}
        {command.length > 0 ? (
          <pre className={preview ? "mt-2 overflow-x-auto whitespace-pre-wrap wrap-break-word border border-border/60 bg-muted/20 px-3 py-2 text-xs leading-5 text-foreground" : "overflow-x-auto whitespace-pre-wrap wrap-break-word border border-border/60 bg-muted/20 px-3 py-2 text-xs leading-5 text-foreground"}>
            {command.join(" ")}
          </pre>
        ) : null}
      </div>
    );
  }

  if (event.type === "tool.started") {
    const summary = toolInputSummary(event.data);
    if (summary) {
      return <p className="truncate text-xs text-muted-foreground">{summary}</p>;
    }
    const command = Array.isArray(event.data.args)
      ? [coerceString(event.data.command), ...event.data.args.map((value) => String(value))]
      : [];
    if (command.length > 0) {
      return (
        <pre className="overflow-x-auto whitespace-pre-wrap wrap-break-word border border-border/60 bg-muted/20 px-3 py-2 text-xs leading-5 text-foreground">
          {command.join(" ")}
        </pre>
      );
    }
    return null;
  }

  if (event.type === "tool.completed") {
    return (
      <div>
        <p className="text-sm text-muted-foreground">
          Exit Code {String(event.data.exitCode ?? "?")}
        </p>
      </div>
    );
  }

  if (event.type === "artifact.created") {
    const artifactId = coerceString(event.data.artifactId);
    return (
      <div>
        <button
          onClick={() => artifactId && onSelectArtifact(artifactId)}
          className="flex w-full items-center gap-3 border border-primary/25 bg-primary/6 px-3 py-2 text-left transition-colors hover:bg-primary/10"
        >
          <FileTextIcon className="size-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-primary">
              {coerceString(event.data.title)}
            </p>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {coerceString(event.data.path)}
            </p>
          </div>
        </button>
      </div>
    );
  }

  if (event.type === "message") {
    const text = coerceString(event.data.text);
    return (
      <div className="text-sm leading-6 text-muted-foreground">
        <MarkdownContent content={text} />
      </div>
    );
  }

  if (event.type === "prompt.required") {
    const promptId = coerceString(event.data.promptId);
    const fields = Array.isArray(event.data.fields)
      ? event.data.fields
      : [];
    const isAnswered = answeredPromptIds?.has(promptId) ?? false;
    const runDone = runStatus === "completed" || runStatus === "failed" || runStatus === "canceled";
    const isDisabled = isAnswered || runDone;

    return (
      <PromptForm
        fields={fields}
        promptId={promptId}
        submitLabel={coerceString(event.data.submitLabel) || "Submit"}
        title={coerceString(event.data.title) || "Additional input required"}
        onSubmit={onSubmitPrompt}
        disabled={isDisabled}
      />
    );
  }

  if (event.type === "run.completed" || event.type === "run.failed" || event.type === "run.canceled") {
    return (
      <div>
        <p className="text-sm leading-6 text-muted-foreground">
          {coerceString(event.data.message) || `Exit code ${String(event.data.exitCode ?? "?")}`}
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm font-medium text-foreground">{event.type}</p>
    </div>
  );
}
