export type PipelineTier = 1 | 2 | 3;

export interface PipelineStep {
  command: string;
  label: string;
  parallel?: boolean;
}

export interface PipelineInput {
  id: string;
  label: string;
  placeholder: string;
  required: boolean;
  type: "text" | "select";
  options?: { label: string; value: string }[];
}

export type PipelineReadiness = "ready" | "planned";

export interface Pipeline {
  id: string;
  path: string;
  label: string;
  description: string;
  readiness: PipelineReadiness;
  tier: PipelineTier;
  steps: PipelineStep[];
  inputs: PipelineInput[];
}

const CONNECTOR_OPTIONS = [
  { label: "GitHub Inspector", value: "github-inspector" },
  { label: "AWS Inspector", value: "aws-inspector" },
  { label: "GCP Inspector", value: "gcp-inspector" },
  { label: "Okta Inspector", value: "okta-inspector" },
];

const FRAMEWORK_OPTIONS = [
  { label: "SOC 2", value: "SOC2" },
  { label: "NIST 800-53", value: "NIST-800-53" },
  { label: "ISO 27001", value: "ISO-27001" },
  { label: "PCI DSS", value: "PCI-DSS" },
  { label: "FedRAMP Rev5", value: "fedramp-rev5" },
  { label: "FedRAMP 20x", value: "fedramp-20x" },
  { label: "CMMC", value: "CMMC" },
  { label: "HITRUST", value: "HITRUST" },
  { label: "DORA", value: "DORA" },
  { label: "GDPR", value: "GDPR" },
  { label: "CIS Controls", value: "CIS-Controls" },
  { label: "NYDFS", value: "NYDFS" },
  { label: "CSA CCM", value: "CSA-CCM" },
  { label: "Essential Eight", value: "Essential8" },
  { label: "GLBA", value: "GLBA" },
  { label: "IRAP", value: "IRAP" },
  { label: "ISMAP", value: "ISMAP" },
  { label: "PBMM", value: "PBMM" },
  { label: "StateRAMP", value: "StateRAMP" },
];

const CLOUD_OPTIONS = [
  { label: "AWS", value: "aws" },
  { label: "GCP", value: "gcp" },
  { label: "Azure", value: "azure" },
  { label: "Kubernetes", value: "kubernetes" },
];

