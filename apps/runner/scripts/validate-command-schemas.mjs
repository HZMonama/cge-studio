import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import yaml from "js-yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..", "..");
const pluginsRoot =
  process.env.CGE_TOOLKIT_PATH != null
    ? path.resolve(process.env.CGE_TOOLKIT_PATH, "plugins")
    : path.join(repoRoot, "cli", "cli-grc-engineering", "plugins");

const validV3OutputTypes = new Set([
  "stdout",
  "artifact",
  "findings",
  "program-records",
  "metrics",
  "interactive",
]);
const validV3OutputFormats = new Set([
  "text",
  "markdown",
  "json",
  "yaml",
  "xml",
  "sarif",
  "oscal-json",
  "oscal-xml",
  "directory",
  "mixed",
]);
const validV3Destinations = new Set([
  "stdout",
  "stderr",
  "runner-history",
  "artifact-store",
  "findings-store",
  "metrics-store",
  "program-store",
  "cache",
]);
const validArtifactKinds = new Set([
  "report",
  "export",
  "evidence",
  "code",
  "script",
  "config",
  "oscal",
  "sarif",
  "bundle",
  "directory",
  "summary",
]);
const validProgramRecordTypes = new Set([
  "risk",
  "vendor",
  "policy",
  "exception",
  "control",
]);
const validValidationModes = new Set(["none", "shape", "strict"]);
const validExecutionModes = new Set(["script", "workflow", "agent"]);
const validInputTypes = new Set([
  "text",
  "textarea",
  "select",
  "multiselect",
  "boolean",
  "number",
  "path",
  "secret",
]);

const schemaPaths = [];
const directCommandMarkdown = [];
const failures = [];
let v2Count = 0;
let v3Count = 0;

walk(pluginsRoot);

for (const markdownPath of directCommandMarkdown) {
  failures.push(
    `${relative(markdownPath)}: legacy direct command markdown must be migrated to a command directory`,
  );
}

for (const schemaPath of schemaPaths) {
  validateSchema(schemaPath);
}

if (failures.length > 0) {
  console.error(`Command schema validation failed (${failures.length}):`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  `Command schema validation passed: ${schemaPaths.length} schemas (${v2Count} v2, ${v3Count} v3), 0 legacy markdown files.`,
);

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (entry.name === "schema.yaml") {
      schemaPaths.push(fullPath);
      continue;
    }

    if (
      entry.name.endsWith(".md") &&
      path.basename(path.dirname(fullPath)) === "commands"
    ) {
      directCommandMarkdown.push(fullPath);
    }
  }
}

