// Phase 3: Updated types for v2 schema format from runner

export type Persona = "engineer" | "auditor" | "internal" | "tprm";

export type PluginCategory =
  | "persona"
  | "framework"
  | "connector"
  | "reporting"
  | "transform"
  | "program"
  | "meeting"
  | "tool";

export type OutputType = "report" | "code" | "document" | "status" | "score";

export type CommandUiHint =
  | "analysis"
  | "assessment"
  | "checklist"
  | "mapping"
  | "plan"
  | "policy"
  | "config"
  | "status"
  | "code"
  | "score"
  | "report"
  | "document";

export type CommandExecutionMode =
  | "script"
  | "workflow"
  | "agent"
  | "unsupported";

export type CommandRunnerSupport = "ready" | "planned";

// Input field types (from CLI schema.yaml)
export type InputFieldType =
  | "text"
  | "textarea"
  | "select"
  | "multiselect"
  | "boolean"
  | "number"
  | "path"
  | "secret";

export interface InputFieldOption {
  value: string;
  label: string;
}

// New: Input field definition from schema.yaml
export interface InputField {
  name: string;
  type: InputFieldType;
  label: string;
  description?: string;
  required?: boolean;
  placeholder?: string;
  default?: string | string[] | number | boolean;
  options?: InputFieldOption[];
  flag?: string;
  position?: "argument";
  help?: string;
  range?: [number, number];
}

// New: Output schema from schema.yaml
export interface OutputSchema {
  type: "document" | "findings" | "json" | "sarif" | "oscal";
  format: "markdown" | "json" | "sarif" | "oscal-ar";
  filename?: string;
  schema?: Record<string, unknown>;
}

// New: Execution configuration from schema.yaml
export interface ExecutionConfig {
  mode: "script" | "workflow" | "agent";
  script?: string;
  skill?: string;
}

// New: UI hints from schema.yaml
export interface UiConfig {
  icon?: string;
  category?: string;
  priority?: "high" | "medium" | "low";
}

// New: Documentation from schema.yaml
export interface DocumentationConfig {
  summary: string;
  readme?: string;
}

// Legacy types (for backward compatibility during migration)
export interface CommandFormOption {
  label: string;
  value: string;
}

export interface CommandFormReadinessCondition {
  field: string;
  hasValue?: boolean;
  equals?: string | number | boolean;
  in?: Array<string | number | boolean>;
}

export interface CommandFormReadinessRule {
  when: CommandFormReadinessCondition;
  requireAll?: string[];
  requireOneOf?: string[];
  forbidAll?: string[];
  forbidOneOf?: string[];
}

export interface CommandFormField {
  name: string;
  label: string;
  type: InputFieldType;
  required?: boolean;
  position?: "argument";
  flag?: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string | string[] | number | boolean | null;
  options?: CommandFormOption[];
  repeatable?: boolean;
}

export interface CommandFormSchema {
  mode: "inline";
  submitLabel?: string;
  minimumConfiguration?: string[];
  readinessRules?: CommandFormReadinessRule[];
  fields: CommandFormField[];
}

// Updated Command interface for v2 format
export interface Command {
  id: string;
  description: string;
  
  // v2 fields from schema.yaml
  documentation?: DocumentationConfig;
  inputs?: InputField[];
  outputs?: OutputSchema;
  execution?: ExecutionConfig;
  ui?: UiConfig;
  
  // Runtime info added by runner
  runtime?: {
    executionMode: CommandExecutionMode;
    intendedExecutionMode?: Exclude<CommandExecutionMode, "unsupported">;
    runnerSupport: CommandRunnerSupport;
  };
  
  // Legacy fields (for backward compatibility)
  executionMode?: CommandExecutionMode;
  intendedExecutionMode?: Exclude<CommandExecutionMode, "unsupported">;
  runnerSupport?: CommandRunnerSupport;
  uiHint?: CommandUiHint;
  output?: OutputType;
  form?: CommandFormSchema | null;
}

// Updated Plugin interface
export interface Plugin {
  id: string;
  label: string;
  type: "hub" | "framework" | "connector" | "tool";
  category?: PluginCategory;
  personas: Persona[];
  commands: Command[];
  isCustom?: boolean;
}

// Helper function to get plugin category
export function getPluginCategory(plugin: Plugin): PluginCategory {
  if (plugin.category) return plugin.category;
  if (plugin.type === "hub") return "persona";
  return plugin.type;
}

// Helper to convert new v2 inputs to legacy form fields (for gradual migration)
export function inputsToFormFields(inputs: InputField[] = []): CommandFormField[] {
  return inputs.map(input => ({
    name: input.name,
    label: input.label,
    type: input.type,
    required: input.required,
    position: input.position,
    flag: input.flag,
    description: input.description,
    placeholder: input.placeholder,
    defaultValue: input.default,
    options: input.options,
  }));
}

// Helper to get form schema from command (works with both v1 and v2)
export function getCommandForm(command: Command): CommandFormSchema | null {
  // If legacy form exists, use it
  if (command.form) {
    return command.form;
  }
  
  // If v2 inputs exist, convert to form
  if (command.inputs && command.inputs.length > 0) {
    return {
      mode: "inline",
      submitLabel: `Run ${command.id}`,
      fields: inputsToFormFields(command.inputs),
    };
  }
  
  return null;
}

// Helper to get runner support status
export function getRunnerSupport(command: Command): CommandRunnerSupport {
  // Check runtime first (v2 format)
  if (command.runtime?.runnerSupport) {
    return command.runtime.runnerSupport;
  }
  // Fall back to legacy field
  return command.runnerSupport || "planned";
}

// Helper to get execution mode
export function getExecutionMode(command: Command): CommandExecutionMode {
  // Check runtime first (v2 format)
  if (command.runtime?.executionMode) {
    return command.runtime.executionMode;
  }
  // Check execution config (v2 format)
  if (command.execution?.mode) {
    return command.execution.mode;
  }
  // Fall back to legacy field
  return command.executionMode || "agent";
}

// Helper to get UI hint
export function getUiHint(command: Command): CommandUiHint | undefined {
  // Check v2 ui category
  if (command.ui?.category) {
    return command.ui.category as CommandUiHint;
  }
  // Fall back to legacy
  return command.uiHint;
}

// Legacy constants (kept for backward compatibility)
export const ALL: Persona[] = ["engineer", "auditor", "internal", "tprm"];

// These will be replaced by data from runner over time
export const FRAMEWORK_OPTIONS: InputFieldOption[] = [
  { label: "SOC 2", value: "SOC2" },
  { label: "FedRAMP Moderate", value: "FedRAMP-Moderate" },
  { label: "FedRAMP High", value: "FedRAMP-High" },
  { label: "NIST 800-53 Rev 5", value: "NIST-800-53-r5" },
  { label: "ISO 27001:2022", value: "ISO-27001-2022" },
  { label: "CIS Controls v8", value: "CIS-v8" },
];

export const CONNECTOR_OPTIONS: InputFieldOption[] = [
  { label: "AWS Inspector", value: "aws-inspector" },
  { label: "GCP Inspector", value: "gcp-inspector" },
  { label: "GitHub Inspector", value: "github-inspector" },
  { label: "Okta Inspector", value: "okta-inspector" },
];

// Fallback plugins for when runner is unavailable
// These will gradually be removed as commands are migrated
export const FALLBACK_PLUGINS: Plugin[] = [];