export const PIPELINES: Pipeline[] = [
  // ─── Tier 1 ───────────────────────────────────────────────────────────────
  {
    id: "evidence-to-gap",
    path: "/pipeline:evidence-to-gap",
    label: "Evidence → Gap → Summary",
    readiness: "planned",
    description:
      "Collect connector findings, run a gap assessment, then generate an executive summary. The most common daily GRC pipeline.",
    tier: 1,
    steps: [
      { command: "/{connector}:collect", label: "Collect findings" },
      { command: "/grc-engineer:gap-assessment", label: "Gap assessment" },
      { command: "/grc-reporter:exec-summary", label: "Exec summary" },
    ],
    inputs: [
      {
        id: "connector",
        label: "Connector",
        placeholder: "github-inspector",
        required: true,
        type: "select",
        options: CONNECTOR_OPTIONS,
      },
      {
        id: "framework",
        label: "Framework",
        placeholder: "SOC2",
        required: true,
        type: "select",
        options: FRAMEWORK_OPTIONS,
      },
    ],
  },
  {
    id: "iac-compliance",
    path: "/pipeline:iac-compliance",
    label: "IaC Scan → Optimise → Coverage",
    readiness: "planned",
    description:
      "Scan infrastructure-as-code for violations, compute cross-framework optimisation opportunities, then produce an automation coverage report.",
    tier: 1,
    steps: [
      { command: "/grc-engineer:scan-iac", label: "Scan IaC" },
      {
        command: "/grc-engineer:optimize-multi-framework",
        label: "Optimise frameworks",
      },
      {
        command: "/grc-reporter:automation-coverage",
        label: "Coverage report",
      },
    ],
    inputs: [
      {
        id: "directory",
        label: "IaC directory",
        placeholder: "./terraform",
        required: true,
        type: "text",
      },
      {
        id: "frameworks",
        label: "Frameworks (comma-separated)",
        placeholder: "SOC2,NIST-800-53",
        required: true,
        type: "text",
      },
    ],
  },
  {
    id: "multi-cloud-collect",
    path: "/pipeline:multi-cloud-collect",
    label: "Multi-Cloud Collect → Gap",
    readiness: "planned",
    description:
      "Run all four connector collections in sequence, then assess findings across the chosen framework. Replaces four manual collect runs.",
    tier: 1,
    steps: [
      {
        command: "/aws-inspector:collect",
        label: "AWS collect",
        parallel: true,
      },
      {
        command: "/gcp-inspector:collect",
        label: "GCP collect",
        parallel: true,
      },
      {
        command: "/github-inspector:collect",
        label: "GitHub collect",
        parallel: true,
      },
      {
        command: "/okta-inspector:collect",
        label: "Okta collect",
        parallel: true,
      },
      { command: "/grc-engineer:gap-assessment", label: "Gap assessment" },
    ],
    inputs: [
      {
        id: "framework",
        label: "Framework",
        placeholder: "SOC2",
        required: true,
        type: "select",
        options: FRAMEWORK_OPTIONS,
      },
    ],
  },

  // ─── Tier 2 ───────────────────────────────────────────────────────────────
  {
    id: "fedramp-package",
    path: "/pipeline:fedramp-package",
    label: "FedRAMP Package",
    readiness: "planned",
    description:
      "Convert the SSP, validate the OSCAL output, run a FedRAMP gap assessment, then produce a board brief for the audit committee.",
    tier: 2,
    steps: [
      { command: "/fedramp-ssp:convert", label: "Convert SSP" },
      { command: "/oscal:validate", label: "Validate OSCAL" },
      {
        command: "/grc-engineer:gap-assessment fedramp-rev5",
        label: "Gap assessment",
      },
      {
        command: "/grc-reporter:board-brief",
        label: "Board brief",
      },
    ],
    inputs: [
      {
        id: "quarter",
        label: "Quarter",
        placeholder: "2026-Q2",
        required: false,
        type: "text",
      },
    ],
  },
  {
    id: "new-framework-onboard",
    path: "/pipeline:new-framework-onboard",
    label: "Onboard New Framework",
    readiness: "planned",
    description:
      "Scaffold a new compliance framework, run an initial gap assessment, then compute overlap with existing frameworks to find implementation shortcuts.",
    tier: 2,
    steps: [
      {
        command: "/grc-engineer:scaffold-framework",
        label: "Scaffold framework",
      },
      { command: "/grc-engineer:gap-assessment", label: "Initial gap" },
      {
        command: "/grc-engineer:optimize-multi-framework",
        label: "Overlap analysis",
      },
    ],
    inputs: [
      {
        id: "framework",
        label: "New framework",
        placeholder: "DORA",
        required: true,
        type: "select",
        options: FRAMEWORK_OPTIONS,
      },
      {
        id: "existing_frameworks",
        label: "Existing frameworks (comma-separated)",
        placeholder: "SOC2,NIST-800-53",
        required: false,
        type: "text",
      },
    ],
  },
  {
    id: "control-test-and-report",
    path: "/pipeline:control-test-and-report",
    label: "Control Test → Evidence → Metrics",
    readiness: "planned",
    description:
      "Test a control's effectiveness, collect its evidence, then record the automation metric. A tight loop auditors run per-control.",
    tier: 2,
    steps: [
      { command: "/grc-engineer:test-control", label: "Test control" },
      { command: "/grc-engineer:collect-evidence", label: "Collect evidence" },
      {
        command: "/grc-engineer:record-automation-metrics",
        label: "Record metrics",
      },
    ],
    inputs: [
      {
        id: "control",
        label: "Control ID",
        placeholder: "access_control_account_management",
        required: true,
        type: "text",
      },
      {
        id: "cloud",
        label: "Cloud provider",
        placeholder: "aws",
        required: true,
        type: "select",
        options: CLOUD_OPTIONS,
      },
    ],
  },

  // ─── Tier 3 ───────────────────────────────────────────────────────────────
  {
    id: "tprm-assessment",
    path: "/pipeline:tprm-assessment",
    label: "TPRM Assessment → Policy",
    readiness: "planned",
    description:
      "Run a third-party risk assessment, transform findings into a risk register, then generate a vendor management policy.",
    tier: 3,
    steps: [
      { command: "/grc-tprm:assess", label: "TPRM assess" },
      { command: "/grc-engineer:transform-risk", label: "Transform risk" },
      { command: "/grc-engineer:generate-policy", label: "Generate policy" },
    ],
    inputs: [
      {
        id: "vendor",
        label: "Vendor name",
        placeholder: "Acme Corp",
        required: true,
        type: "text",
      },
      {
        id: "framework",
        label: "Framework",
        placeholder: "SOC2",
        required: false,
        type: "select",
        options: FRAMEWORK_OPTIONS,
      },
    ],
  },
  {
    id: "incident-response",
    path: "/pipeline:incident-response",
    label: "Incident Response Sequence",
    readiness: "planned",
    description:
      "Walk through the incident reporting sequence for DORA or NIST: detect, classify, report, and produce a post-incident guidance document.",
    tier: 3,
    steps: [
      { command: "/dora:incident-reporting", label: "Incident reporting" },
      { command: "/grc-auditor:review", label: "Auditor review" },
      { command: "/grc-engineer:generate-policy", label: "Post-incident doc" },
    ],
    inputs: [
      {
        id: "framework",
        label: "Framework",
        placeholder: "DORA",
        required: true,
        type: "select",
        options: [
          { label: "DORA", value: "DORA" },
          { label: "NIST 800-53", value: "NIST-800-53" },
        ],
      },
    ],
  },
  {
    id: "audit-prep",
    path: "/pipeline:audit-prep",
    label: "Audit Prep",
    readiness: "planned",
    description:
      "Run a gap assessment, collect evidence for all controls, and generate a framework policy document — timed to an upcoming audit window.",
    tier: 3,
    steps: [
      { command: "/grc-engineer:gap-assessment", label: "Gap assessment" },
      { command: "/grc-engineer:collect-evidence", label: "Collect evidence" },
      { command: "/grc-engineer:generate-policy", label: "Generate policy" },
      { command: "/grc-reporter:board-brief", label: "Audit brief" },
    ],
    inputs: [
      {
        id: "framework",
        label: "Framework",
        placeholder: "SOC2",
        required: true,
        type: "select",
        options: FRAMEWORK_OPTIONS,
      },
      {
        id: "audit_date",
        label: "Audit date",
        placeholder: "2026-06-01",
        required: false,
        type: "text",
      },
    ],
  },
];

export const TIER_LABELS: Record<PipelineTier, string> = {
  1: "Tier 1",
  2: "Tier 2",
  3: "Tier 3",
};

export const TIER_TONES: Record<PipelineTier, string> = {
  1: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  2: "border-sky-500/30 bg-sky-500/10 text-sky-400",
  3: "border-amber-500/30 bg-amber-500/10 text-amber-400",
};