function validateSchema(schemaPath) {
  const commandDir = path.dirname(schemaPath);
  const readmePath = path.join(commandDir, "README.md");
  let schema;

  try {
    schema = yaml.load(fs.readFileSync(schemaPath, "utf8"));
  } catch (error) {
    failures.push(`${relative(schemaPath)}: YAML parse failed: ${error.message}`);
    return;
  }

  if (!fs.existsSync(readmePath)) {
    failures.push(`${relative(schemaPath)}: missing README.md`);
  }

  if (!schema?.meta?.id) failures.push(`${relative(schemaPath)}: missing meta.id`);
  if (!schema?.meta?.plugin) {
    failures.push(`${relative(schemaPath)}: missing meta.plugin`);
  }
  if (!schema?.meta?.description) {
    failures.push(`${relative(schemaPath)}: missing meta.description`);
  }
  if (!schema?.documentation?.summary) {
    failures.push(`${relative(schemaPath)}: missing documentation.summary`);
  }
  if (schema?.documentation?.readme !== "./README.md") {
    failures.push(`${relative(schemaPath)}: documentation.readme must be ./README.md`);
  }

  if (schema?.schemaVersion !== 3) {
    v2Count += 1;
    failures.push(`${relative(schemaPath)}: schemaVersion must be 3`);
  } else {
    v3Count += 1;
    validateV3Outputs(schemaPath, schema.outputs);
  }

  if (!validExecutionModes.has(schema?.execution?.mode)) {
    failures.push(
      `${relative(schemaPath)}: invalid execution.mode ${schema?.execution?.mode}`,
    );
  }
  if (schema?.execution?.mode === "script") {
    if (!schema.execution.script) {
      failures.push(`${relative(schemaPath)}: script mode missing execution.script`);
    } else {
      const scriptPath = path.resolve(commandDir, schema.execution.script);
      if (!fs.existsSync(scriptPath)) {
        failures.push(
          `${relative(schemaPath)}: script not found ${schema.execution.script}`,
        );
      }
    }
  }
  if (schema?.execution?.mode === "agent" && !schema.execution.skill) {
    failures.push(`${relative(schemaPath)}: agent mode missing execution.skill`);
  }

  if (schema?.inputs != null && !Array.isArray(schema.inputs)) {
    failures.push(`${relative(schemaPath)}: inputs must be an array`);
    return;
  }

  for (const [index, input] of (schema.inputs ?? []).entries()) {
    if (!input.name) {
      failures.push(`${relative(schemaPath)}: inputs[${index}] missing name`);
    }
    if (!validInputTypes.has(input.type)) {
      failures.push(
        `${relative(schemaPath)}: inputs[${index}] invalid type ${input.type}`,
      );
    }
    if (!input.label) {
      failures.push(`${relative(schemaPath)}: inputs[${index}] missing label`);
    }
    if (
      (input.type === "select" || input.type === "multiselect") &&
      (!Array.isArray(input.options) || input.options.length === 0)
    ) {
      failures.push(
        `${relative(schemaPath)}: inputs[${index}] ${input.type} missing options`,
      );
    }
    for (const [optionIndex, option] of (input.options ?? []).entries()) {
      if (option.value == null || option.label == null) {
        failures.push(
          `${relative(schemaPath)}: inputs[${index}].options[${optionIndex}] missing value/label`,
        );
      }
    }
  }
}

function validateV3Outputs(schemaPath, outputs) {
  if (!Array.isArray(outputs) || outputs.length === 0) {
    failures.push(`${relative(schemaPath)}: v3 outputs must be a non-empty array`);
    return;
  }

  const seenIds = new Set();
  for (const [index, output] of outputs.entries()) {
    const prefix = `${relative(schemaPath)}: outputs[${index}]`;

    if (!output?.id) {
      failures.push(`${prefix} missing id`);
    } else if (seenIds.has(output.id)) {
      failures.push(`${prefix} duplicate id ${output.id}`);
    } else {
      seenIds.add(output.id);
    }

    if (!validV3OutputTypes.has(output?.type)) {
      failures.push(`${prefix} invalid type ${output?.type}`);
    }
    if (!validV3OutputFormats.has(output?.format)) {
      failures.push(`${prefix} invalid format ${output?.format}`);
    }
    if (!validV3Destinations.has(output?.destination)) {
      failures.push(`${prefix} invalid destination ${output?.destination}`);
    }

    if (
      output?.validation != null &&
      !validValidationModes.has(output.validation)
    ) {
      failures.push(`${prefix} invalid validation ${output.validation}`);
    }

    if (output?.type === "artifact") {
      if (!validArtifactKinds.has(output.artifactKind)) {
        failures.push(`${prefix} invalid artifactKind ${output.artifactKind}`);
      }
      if (!output.path) {
        failures.push(`${prefix} artifact output missing path`);
      }
    } else if (output?.artifactKind != null) {
      failures.push(`${prefix} artifactKind is only valid for artifact outputs`);
    }

    if (output?.type === "program-records") {
      if (!validProgramRecordTypes.has(output.recordType)) {
        failures.push(`${prefix} invalid recordType ${output.recordType}`);
      }
      if (!output.path) {
        failures.push(`${prefix} program-records output missing path`);
      }
    } else if (output?.recordType != null) {
      failures.push(`${prefix} recordType is only valid for program-records outputs`);
    }

    if (
      ["findings", "metrics"].includes(output?.type) &&
      !output.path
    ) {
      failures.push(`${prefix} ${output.type} output missing path`);
    }
  }
}

function relative(targetPath) {
  return path.relative(repoRoot, targetPath);
}
