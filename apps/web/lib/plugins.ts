export type Persona = "engineer" | "auditor" | "internal" | "tprm"

export type OutputType = "report" | "code" | "document" | "status" | "score"

export interface Command {
  id: string
  description: string
  output?: OutputType
}

export interface Plugin {
  id: string
  label: string
  type: "hub" | "framework" | "connector" | "tool"
  personas: Persona[]
  commands: Command[]
}

const ALL: Persona[] = ["engineer", "auditor", "internal", "tprm"]

export const PLUGINS: Plugin[] = [
  {
    id: "aws-inspector",
    label: "aws-inspector",
    type: "connector",
    personas: ["engineer"],
    commands: [
      { id: "setup",   description: "Configure AWS credentials and region",       output: "status" },
      { id: "collect", description: "Collect IAM, S3, CloudTrail, EBS findings",  output: "report" },
      { id: "status",  description: "Show connector health and cache state",       output: "status" },
    ],
  },
  {
    id: "cis-controls",
    label: "cis-controls",
    type: "framework",
    personas: ALL,
    commands: [
      { id: "assess",             description: "CIS Controls v8 readiness assessment",       output: "report" },
      { id: "ig-select",          description: "Select appropriate Implementation Group",     output: "document" },
      { id: "safeguard-list",     description: "List safeguards for a given IG",             output: "report" },
      { id: "control-check",      description: "Check a specific CIS control",               output: "report" },
      { id: "evidence-checklist", description: "Evidence requirements per IG",               output: "document" },
    ],
  },
  {
    id: "cmmc",
    label: "cmmc",
    type: "framework",
    personas: ALL,
    commands: [
      { id: "assess",             description: "CMMC 2.0 assessment for level 1–3",          output: "report" },
      { id: "level-select",       description: "Guidance on selecting the right level",       output: "document" },
      { id: "practice-check",     description: "Check a specific CMMC practice",             output: "report" },
      { id: "domain-guidance",    description: "Guidance for a specific CMMC domain",        output: "document" },
      { id: "evidence-checklist", description: "Evidence requirements per level",            output: "document" },
    ],
  },
  {
    id: "csa-ccm",
    label: "csa-ccm",
    type: "framework",
    personas: ALL,
    commands: [
      { id: "assess",             description: "Cloud Controls Matrix assessment",           output: "report" },
      { id: "caiq-generate",      description: "Generate CAIQ questionnaire responses",      output: "document" },
      { id: "domain-guidance",    description: "Guidance for a specific CCM domain",        output: "document" },
      { id: "evidence-checklist", description: "CCM evidence requirements",                 output: "document" },
      { id: "map-framework",      description: "Map CCM to/from another framework",         output: "report" },
    ],
  },
  {
    id: "dora",
    label: "dora",
    type: "framework",
    personas: ALL,
    commands: [
      { id: "assess",             description: "EU DORA readiness assessment",              output: "report" },
      { id: "pillar-guidance",    description: "Guidance for a specific DORA pillar",       output: "document" },
      { id: "incident-reporting", description: "Major incident reporting process",          output: "document" },
      { id: "testing-plan",       description: "Digital resilience testing plan",           output: "document" },
      { id: "evidence-checklist", description: "DORA evidence requirements",               output: "document" },
    ],
  },
  {
    id: "essential8",
    label: "essential8",
    type: "framework",
    personas: ALL,
    commands: [
      { id: "assess",             description: "Australian Essential Eight assessment",     output: "report" },
      { id: "maturity-level",     description: "Maturity level guidance (ML1–ML3)",        output: "document" },
      { id: "strategy-check",     description: "Check a specific mitigation strategy",     output: "report" },
      { id: "roadmap",            description: "Roadmap to a target maturity level",       output: "document" },
      { id: "evidence-checklist", description: "Essential Eight evidence requirements",    output: "document" },
    ],
  },
  {
    id: "fedramp-20x",
    label: "fedramp-20x",
    type: "framework",
    personas: ["engineer", "auditor", "internal"],
    commands: [
      { id: "ksi-check",  description: "Check Key Security Indicators by category",        output: "report" },
      { id: "mas-review", description: "Minimum Assessment Scope review",                  output: "report" },
      { id: "vdr-assess", description: "Vulnerability Detection and Response assessment",   output: "report" },
      { id: "sync-docs",  description: "Sync latest FedRAMP 20X policy documents",         output: "status" },
    ],
  },
  {
    id: "fedramp-rev5",
    label: "fedramp-rev5",
    type: "framework",
    personas: ["engineer", "auditor", "internal"],
    commands: [
      { id: "assess",          description: "FedRAMP Rev 5 readiness assessment",           output: "report" },
      { id: "baseline-select", description: "Select Low / Moderate / High baseline",        output: "document" },
      { id: "poam-review",     description: "Review Plan of Action & Milestones",           output: "report" },
      { id: "ssp-guidance",    description: "SSP section authoring guidance",               output: "document" },
    ],
  },
  {
    id: "fedramp-ssp",
    label: "fedramp-ssp",
    type: "tool",
    personas: ["engineer", "auditor"],
    commands: [
      { id: "setup",   description: "Install SSP conversion tool",                          output: "status" },
      { id: "convert", description: "Convert Word SSP to OSCAL 1.2.0 JSON",                output: "document" },
    ],
  },
  {
    id: "gcp-inspector",
    label: "gcp-inspector",
    type: "connector",
    personas: ["engineer"],
    commands: [
      { id: "setup",   description: "Configure GCP credentials and project",                output: "status" },
      { id: "collect", description: "Collect IAM, Storage, KMS, Compute findings",         output: "report" },
      { id: "status",  description: "Show connector health and cache state",                output: "status" },
    ],
  },
  {
    id: "gdpr",
    label: "gdpr",
    type: "framework",
    personas: ALL,
    commands: [
      { id: "assess",             description: "GDPR readiness assessment",                 output: "report" },
      { id: "dpia",               description: "Data Protection Impact Assessment",         output: "document" },
      { id: "breach-process",     description: "72-hour breach notification guidance",      output: "document" },
      { id: "rights-check",       description: "Data subject rights implementation check",  output: "report" },
      { id: "evidence-checklist", description: "GDPR compliance evidence requirements",    output: "document" },
    ],
  },
  {
    id: "github-inspector",
    label: "github-inspector",
    type: "connector",
    personas: ["engineer"],
    commands: [
      { id: "setup",   description: "Configure GitHub token and scope",                     output: "status" },
      { id: "collect", description: "Collect branch protection and scanning findings",      output: "report" },
      { id: "status",  description: "Show connector health and cache state",                output: "status" },
    ],
  },
  {
    id: "glba",
    label: "glba",
    type: "framework",
    personas: ALL,
    commands: [
      { id: "assess",             description: "GLBA Safeguards and Privacy Rules assessment", output: "report" },
      { id: "safeguards",         description: "Safeguards Rule requirements",                 output: "document" },
      { id: "privacy",            description: "Privacy Rule and notice obligations",          output: "document" },
      { id: "risk-assessment",    description: "GLBA-required risk assessment process",        output: "document" },
      { id: "evidence-checklist", description: "GLBA evidence requirements",                  output: "document" },
    ],
  },
  {
    id: "grc-auditor",
    label: "grc-auditor",
    type: "hub",
    personas: ["auditor"],
    commands: [
      { id: "generate-workpaper", description: "Generate audit workpaper (finding/test/summary)", output: "document" },
      { id: "review-evidence",    description: "Review evidence artifacts for completeness",      output: "report" },
      { id: "validate-control",   description: "Validate a control against its framework",        output: "report" },
    ],
  },
  {
    id: "grc-engineer",
    label: "grc-engineer",
    type: "hub",
    personas: ["engineer"],
    commands: [
      { id: "gap-assessment",          description: "Run a multi-framework gap assessment",          output: "report" },
      { id: "scan-iac",                description: "Scan IaC files for compliance violations",      output: "report" },
      { id: "generate-implementation", description: "Generate IaC for a specific control",           output: "code" },
      { id: "generate-policy",         description: "Generate OPA/Sentinel/AWS Config policy",       output: "code" },
      { id: "test-control",            description: "Run tests for a specific control",              output: "report" },
      { id: "monitor-continuous",      description: "Set up continuous compliance monitoring",       output: "status" },
      { id: "map-controls-unified",    description: "Cross-framework control mapping",               output: "report" },
      { id: "find-conflicts",          description: "Detect conflicting requirements across frameworks", output: "report" },
      { id: "optimize-multi-framework","description": "ROI-optimized multi-framework control plan",  output: "document" },
      { id: "collect-evidence",        description: "Generate evidence collection script",           output: "code" },
      { id: "review-pr",               description: "Compliance review of a GitHub pull request",    output: "report" },
      { id: "pipeline-status",         description: "Show all connector health and cache state",     output: "status" },
      { id: "scaffold-framework",      description: "Scaffold a new framework plugin from SCF",      output: "code" },
      { id: "transform-risk",          description: "Convert risk description to Jira ticket",       output: "document" },
    ],
  },
  {
    id: "grc-internal",
    label: "grc-internal",
    type: "hub",
    personas: ["internal"],
    commands: [
      { id: "manage-risk",       description: "Add, update, assess, or report on risks",    output: "document" },
      { id: "track-compliance",  description: "Track compliance posture across frameworks", output: "report" },
      { id: "update-policy",     description: "Review, update, or version a policy file",  output: "document" },
    ],
  },
  {
    id: "grc-tprm",
    label: "grc-tprm",
    type: "hub",
    personas: ["tprm"],
    commands: [
      { id: "analyze-questionnaire", description: "Analyze SIG, CAIQ, or VSAQ questionnaire", output: "report" },
      { id: "assess-vendor",         description: "Full vendor risk assessment",               output: "report" },
      { id: "score-risk",            description: "Score vendor risk with a rating model",     output: "score" },
    ],
  },
  {
    id: "hitrust",
    label: "hitrust",
    type: "framework",
    personas: ALL,
    commands: [
      { id: "assess",             description: "HITRUST CSF assessment",                    output: "report" },
      { id: "scope-select",       description: "Select assessment type (i1, r2, e1)",       output: "document" },
      { id: "gap-analysis",       description: "Gap analysis against HITRUST CSF",          output: "report" },
      { id: "control-map",        description: "Map controls from another framework",       output: "report" },
      { id: "evidence-checklist", description: "Evidence requirements by scope",            output: "document" },
    ],
  },
  {
    id: "irap",
    label: "irap",
    type: "framework",
    personas: ALL,
    commands: [
      { id: "assess",        description: "Australian IRAP assessment (ISM + Essential Eight)", output: "report" },
      { id: "classification","description": "Australian government information classification",  output: "document" },
      { id: "essential-8",   description: "Essential Eight requirements within IRAP",           output: "document" },
      { id: "data-residency","description": "Australian data sovereignty requirements",          output: "document" },
    ],
  },
  {
    id: "ismap",
    label: "ismap",
    type: "framework",
    personas: ALL,
    commands: [
      { id: "assess",        description: "Japanese ISMAP government cloud assessment",     output: "report" },
      { id: "registration",  description: "ISMAP registration process guidance",           output: "document" },
      { id: "iso-mapping",   description: "Map ISMAP controls to ISO 27001",              output: "report" },
      { id: "data-residency","description": "Japanese data residency requirements",         output: "document" },
    ],
  },
  {
    id: "iso27001",
    label: "iso27001",
    type: "framework",
    personas: ALL,
    commands: [
      { id: "assess",                  description: "ISO 27001:2022 ISMS readiness assessment",    output: "report" },
      { id: "gap-analysis",            description: "Gap analysis across all 93 Annex A controls", output: "report" },
      { id: "annex-a-deep-dive",       description: "Deep dive into a specific Annex A domain",    output: "document" },
      { id: "soa-generator",           description: "Generate Statement of Applicability",         output: "document" },
      { id: "risk-treatment-plan",     description: "Generate risk treatment plan",                output: "document" },
      { id: "certification-roadmap",   description: "Phased roadmap to ISO 27001 certification",   output: "document" },
      { id: "isms-documentation-pack", description: "Generate full ISMS documentation bundle",     output: "document" },
    ],
  },
  {
    id: "nist-800-53",
    label: "nist-800-53",
    type: "framework",
    personas: ALL,
    commands: [
      { id: "assess",                       description: "NIST 800-53 r5 assessment by family or baseline", output: "report" },
      { id: "select-baseline",              description: "Select and tailor Low/Moderate/High baseline",     output: "document" },
      { id: "control-tailor",               description: "Tailor an individual control",                    output: "document" },
      { id: "family-deep-dive",             description: "Deep dive into a specific control family",        output: "document" },
      { id: "overlay-apply",                description: "Apply FedRAMP/DoD/HIPAA overlay to baseline",    output: "document" },
      { id: "ssp-section-generate",         description: "Generate SSP control narrative section",         output: "document" },
      { id: "continuous-monitoring-setup",  description: "Set up continuous monitoring program",           output: "document" },
    ],
  },
  {
    id: "nydfs",
    label: "nydfs",
    type: "framework",
    personas: ALL,
    commands: [
      { id: "assess",             description: "NYDFS 23 NYCRR 500 compliance assessment",   output: "report" },
      { id: "ciso-requirements",  description: "CISO appointment and reporting requirements", output: "document" },
      { id: "certification",      description: "Annual certification requirements",           output: "document" },
      { id: "pentest-plan",       description: "Penetration testing plan per NYDFS",         output: "document" },
      { id: "evidence-checklist", description: "NYDFS evidence requirements",                output: "document" },
    ],
  },
  {
    id: "okta-inspector",
    label: "okta-inspector",
    type: "connector",
    personas: ["engineer"],
    commands: [
      { id: "setup",   description: "Configure Okta API token and domain",                   output: "status" },
      { id: "collect", description: "Collect MFA, policy, and user findings",               output: "report" },
      { id: "status",  description: "Show connector health and cache state",                 output: "status" },
    ],
  },
  {
    id: "oscal",
    label: "oscal",
    type: "tool",
    personas: ["engineer", "auditor"],
    commands: [
      { id: "setup",    description: "Install or build the OSCAL binary",                   output: "status" },
      { id: "validate", description: "Validate an OSCAL document against schema",           output: "report" },
      { id: "convert",  description: "Convert OSCAL between JSON, XML, and YAML",           output: "document" },
    ],
  },
  {
    id: "pbmm",
    label: "pbmm",
    type: "framework",
    personas: ALL,
    commands: [
      { id: "assess",        description: "Canadian PBMM (ITSG-33) assessment",             output: "report" },
      { id: "profile-select","description": "Select the right security profile",             output: "document" },
      { id: "cccs-guidance", description: "CCCS-specific guidance",                         output: "document" },
      { id: "data-residency","description": "Canadian data residency requirements",          output: "document" },
    ],
  },
  {
    id: "pci-dss",
    label: "pci-dss",
    type: "framework",
    personas: ALL,
    commands: [
      { id: "assess",      description: "PCI DSS v4.0.1 readiness assessment",              output: "report" },
      { id: "requirement", description: "Detailed guidance for a specific requirement",      output: "document" },
      { id: "saq-select",  description: "Select the right Self-Assessment Questionnaire",   output: "document" },
      { id: "roc-guidance","description": "Report on Compliance authoring guidance",         output: "document" },
      { id: "march-2025",  description: "Mandatory requirements as of March 31 2025",       output: "report" },
    ],
  },
  {
    id: "singapore-pdpa",
    label: "singapore-pdpa",
    type: "framework",
    personas: ALL,
    commands: [
      { id: "assess",             description: "Singapore PDPA compliance assessment",      output: "report" },
      { id: "scope",              description: "PDPA applicability and scope determination", output: "document" },
      { id: "evidence-checklist", description: "PDPA evidence requirements",               output: "document" },
    ],
  },
  {
    id: "soc2",
    label: "soc2",
    type: "framework",
    personas: ALL,
    commands: [
      { id: "assess",               description: "SOC 2 Type I or II readiness assessment",    output: "report" },
      { id: "evidence-checklist",   description: "Evidence checklist per Trust Service Category", output: "document" },
      { id: "gap-to-code",          description: "Convert gap findings to IaC remediation",    output: "code" },
      { id: "generate-tsc-matrix",  description: "Generate Trust Service Criteria matrix",     output: "document" },
      { id: "map-controls",         description: "Map controls from another framework to SOC 2", output: "report" },
      { id: "service-auditor-prep", description: "Prepare for service auditor engagement",     output: "document" },
      { id: "type-ii-planner",      description: "Plan a SOC 2 Type II audit period",         output: "document" },
    ],
  },
  {
    id: "stateramp",
    label: "stateramp",
    type: "framework",
    personas: ALL,
    commands: [
      { id: "assess",             description: "StateRAMP readiness assessment",             output: "report" },
      { id: "impact-select",      description: "Select impact level for state/local gov",   output: "document" },
      { id: "documentation",      description: "StateRAMP documentation requirements",      output: "document" },
      { id: "state-specific",     description: "State-specific requirements guidance",      output: "document" },
      { id: "evidence-checklist", description: "StateRAMP evidence requirements",          output: "document" },
    ],
  },
  {
    id: "us-export",
    label: "us-export",
    type: "framework",
    personas: ALL,
    commands: [
      { id: "assess",            description: "Combined ITAR + EAR export control assessment", output: "report" },
      { id: "itar-assess",       description: "ITAR-specific readiness assessment",            output: "report" },
      { id: "ear-assess",        description: "EAR item classification and screening",         output: "report" },
      { id: "jurisdiction",      description: "Jurisdiction determination (ITAR vs EAR)",      output: "document" },
      { id: "data-residency",    description: "Export-controlled data residency requirements", output: "document" },
      { id: "compliance-matrix", description: "Combined ITAR/EAR compliance matrix",          output: "document" },
    ],
  },
]
