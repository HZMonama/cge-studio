import os from "node:os";
import path from "node:path";

import type { ConnectorId, FrameworkId } from "@cge-ui/types";

export const knownConnectors: Array<{ id: ConnectorId; label: string }> = [
  { id: "github-inspector", label: "GitHub Inspector" },
  { id: "aws-inspector", label: "AWS Inspector" },
  { id: "gcp-inspector", label: "GCP Inspector" },
  { id: "okta-inspector", label: "Okta Inspector" },
];

export const frameworkCatalog: Array<{
  id: FrameworkId;
  label: string;
  family: string;
}> = [
  { id: "SOC2", label: "SOC 2", family: "Trust Services" },
  { id: "FedRAMP-Moderate", label: "FedRAMP Moderate", family: "US Federal" },
  { id: "FedRAMP-High", label: "FedRAMP High", family: "US Federal" },
  { id: "NIST-800-53-r5", label: "NIST 800-53 Rev 5", family: "NIST" },
  { id: "ISO-27001-2022", label: "ISO 27001:2022", family: "ISO" },
  { id: "CIS-v8", label: "CIS Controls v8", family: "CIS" },
];

export function resolveToolkitRoots() {
  return {
    configRoot: path.join(os.homedir(), ".config", "claude-grc"),
    cacheRoot: path.join(os.homedir(), ".cache", "claude-grc"),
    appDataRoot: path.join(os.homedir(), ".local", "share", "cge-ui"),
  };
}

export function buildGapAssessmentCommand(input: {
  toolkitPath: string;
  frameworks: FrameworkId[];
  sources: ConnectorId[];
  outputDir: string;
}) {
  const quotedToolkitPath = JSON.stringify(input.toolkitPath);
  const quotedOutputDir = JSON.stringify(input.outputDir);
  const frameworks = input.frameworks.join(",");
  const sources = input.sources.join(",");

  return [
    "node",
    `${quotedToolkitPath}/plugins/grc-engineer/scripts/gap-assessment.js`,
    frameworks,
    `--sources=${sources}`,
    `--report-dir=${quotedOutputDir}`,
  ].join(" ");
}
