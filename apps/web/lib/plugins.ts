export type Persona = "engineer" | "auditor" | "internal" | "tprm";

export type PluginCategory =
  | "persona"
  | "framework"
  | "connector"
  | "reporting"
  | "dashboard"
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

export interface CommandFormOption {
  label: string;
  value: string;
}

export type CommandFormFieldType =
  | "text"
  | "textarea"
  | "select"
  | "multiselect"
  | "boolean"
  | "path"
  | "number"
  | "secret";

export interface CommandFormField {
  name: string;
  label: string;
  type: CommandFormFieldType;
  required?: boolean;
  position?: "argument";
  flag?: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string | string[] | number | boolean | null;
  options?: CommandFormOption[];
  repeatable?: boolean;
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

export interface CommandFormSchema {
  mode: "inline";
  submitLabel?: string;
  minimumConfiguration?: string[];
  readinessRules?: CommandFormReadinessRule[];
  fields: CommandFormField[];
}

export interface Command {
  id: string;
  description: string;
  executionMode?: CommandExecutionMode;
  intendedExecutionMode?: Exclude<CommandExecutionMode, "unsupported">;
  runnerSupport?: CommandRunnerSupport;
  uiHint?: CommandUiHint;
  output?: OutputType;
  form?: CommandFormSchema | null;
}

export interface Plugin {
  id: string;
  label: string;
  type: "hub" | "framework" | "connector" | "tool";
  category?: PluginCategory;
  personas: Persona[];
  commands: Command[];
}

export function getPluginCategory(plugin: Plugin): PluginCategory {
  if (plugin.category) return plugin.category;
  if (plugin.type === "hub") return "persona";
  return plugin.type;
}

const ALL: Persona[] = ["engineer", "auditor", "internal", "tprm"];

const CONNECTOR_OUTPUT_OPTIONS: CommandFormOption[] = [
  { label: "Summary", value: "summary" },
  { label: "JSON", value: "json" },
  { label: "Silent", value: "silent" },
];

const FRAMEWORK_OUTPUT_OPTIONS: CommandFormOption[] = [
  { label: "Markdown", value: "markdown" },
  { label: "JSON", value: "json" },
  { label: "SARIF", value: "sarif" },
];

const EVIDENCE_EXPORT_OPTIONS: CommandFormOption[] = [
  { label: "Markdown", value: "markdown" },
  { label: "JSON", value: "json" },
  { label: "CSV", value: "csv" },
];

const FRAMEWORK_OPTIONS: CommandFormOption[] = [
  { label: "SOC 2", value: "SOC2" },
  { label: "FedRAMP Moderate", value: "FedRAMP-Moderate" },
  { label: "FedRAMP High", value: "FedRAMP-High" },
  { label: "NIST 800-53 Rev 5", value: "NIST-800-53-r5" },
  { label: "ISO 27001:2022", value: "ISO-27001-2022" },
  { label: "CIS Controls v8", value: "CIS-v8" },
];

const CONNECTOR_OPTIONS: CommandFormOption[] = [
  { label: "AWS Inspector", value: "aws-inspector" },
  { label: "GCP Inspector", value: "gcp-inspector" },
  { label: "GitHub Inspector", value: "github-inspector" },
  { label: "Okta Inspector", value: "okta-inspector" },
];

const AWS_REGION_OPTIONS: CommandFormOption[] = [
  { label: "us-east-1", value: "us-east-1" },
  { label: "us-east-2", value: "us-east-2" },
  { label: "us-west-1", value: "us-west-1" },
  { label: "us-west-2", value: "us-west-2" },
  { label: "ca-central-1", value: "ca-central-1" },
  { label: "eu-west-1", value: "eu-west-1" },
  { label: "eu-west-2", value: "eu-west-2" },
  { label: "eu-central-1", value: "eu-central-1" },
  { label: "ap-southeast-1", value: "ap-southeast-1" },
  { label: "ap-southeast-2", value: "ap-southeast-2" },
];

const AWS_SERVICE_OPTIONS: CommandFormOption[] = [
  { label: "IAM", value: "iam" },
  { label: "S3", value: "s3" },
  { label: "CloudTrail", value: "cloudtrail" },
  { label: "EBS", value: "ebs" },
];

const GCP_SERVICE_OPTIONS: CommandFormOption[] = [
  { label: "IAM", value: "iam" },
  { label: "Cloud Storage", value: "storage" },
  { label: "Logging", value: "logging" },
  { label: "KMS", value: "kms" },
  { label: "Compute", value: "compute" },
];

const GITHUB_SCOPE_OPTIONS: CommandFormOption[] = [
  { label: "My repositories", value: "@me" },
  { label: "Organization repositories", value: "org:acme" },
  { label: "Single repository", value: "repo:owner/repo" },
];

const SOC2_SCOPE_OPTIONS: CommandFormOption[] = [
  { label: "Security", value: "security" },
  { label: "Availability", value: "availability" },
  { label: "Confidentiality", value: "confidentiality" },
  { label: "Processing Integrity", value: "processing-integrity" },
  { label: "Privacy", value: "privacy" },
];

const AUDIT_TYPE_OPTIONS: CommandFormOption[] = [
  { label: "Type I", value: "type1" },
  { label: "Type II", value: "type2" },
];

const GAP_ASSESSMENT_FORM: CommandFormSchema = {
  mode: "inline",
  submitLabel: "Run Gap Assessment",
  fields: [
    {
      name: "frameworks",
      label: "Frameworks",
      type: "multiselect",
      required: true,
      position: "argument",
      description: "Choose one or more target frameworks to assess.",
      placeholder: "Select frameworks",
      options: FRAMEWORK_OPTIONS,
      defaultValue: [],
    },
    {
      name: "sources",
      label: "Sources",
      type: "multiselect",
      flag: "--sources",
      description: "Restrict the assessment to specific connectors.",
      placeholder: "Select connectors",
      options: CONNECTOR_OPTIONS,
      defaultValue: [],
    },
    {
      name: "output",
      label: "Output Format",
      type: "select",
      flag: "--output",
      description: "Choose the report format to generate.",
      defaultValue: "markdown",
      options: [
        { label: "Markdown", value: "markdown" },
        { label: "JSON", value: "json" },
        { label: "SARIF", value: "sarif" },
        { label: "OSCAL Assessment Results", value: "oscal-ar" },
      ],
    },
    {
      name: "reportDir",
      label: "Report Directory",
      type: "path",
      flag: "--report-dir",
      description: "Optional output directory for the generated report bundle.",
      placeholder: "./gap-assessment-run",
    },
    {
      name: "refresh",
      label: "Refresh source findings",
      type: "boolean",
      flag: "--refresh",
      description:
        "Force fresh collection from each selected source before assessment.",
      defaultValue: false,
    },
    {
      name: "offline",
      label: "Offline mode",
      type: "boolean",
      flag: "--offline",
      description: "Use cached SCF data only and skip network access.",
      defaultValue: false,
    },
    {
      name: "quiet",
      label: "Quiet output",
      type: "boolean",
      flag: "--quiet",
      description: "Suppress progress output to stderr.",
      defaultValue: false,
    },
  ],
};

const AWS_SETUP_FORM: CommandFormSchema = {
  mode: "inline",
  submitLabel: "Run AWS Setup",
  fields: [
    {
      name: "profile",
      label: "AWS Profile",
      type: "text",
      flag: "--profile",
      description:
        "Optional AWS profile to verify and persist in the connector config.",
      placeholder: "default",
    },
    {
      name: "region",
      label: "Default Region",
      type: "select",
      flag: "--region",
      description: "Default AWS region to store in the connector config.",
      placeholder: "Select AWS region",
      options: AWS_REGION_OPTIONS,
      defaultValue: "",
    },
  ],
};

const AWS_COLLECT_FORM: CommandFormSchema = {
  mode: "inline",
  submitLabel: "Run AWS Collect",
  fields: [
    {
      name: "regions",
      label: "Regions",
      type: "multiselect",
      flag: "--regions",
      description:
        "Regions to scan. Leave empty to use the connector's default region.",
      placeholder: "Select AWS regions",
      options: AWS_REGION_OPTIONS,
      defaultValue: [],
    },
    {
      name: "services",
      label: "Services",
      type: "multiselect",
      flag: "--services",
      description: "Limit collection to a subset of AWS services.",
      placeholder: "Select AWS services",
      options: AWS_SERVICE_OPTIONS,
      defaultValue: [],
    },
    {
      name: "profile",
      label: "AWS Profile",
      type: "text",
      flag: "--profile",
      description:
        "Override the configured AWS profile for this collection run.",
      placeholder: "audit-role",
    },
    {
      name: "output",
      label: "Output Format",
      type: "select",
      flag: "--output",
      description: "Choose how collection results should be emitted.",
      defaultValue: "summary",
      options: CONNECTOR_OUTPUT_OPTIONS,
    },
    {
      name: "refresh",
      label: "Refresh cached findings",
      type: "boolean",
      flag: "--refresh",
      description: "Ignore cached findings and query AWS again.",
      defaultValue: false,
    },
    {
      name: "quiet",
      label: "Quiet output",
      type: "boolean",
      flag: "--quiet",
      description: "Suppress progress output to stderr.",
      defaultValue: false,
    },
  ],
};

const AWS_STATUS_FORM: CommandFormSchema = {
  mode: "inline",
  submitLabel: "Run AWS Status",
  fields: [],
};

const GCP_COLLECT_FORM: CommandFormSchema = {
  mode: "inline",
  submitLabel: "Run GCP Collect",
  fields: [
    {
      name: "project",
      label: "GCP Project",
      type: "text",
      flag: "--project",
      description:
        "Override the configured GCP project for this collection run.",
      placeholder: "prod-01",
    },
    {
      name: "services",
      label: "Services",
      type: "multiselect",
      flag: "--services",
      description: "Limit collection to a subset of GCP services.",
      placeholder: "Select GCP services",
      options: GCP_SERVICE_OPTIONS,
      defaultValue: [],
    },
    {
      name: "output",
      label: "Output Format",
      type: "select",
      flag: "--output",
      description: "Choose how collection results should be emitted.",
      defaultValue: "summary",
      options: CONNECTOR_OUTPUT_OPTIONS,
    },
    {
      name: "refresh",
      label: "Refresh cached findings",
      type: "boolean",
      flag: "--refresh",
      description: "Ignore cached findings and query GCP again.",
      defaultValue: false,
    },
    {
      name: "quiet",
      label: "Quiet output",
      type: "boolean",
      flag: "--quiet",
      description: "Suppress progress output to stderr.",
      defaultValue: false,
    },
  ],
};

const GITHUB_COLLECT_FORM: CommandFormSchema = {
  mode: "inline",
  submitLabel: "Run GitHub Collect",
  fields: [
    {
      name: "scope",
      label: "Repository Scope",
      type: "select",
      flag: "--scope",
      description: "Choose which repositories to scan.",
      defaultValue: "@me",
      options: GITHUB_SCOPE_OPTIONS,
    },
    {
      name: "limit",
      label: "Repository Limit",
      type: "text",
      flag: "--limit",
      description:
        "Cap the number of repositories scanned for testing or smaller runs.",
      placeholder: "25",
    },
    {
      name: "concurrency",
      label: "Concurrency",
      type: "text",
      flag: "--concurrency",
      description: "Parallel API calls to make during collection.",
      placeholder: "4",
      defaultValue: "4",
    },
    {
      name: "output",
      label: "Output Format",
      type: "select",
      flag: "--output",
      description: "Choose how GitHub collection results should be emitted.",
      defaultValue: "summary",
      options: CONNECTOR_OUTPUT_OPTIONS,
    },
    {
      name: "refresh",
      label: "Refresh cached findings",
      type: "boolean",
      flag: "--refresh",
      description: "Ignore cache and always re-query GitHub.",
      defaultValue: false,
    },
    {
      name: "quiet",
      label: "Quiet output",
      type: "boolean",
      flag: "--quiet",
      description: "Suppress progress output to stderr.",
      defaultValue: false,
    },
  ],
};

const SOC2_ASSESS_FORM: CommandFormSchema = {
  mode: "inline",
  submitLabel: "Run SOC 2 Assessment",
  fields: [
    {
      name: "assessmentScope",
      label: "Assessment Scope",
      type: "select",
      position: "argument",
      description:
        "Optional Trust Service Category to assess. Security is always in scope for SOC 2.",
      options: SOC2_SCOPE_OPTIONS,
      defaultValue: "",
    },
    {
      name: "auditType",
      label: "Audit Type",
      type: "select",
      position: "argument",
      description: "Optional SOC 2 audit type to target.",
      options: AUDIT_TYPE_OPTIONS,
      defaultValue: "",
    },
    {
      name: "output",
      label: "Output Format",
      type: "select",
      flag: "--output",
      description:
        "Choose the format for the generated SOC 2 readiness report.",
      defaultValue: "markdown",
      options: [
        { label: "Markdown", value: "markdown" },
        { label: "JSON", value: "json" },
      ],
    },
    {
      name: "reportDir",
      label: "Report Directory",
      type: "path",
      flag: "--report-dir",
      description: "Optional output directory for the SOC 2 assessment bundle.",
      placeholder: "./soc2-assessment",
    },
    {
      name: "quiet",
      label: "Quiet output",
      type: "boolean",
      flag: "--quiet",
      description: "Suppress progress output while the assessment runs.",
      defaultValue: false,
    },
  ],
};

const SOC2_EVIDENCE_CHECKLIST_FORM: CommandFormSchema = {
  mode: "inline",
  submitLabel: "Generate SOC 2 Evidence Checklist",
  fields: [
    {
      name: "controlId",
      label: "Control ID or Category",
      type: "text",
      required: true,
      position: "argument",
      description:
        "SOC 2 control ID or category, such as CC6.1, CC7.2, CC6, or security.",
      placeholder: "CC6.1",
    },
    {
      name: "auditType",
      label: "Audit Type",
      type: "select",
      position: "argument",
      description: "Optional SOC 2 audit type to target.",
      options: AUDIT_TYPE_OPTIONS,
      defaultValue: "type2",
    },
    {
      name: "output",
      label: "Export Format",
      type: "select",
      flag: "--output",
      description:
        "Choose the format for the generated SOC 2 evidence checklist.",
      defaultValue: "markdown",
      options: [
        { label: "Markdown", value: "markdown" },
        { label: "JSON", value: "json" },
      ],
    },
    {
      name: "reportDir",
      label: "Evidence Output Directory",
      type: "path",
      flag: "--report-dir",
      description:
        "Optional directory where the SOC 2 evidence checklist should be written.",
      placeholder: "./soc2-evidence-checklist",
    },
    {
      name: "quiet",
      label: "Quiet output",
      type: "boolean",
      flag: "--quiet",
      description:
        "Suppress progress output while generating the evidence checklist.",
      defaultValue: false,
    },
  ],
};

const CIS_EVIDENCE_CHECKLIST_FORM: CommandFormSchema = {
  mode: "inline",
  submitLabel: "Generate CIS Evidence Checklist",
  fields: [
    {
      name: "safeguardId",
      label: "Safeguard or Domain",
      type: "text",
      required: true,
      position: "argument",
      description:
        "Enter a CIS safeguard id like 5.1, 8.3, or a domain name like Asset Management or Access Control.",
      placeholder: "5.1",
    },
    {
      name: "igLevel",
      label: "Implementation Group",
      type: "select",
      flag: "--ig-level",
      description:
        "Filter the checklist to a specific CIS Implementation Group.",
      options: [
        { label: "All applicable", value: "" },
        { label: "IG1", value: "1" },
        { label: "IG2", value: "2" },
        { label: "IG3", value: "3" },
      ],
      defaultValue: "",
    },
    {
      name: "export",
      label: "Export Format",
      type: "select",
      flag: "--export",
      description: "Choose the output format for the evidence checklist.",
      options: EVIDENCE_EXPORT_OPTIONS,
      defaultValue: "markdown",
    },
    {
      name: "reportDir",
      label: "Output Directory",
      type: "path",
      flag: "--report-dir",
      description:
        "Optional directory where the generated CIS evidence checklist should be written.",
      placeholder: "./cis-evidence-checklist",
    },
    {
      name: "quiet",
      label: "Quiet output",
      type: "boolean",
      flag: "--quiet",
      description:
        "Suppress progress output while generating the evidence checklist.",
      defaultValue: false,
    },
  ],
};

const CSA_CCM_MAP_FRAMEWORK_FORM: CommandFormSchema = {
  mode: "inline",
  submitLabel: "Run CCM Framework Mapping",
  fields: [
    {
      name: "controlId",
      label: "CCM Control ID",
      type: "text",
      required: true,
      position: "argument",
      description:
        "Enter a CSA CCM control ID such as CEK-01, IAM-06, or LOG-08.",
      placeholder: "CEK-01",
    },
    {
      name: "targetFramework",
      label: "Target Framework",
      type: "select",
      position: "argument",
      description: "Optional target framework to map the CCM control into.",
      defaultValue: "",
      options: [
        { label: "All supported frameworks", value: "all" },
        { label: "ISO 27001", value: "ISO27001" },
        { label: "SOC 2", value: "SOC2" },
        { label: "PCI DSS", value: "PCIDSS" },
        { label: "NIST", value: "NIST" },
        { label: "HIPAA", value: "HIPAA" },
        { label: "GDPR", value: "GDPR" },
      ],
    },
    {
      name: "output",
      label: "Output Format",
      type: "select",
      flag: "--output",
      description:
        "Choose the format for the generated framework mapping output.",
      defaultValue: "markdown",
      options: [
        { label: "Markdown", value: "markdown" },
        { label: "JSON", value: "json" },
      ],
    },
    {
      name: "reportDir",
      label: "Output Directory",
      type: "path",
      flag: "--report-dir",
      description:
        "Optional directory where the framework mapping output should be written.",
      placeholder: "./ccm-framework-mapping",
    },
    {
      name: "quiet",
      label: "Quiet output",
      type: "boolean",
      flag: "--quiet",
      description:
        "Suppress progress output while generating the framework mapping.",
      defaultValue: false,
    },
  ],
};

const FEDRAMP_BASELINE_SELECT_FORM: CommandFormSchema = {
  mode: "inline",
  submitLabel: "Select FedRAMP Baseline",
  fields: [
    {
      name: "impactLevel",
      label: "Impact Level",
      type: "select",
      required: true,
      position: "argument",
      description: "Required FedRAMP impact level to select and tailor.",
      defaultValue: "moderate",
      options: [
        { label: "Low", value: "low" },
        { label: "Moderate", value: "moderate" },
        { label: "High", value: "high" },
      ],
    },
    {
      name: "systemType",
      label: "System Type",
      type: "select",
      position: "argument",
      description: "Optional deployment model used to tailor the baseline.",
      defaultValue: "",
      options: [
        { label: "Select system type", value: "" },
        { label: "SaaS", value: "saas" },
        { label: "PaaS", value: "paas" },
        { label: "IaaS", value: "iaas" },
      ],
    },
    {
      name: "reportDir",
      label: "Output Directory",
      type: "path",
      flag: "--report-dir",
      description:
        "Optional directory where the tailored FedRAMP baseline output should be written.",
      placeholder: "./fedramp-baseline",
    },
    {
      name: "quiet",
      label: "Quiet output",
      type: "boolean",
      flag: "--quiet",
      description:
        "Suppress progress output while selecting and tailoring the baseline.",
      defaultValue: false,
    },
  ],
};

const NIST_BASELINE_SELECT_FORM: CommandFormSchema = {
  mode: "inline",
  submitLabel: "Select NIST Baseline",
  fields: [
    {
      name: "impactLevel",
      label: "Impact Level",
      type: "select",
      required: true,
      position: "argument",
      description: "Select the NIST 800-53 impact level baseline to tailor.",
      defaultValue: "moderate",
      options: [
        { label: "Low", value: "low" },
        { label: "Moderate", value: "moderate" },
        { label: "High", value: "high" },
      ],
    },
    {
      name: "systemType",
      label: "System Type",
      type: "select",
      position: "argument",
      description: "Optional system type to help tailor the baseline.",
      defaultValue: "",
      options: [
        { label: "General", value: "general" },
        { label: "Cloud", value: "cloud" },
        { label: "Mobile", value: "mobile" },
        { label: "Industrial", value: "industrial" },
      ],
    },
    {
      name: "reportDir",
      label: "Output Directory",
      type: "path",
      flag: "--report-dir",
      description:
        "Optional directory where the selected NIST baseline output should be written.",
      placeholder: "./nist-baseline-select",
    },
    {
      name: "quiet",
      label: "Quiet output",
      type: "boolean",
      flag: "--quiet",
      description:
        "Suppress progress output while selecting and tailoring the baseline.",
      defaultValue: false,
    },
  ],
};

export const PLUGINS: Plugin[] = [
  {
    id: "aws-inspector",
    label: "AWS Inspector",
    type: "connector",
    personas: ["engineer"],
    commands: [
      {
        id: "setup",
        description: "Configure AWS credentials and region",
        output: "status",
        form: AWS_SETUP_FORM,
      },
      {
        id: "collect",
        description: "Collect IAM, S3, CloudTrail, EBS findings",
        output: "report",
        form: AWS_COLLECT_FORM,
      },
      {
        id: "status",
        description: "Show connector health and cache state",
        output: "status",
        form: AWS_STATUS_FORM,
      },
    ],
  },
  {
    id: "cis-controls",
    label: "CIS Controls",
    type: "framework",
    personas: ALL,
    commands: [
      {
        id: "assess",
        description: "CIS Controls v8 readiness assessment",
        output: "report",
      },
      {
        id: "ig-select",
        description: "Select appropriate Implementation Group",
        output: "document",
      },
      {
        id: "safeguard-list",
        description: "List safeguards for a given IG",
        output: "report",
      },
      {
        id: "control-check",
        description: "Check a specific CIS control",
        output: "report",
      },
      {
        id: "evidence-checklist",
        description: "Evidence requirements per IG",
        output: "document",
        form: CIS_EVIDENCE_CHECKLIST_FORM,
      },
    ],
  },
  {
    id: "cmmc",
    label: "CMMC",
    type: "framework",
    personas: ALL,
    commands: [
      {
        id: "assess",
        description: "CMMC 2.0 assessment for level 1–3",
        output: "report",
      },
      {
        id: "level-select",
        description: "Guidance on selecting the right level",
        output: "document",
      },
      {
        id: "practice-check",
        description: "Check a specific CMMC practice",
        output: "report",
      },
      {
        id: "domain-guidance",
        description: "Guidance for a specific CMMC domain",
        output: "document",
      },
      {
        id: "evidence-checklist",
        description: "Evidence requirements per level",
        output: "document",
      },
    ],
  },
  {
    id: "csa-ccm",
    label: "CSA CCM",
    type: "framework",
    personas: ALL,
    commands: [
      {
        id: "assess",
        description: "Cloud Controls Matrix assessment",
        output: "report",
      },
      {
        id: "caiq-generate",
        description: "Generate CAIQ questionnaire responses",
        output: "document",
      },
      {
        id: "domain-guidance",
        description: "Guidance for a specific CCM domain",
        output: "document",
      },
      {
        id: "evidence-checklist",
        description: "CCM evidence requirements",
        output: "document",
      },
      {
        id: "map-framework",
        description: "Map CCM to/from another framework",
        output: "report",
        form: CSA_CCM_MAP_FRAMEWORK_FORM,
      },
    ],
  },
  {
    id: "dora",
    label: "DORA",
    type: "framework",
    personas: ALL,
    commands: [
      {
        id: "assess",
        description: "EU DORA readiness assessment",
        output: "report",
      },
      {
        id: "pillar-guidance",
        description: "Guidance for a specific DORA pillar",
        output: "document",
      },
      {
        id: "incident-reporting",
        description: "Major incident reporting process",
        output: "document",
      },
      {
        id: "testing-plan",
        description: "Digital resilience testing plan",
        output: "document",
      },
      {
        id: "evidence-checklist",
        description: "DORA evidence requirements",
        output: "document",
      },
    ],
  },
  {
    id: "essential8",
    label: "Essential Eight",
    type: "framework",
    personas: ALL,
    commands: [
      {
        id: "assess",
        description: "Australian Essential Eight assessment",
        output: "report",
      },
      {
        id: "maturity-level",
        description: "Maturity level guidance (ML1–ML3)",
        output: "document",
      },
      {
        id: "strategy-check",
        description: "Check a specific mitigation strategy",
        output: "report",
      },
      {
        id: "roadmap",
        description: "Roadmap to a target maturity level",
        output: "document",
      },
      {
        id: "evidence-checklist",
        description: "Essential Eight evidence requirements",
        output: "document",
      },
    ],
  },
  {
    id: "fedramp-20x",
    label: "FedRAMP 20x",
    type: "framework",
    personas: ["engineer", "auditor", "internal"],
    commands: [
      {
        id: "ksi-check",
        description: "Check Key Security Indicators by category",
        output: "report",
      },
      {
        id: "mas-review",
        description: "Minimum Assessment Scope review",
        output: "report",
      },
      {
        id: "vdr-assess",
        description: "Vulnerability Detection and Response assessment",
        output: "report",
      },
      {
        id: "sync-docs",
        description: "Sync latest FedRAMP 20X policy documents",
        output: "status",
      },
    ],
  },
  {
    id: "fedramp-rev5",
    label: "FedRAMP Rev 5",
    type: "framework",
    personas: ["engineer", "auditor", "internal"],
    commands: [
      {
        id: "assess",
        description: "FedRAMP Rev 5 readiness assessment",
        output: "report",
      },
      {
        id: "baseline-select",
        description: "Select Low / Moderate / High baseline",
        output: "document",
        form: FEDRAMP_BASELINE_SELECT_FORM,
      },
      {
        id: "poam-review",
        description: "Review Plan of Action & Milestones",
        output: "report",
      },
      {
        id: "ssp-guidance",
        description: "SSP section authoring guidance",
        output: "document",
      },
    ],
  },
  {
    id: "fedramp-ssp",
    label: "FedRAMP SSP",
    type: "tool",
    personas: ["engineer", "auditor"],
    commands: [
      {
        id: "setup",
        description: "Install SSP conversion tool",
        output: "status",
      },
      {
        id: "convert",
        description: "Convert Word SSP to OSCAL 1.2.0 JSON",
        output: "document",
      },
    ],
  },
  {
    id: "gcp-inspector",
    label: "GCP Inspector",
    type: "connector",
    personas: ["engineer"],
    commands: [
      {
        id: "setup",
        description: "Configure GCP credentials and project",
        output: "status",
      },
      {
        id: "collect",
        description: "Collect IAM, Storage, KMS, Compute findings",
        output: "report",
        form: GCP_COLLECT_FORM,
      },
      {
        id: "status",
        description: "Show connector health and cache state",
        output: "status",
      },
    ],
  },
  {
    id: "gdpr",
    label: "GDPR",
    type: "framework",
    personas: ALL,
    commands: [
      {
        id: "assess",
        description: "GDPR readiness assessment",
        output: "report",
      },
      {
        id: "dpia",
        description: "Data Protection Impact Assessment",
        output: "document",
      },
      {
        id: "breach-process",
        description: "72-hour breach notification guidance",
        output: "document",
      },
      {
        id: "rights-check",
        description: "Data subject rights implementation check",
        output: "report",
      },
      {
        id: "evidence-checklist",
        description: "GDPR compliance evidence requirements",
        output: "document",
      },
    ],
  },
  {
    id: "github-inspector",
    label: "GitHub Inspector",
    type: "connector",
    personas: ["engineer"],
    commands: [
      {
        id: "setup",
        description: "Configure GitHub token and scope",
        output: "status",
      },
      {
        id: "collect",
        description: "Collect branch protection and scanning findings",
        output: "report",
        form: GITHUB_COLLECT_FORM,
      },
      {
        id: "status",
        description: "Show connector health and cache state",
        output: "status",
      },
    ],
  },
  {
    id: "glba",
    label: "GLBA",
    type: "framework",
    personas: ALL,
    commands: [
      {
        id: "assess",
        description: "GLBA Safeguards and Privacy Rules assessment",
        output: "report",
      },
      {
        id: "safeguards",
        description: "Safeguards Rule requirements",
        output: "document",
      },
      {
        id: "privacy",
        description: "Privacy Rule and notice obligations",
        output: "document",
      },
      {
        id: "risk-assessment",
        description: "GLBA-required risk assessment process",
        output: "document",
      },
      {
        id: "evidence-checklist",
        description: "GLBA evidence requirements",
        output: "document",
      },
    ],
  },
  {
    id: "grc-auditor",
    label: "GRC Auditor",
    type: "hub",
    personas: ["auditor"],
    commands: [
      {
        id: "generate-workpaper",
        description: "Generate audit workpaper (finding/test/summary)",
        output: "document",
      },
      {
        id: "review-evidence",
        description: "Review evidence artifacts for completeness",
        output: "report",
      },
      {
        id: "validate-control",
        description: "Validate a control against its framework",
        output: "report",
      },
    ],
  },
  {
    id: "grc-engineer",
    label: "GRC Engineer",
    type: "hub",
    personas: ["engineer"],
    commands: [
      {
        id: "gap-assessment",
        description: "Run a multi-framework gap assessment",
        output: "report",
        form: {
          mode: "inline",
          submitLabel: "Run Gap Assessment",
          fields: [
            {
              name: "frameworks",
              label: "Frameworks",
              type: "multiselect",
              required: true,
              position: "argument",
              description: "Choose one or more target frameworks to assess.",
              placeholder: "Select frameworks",
              options: [
                { label: "SOC 2", value: "SOC2" },
                { label: "FedRAMP Moderate", value: "FedRAMP-Moderate" },
                { label: "FedRAMP High", value: "FedRAMP-High" },
                { label: "NIST 800-53 Rev 5", value: "NIST-800-53-r5" },
                { label: "ISO 27001:2022", value: "ISO-27001-2022" },
                { label: "CIS Controls v8", value: "CIS-v8" },
              ],
            },
            {
              name: "sources",
              label: "Sources",
              type: "multiselect",
              flag: "--sources",
              description: "Restrict the assessment to specific connectors.",
              placeholder: "Select connectors",
              options: [
                { label: "AWS Inspector", value: "aws-inspector" },
                { label: "GCP Inspector", value: "gcp-inspector" },
                { label: "GitHub Inspector", value: "github-inspector" },
                { label: "Okta Inspector", value: "okta-inspector" },
              ],
            },
            {
              name: "output",
              label: "Output Format",
              type: "select",
              flag: "--output",
              description: "Choose the report format to generate.",
              defaultValue: "markdown",
              options: [
                { label: "Markdown", value: "markdown" },
                { label: "JSON", value: "json" },
                { label: "SARIF", value: "sarif" },
                { label: "OSCAL Assessment Results", value: "oscal-ar" },
              ],
            },
            {
              name: "reportDir",
              label: "Report Directory",
              type: "path",
              flag: "--report-dir",
              description:
                "Optional output directory for the generated report bundle.",
              placeholder: "./gap-assessment-run",
            },
            {
              name: "refresh",
              label: "Refresh source findings",
              type: "boolean",
              flag: "--refresh",
              description:
                "Force fresh collection from each selected source before assessment.",
              defaultValue: false,
            },
            {
              name: "offline",
              label: "Offline mode",
              type: "boolean",
              flag: "--offline",
              description: "Use cached SCF data only and skip network access.",
              defaultValue: false,
            },
            {
              name: "quiet",
              label: "Quiet output",
              type: "boolean",
              flag: "--quiet",
              description: "Suppress progress output to stderr.",
              defaultValue: false,
            },
          ],
        },
      },
      {
        id: "scan-iac",
        description: "Scan IaC files for compliance violations",
        output: "report",
      },
      {
        id: "generate-implementation",
        description: "Generate IaC for a specific control",
        output: "code",
      },
      {
        id: "generate-policy",
        description: "Generate OPA/Sentinel/AWS Config policy",
        output: "code",
      },
      {
        id: "test-control",
        description: "Run tests for a specific control",
        output: "report",
      },
      {
        id: "monitor-continuous",
        description: "Set up continuous compliance monitoring",
        output: "status",
      },
      {
        id: "map-controls-unified",
        description: "Cross-framework control mapping",
        output: "report",
      },
      {
        id: "find-conflicts",
        description: "Detect conflicting requirements across frameworks",
        output: "report",
      },
      {
        id: "optimize-multi-framework",
        description: "ROI-optimized multi-framework control plan",
        output: "document",
      },
      {
        id: "collect-evidence",
        description: "Generate evidence collection script",
        output: "code",
      },
      {
        id: "review-pr",
        description: "Compliance review of a GitHub pull request",
        output: "report",
      },
      {
        id: "pipeline-status",
        description: "Show all connector health and cache state",
        output: "status",
      },
      {
        id: "scaffold-framework",
        description: "Scaffold a new framework plugin from SCF",
        output: "code",
      },
      {
        id: "transform-risk",
        description: "Convert risk description to Jira ticket",
        output: "document",
      },
    ],
  },
  {
    id: "grc-internal",
    label: "GRC Internal",
    type: "hub",
    personas: ["internal"],
    commands: [
      {
        id: "manage-risk",
        description: "Add, update, assess, or report on risks",
        output: "document",
      },
      {
        id: "track-compliance",
        description: "Track compliance posture across frameworks",
        output: "report",
      },
      {
        id: "update-policy",
        description: "Review, update, or version a policy file",
        output: "document",
      },
    ],
  },
  {
    id: "grc-tprm",
    label: "GRC TPRM",
    type: "hub",
    personas: ["tprm"],
    commands: [
      {
        id: "analyze-questionnaire",
        description: "Analyze SIG, CAIQ, or VSAQ questionnaire",
        output: "report",
      },
      {
        id: "assess-vendor",
        description: "Full vendor risk assessment",
        output: "report",
      },
      {
        id: "score-risk",
        description: "Score vendor risk with a rating model",
        output: "score",
      },
    ],
  },
  {
    id: "hitrust",
    label: "HITRUST",
    type: "framework",
    personas: ALL,
    commands: [
      { id: "assess", description: "HITRUST CSF assessment", output: "report" },
      {
        id: "scope-select",
        description: "Select assessment type (i1, r2, e1)",
        output: "document",
      },
      {
        id: "gap-analysis",
        description: "Gap analysis against HITRUST CSF",
        output: "report",
      },
      {
        id: "control-map",
        description: "Map controls from another framework",
        output: "report",
      },
      {
        id: "evidence-checklist",
        description: "Evidence requirements by scope",
        output: "document",
      },
    ],
  },
  {
    id: "irap",
    label: "IRAP",
    type: "framework",
    personas: ALL,
    commands: [
      {
        id: "assess",
        description: "Australian IRAP assessment (ISM + Essential Eight)",
        output: "report",
      },
      {
        id: "classification",
        description: "Australian government information classification",
        output: "document",
      },
      {
        id: "essential-8",
        description: "Essential Eight requirements within IRAP",
        output: "document",
      },
      {
        id: "data-residency",
        description: "Australian data sovereignty requirements",
        output: "document",
      },
    ],
  },
  {
    id: "ismap",
    label: "ISMAP",
    type: "framework",
    personas: ALL,
    commands: [
      {
        id: "assess",
        description: "Japanese ISMAP government cloud assessment",
        output: "report",
      },
      {
        id: "registration",
        description: "ISMAP registration process guidance",
        output: "document",
      },
      {
        id: "iso-mapping",
        description: "Map ISMAP controls to ISO 27001",
        output: "report",
      },
      {
        id: "data-residency",
        description: "Japanese data residency requirements",
        output: "document",
      },
    ],
  },
  {
    id: "iso27001",
    label: "ISO 27001",
    type: "framework",
    personas: ALL,
    commands: [
      {
        id: "assess",
        description: "ISO 27001:2022 ISMS readiness assessment",
        output: "report",
      },
      {
        id: "gap-analysis",
        description: "Gap analysis across all 93 Annex A controls",
        output: "report",
      },
      {
        id: "annex-a-deep-dive",
        description: "Deep dive into a specific Annex A domain",
        output: "document",
      },
      {
        id: "soa-generator",
        description: "Generate Statement of Applicability",
        output: "document",
      },
      {
        id: "risk-treatment-plan",
        description: "Generate risk treatment plan",
        output: "document",
      },
      {
        id: "certification-roadmap",
        description: "Phased roadmap to ISO 27001 certification",
        output: "document",
      },
      {
        id: "isms-documentation-pack",
        description: "Generate full ISMS documentation bundle",
        output: "document",
      },
    ],
  },
  {
    id: "nist-800-53",
    label: "NIST 800-53",
    type: "framework",
    personas: ALL,
    commands: [
      {
        id: "assess",
        description: "NIST 800-53 r5 assessment by family or baseline",
        output: "report",
      },
      {
        id: "select-baseline",
        description: "Select and tailor Low/Moderate/High baseline",
        output: "document",
        form: NIST_BASELINE_SELECT_FORM,
      },
      {
        id: "control-tailor",
        description: "Tailor an individual control",
        output: "document",
      },
      {
        id: "family-deep-dive",
        description: "Deep dive into a specific control family",
        output: "document",
      },
      {
        id: "overlay-apply",
        description: "Apply FedRAMP/DoD/HIPAA overlay to baseline",
        output: "document",
      },
      {
        id: "ssp-section-generate",
        description: "Generate SSP control narrative section",
        output: "document",
      },
      {
        id: "continuous-monitoring-setup",
        description: "Set up continuous monitoring program",
        output: "document",
      },
    ],
  },
  {
    id: "nydfs",
    label: "NYDFS",
    type: "framework",
    personas: ALL,
    commands: [
      {
        id: "assess",
        description: "NYDFS 23 NYCRR 500 compliance assessment",
        output: "report",
      },
      {
        id: "ciso-requirements",
        description: "CISO appointment and reporting requirements",
        output: "document",
      },
      {
        id: "certification",
        description: "Annual certification requirements",
        output: "document",
      },
      {
        id: "pentest-plan",
        description: "Penetration testing plan per NYDFS",
        output: "document",
      },
      {
        id: "evidence-checklist",
        description: "NYDFS evidence requirements",
        output: "document",
      },
    ],
  },
  {
    id: "okta-inspector",
    label: "Okta Inspector",
    type: "connector",
    personas: ["engineer"],
    commands: [
      {
        id: "setup",
        description: "Configure Okta API token and domain",
        output: "status",
      },
      {
        id: "collect",
        description: "Collect MFA, policy, and user findings",
        output: "report",
      },
      {
        id: "status",
        description: "Show connector health and cache state",
        output: "status",
      },
    ],
  },
  {
    id: "oscal",
    label: "OSCAL",
    type: "tool",
    personas: ["engineer", "auditor"],
    commands: [
      {
        id: "setup",
        description: "Install or build the OSCAL binary",
        output: "status",
      },
      {
        id: "validate",
        description: "Validate an OSCAL document against schema",
        output: "report",
      },
      {
        id: "convert",
        description: "Convert OSCAL between JSON, XML, and YAML",
        output: "document",
      },
    ],
  },
  {
    id: "pbmm",
    label: "PBMM",
    type: "framework",
    personas: ALL,
    commands: [
      {
        id: "assess",
        description: "Canadian PBMM (ITSG-33) assessment",
        output: "report",
      },
      {
        id: "profile-select",
        description: "Select the right security profile",
        output: "document",
      },
      {
        id: "cccs-guidance",
        description: "CCCS-specific guidance",
        output: "document",
      },
      {
        id: "data-residency",
        description: "Canadian data residency requirements",
        output: "document",
      },
    ],
  },
  {
    id: "pci-dss",
    label: "PCI DSS",
    type: "framework",
    personas: ALL,
    commands: [
      {
        id: "assess",
        description: "PCI DSS v4.0.1 readiness assessment",
        output: "report",
      },
      {
        id: "requirement",
        description: "Detailed guidance for a specific requirement",
        output: "document",
      },
      {
        id: "saq-select",
        description: "Select the right Self-Assessment Questionnaire",
        output: "document",
      },
      {
        id: "roc-guidance",
        description: "Report on Compliance authoring guidance",
        output: "document",
      },
      {
        id: "march-2025",
        description: "Mandatory requirements as of March 31 2025",
        output: "report",
      },
    ],
  },
  {
    id: "singapore-pdpa",
    label: "Singapore PDPA",
    type: "framework",
    personas: ALL,
    commands: [
      {
        id: "assess",
        description: "Singapore PDPA compliance assessment",
        output: "report",
      },
      {
        id: "scope",
        description: "PDPA applicability and scope determination",
        output: "document",
      },
      {
        id: "evidence-checklist",
        description: "PDPA evidence requirements",
        output: "document",
      },
    ],
  },
  {
    id: "soc2",
    label: "SOC 2",
    type: "framework",
    personas: ALL,
    commands: [
      {
        id: "assess",
        description: "SOC 2 Type I or II readiness assessment",
        output: "report",
        form: SOC2_ASSESS_FORM,
      },
      {
        id: "evidence-checklist",
        description: "Evidence checklist per Trust Service Category",
        output: "document",
        form: SOC2_EVIDENCE_CHECKLIST_FORM,
      },
      {
        id: "gap-to-code",
        description: "Convert gap findings to IaC remediation",
        output: "code",
      },
      {
        id: "generate-tsc-matrix",
        description: "Generate Trust Service Criteria matrix",
        output: "document",
      },
      {
        id: "map-controls",
        description: "Map controls from another framework to SOC 2",
        output: "report",
      },
      {
        id: "service-auditor-prep",
        description: "Prepare for service auditor engagement",
        output: "document",
      },
      {
        id: "type-ii-planner",
        description: "Plan a SOC 2 Type II audit period",
        output: "document",
      },
    ],
  },
  {
    id: "stateramp",
    label: "StateRAMP",
    type: "framework",
    personas: ALL,
    commands: [
      {
        id: "assess",
        description: "StateRAMP readiness assessment",
        output: "report",
      },
      {
        id: "impact-select",
        description: "Select impact level for state/local gov",
        output: "document",
      },
      {
        id: "documentation",
        description: "StateRAMP documentation requirements",
        output: "document",
      },
      {
        id: "state-specific",
        description: "State-specific requirements guidance",
        output: "document",
      },
      {
        id: "evidence-checklist",
        description: "StateRAMP evidence requirements",
        output: "document",
      },
    ],
  },
  {
    id: "us-export",
    label: "US Export",
    type: "framework",
    personas: ALL,
    commands: [
      {
        id: "assess",
        description: "Combined ITAR + EAR export control assessment",
        output: "report",
      },
      {
        id: "itar-assess",
        description: "ITAR-specific readiness assessment",
        output: "report",
      },
      {
        id: "ear-assess",
        description: "EAR item classification and screening",
        output: "report",
      },
      {
        id: "jurisdiction",
        description: "Jurisdiction determination (ITAR vs EAR)",
        output: "document",
      },
      {
        id: "data-residency",
        description: "Export-controlled data residency requirements",
        output: "document",
      },
      {
        id: "compliance-matrix",
        description: "Combined ITAR/EAR compliance matrix",
        output: "document",
      },
    ],
  },
];

export const FALLBACK_PLUGINS = PLUGINS;
