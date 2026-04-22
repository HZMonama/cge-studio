export type ConnectorId =
  | "aws-inspector"
  | "gcp-inspector"
  | "github-inspector"
  | "okta-inspector";

export type FrameworkId =
  | "SOC2"
  | "FedRAMP-Moderate"
  | "FedRAMP-High"
  | "NIST-800-53-r5"
  | "ISO-27001-2022"
  | "CIS-v8";

export type RunStatus =
  | "planned"
  | "queued"
  | "running"
  | "completed"
  | "failed";

export type CommandFieldType =
  | "text"
  | "textarea"
  | "select"
  | "multiselect"
  | "boolean"
  | "number"
  | "path"
  | "secret";

export type CommandFieldPosition = "argument" | "option";

export interface CommandFormOption {
  label: string;
  value: string;
}

export interface CommandFormField {
  name: string;
  label: string;
  type: CommandFieldType;
  required?: boolean;
  description?: string;
  placeholder?: string;
  defaultValue?: string | string[] | number | boolean | null;
  options?: CommandFormOption[];
  flag?: string;
  position?: CommandFieldPosition;
  sensitive?: boolean;
}

export interface CommandFormSchema {
  mode: "inline";
  submitLabel?: string;
  fields: CommandFormField[];
}

export interface ConnectorSummary {
  id: ConnectorId;
  label: string;
  configured: boolean;
  findingsCached: number;
  configPath: string;
  cachePath: string;
}

export interface FrameworkSummary {
  id: FrameworkId;
  label: string;
  family: string;
}

export interface HealthSnapshot {
  ok: boolean;
  runnerVersion: string;
  toolkitPath: string | null;
  appDataRoot: string;
  cacheRoot: string;
  configRoot: string;
}

export interface RunSummary {
  id: string;
  status: RunStatus;
  createdAt: string;
  frameworks: FrameworkId[];
  sources: ConnectorId[];
  outputDir: string;
  commandPreview: string | null;
}
