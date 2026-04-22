"use client";

import { XIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { usePluginPanel } from "@/stores/plugin-panel-store";

const CONNECTORS = [
  { id: "aws-inspector", label: "AWS Inspector", icon: "/aws_dark.svg" },
  { id: "gcp-inspector", label: "GCP Inspector", icon: "/google_cloud.svg" },
  {
    id: "github-inspector",
    label: "GitHub Inspector",
    icon: "/github_dark.svg",
  },
  { id: "okta-inspector", label: "Okta Inspector", icon: "/okta_dark.png" },
];

function Section({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b last:border-0">
      <div className="px-4 py-3">
        <p className="text-xs font-medium">{title}</p>
      </div>
      {children && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

export function ConfigPanel() {
  const { configOpen, closeConfig } = usePluginPanel();

  return (
    <div
      className={cn(
        "h-svh shrink-0 overflow-hidden transition-[width] duration-200",
        configOpen ? "w-[var(--app-sidebar-w)]" : "w-0",
      )}
    >
      <div className="flex h-full min-h-0 w-[var(--app-sidebar-w)] min-w-[var(--app-sidebar-w)] basis-[var(--app-sidebar-w)] flex-col border-l bg-sidebar text-sidebar-foreground">
        <div className="flex h-[calc(var(--row-h)*2)] shrink-0 items-start justify-between border-b pl-4 pr-2 pt-3">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">Configuration</span>
            <span className="text-xs text-sidebar-foreground/50">settings</span>
          </div>
          <button
            onClick={closeConfig}
            className="mt-0.5 flex size-6 items-center justify-center text-sidebar-foreground/50 transition-colors hover:text-sidebar-foreground"
          >
            <XIcon className="size-3.5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-color:var(--sidebar-border)_transparent] [scrollbar-width:thin]">
          <Section title="Toolkit Path">
            <input
              placeholder="/path/to/claude-grc-engineering"
              className="w-full border border-sidebar-border bg-transparent px-2 py-1.5 text-xs placeholder:text-sidebar-foreground/30 focus:outline-none focus:border-sidebar-ring"
            />
          </Section>

          <Section title="Connectors">
            <ul className="space-y-2">
              {CONNECTORS.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between border border-sidebar-border px-3 py-2"
                >
                  <span className="flex items-center gap-2 text-xs">
                    <img
                      src={c.icon}
                      alt=""
                      className="size-3.5 object-contain"
                    />
                    {c.label}
                  </span>
                  <span className="text-[10px] text-sidebar-foreground/40">
                    not configured
                  </span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="LLM / BYOK">
            <div className="space-y-2">
              <div>
                <p className="mb-1 text-[10px] text-sidebar-foreground/50 uppercase tracking-wide">
                  Provider
                </p>
                <select className="w-full border border-sidebar-border bg-sidebar px-2 py-1.5 text-xs focus:outline-none focus:border-sidebar-ring">
                  <option>Anthropic API</option>
                  <option>AWS Bedrock</option>
                  <option>Google Vertex AI</option>
                </select>
              </div>
              <div>
                <p className="mb-1 text-[10px] text-sidebar-foreground/50 uppercase tracking-wide">
                  API Key
                </p>
                <input
                  type="password"
                  placeholder="sk-ant-..."
                  className="w-full border border-sidebar-border bg-transparent px-2 py-1.5 text-xs placeholder:text-sidebar-foreground/30 focus:outline-none focus:border-sidebar-ring"
                />
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
