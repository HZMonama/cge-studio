import fs from "node:fs/promises";
import path from "node:path";

import { parseCommandDocToForm } from "./form-parser.js";

const FIELD_TYPE_DEFAULTS = {
  text: "",
  textarea: "",
  select: "",
  multiselect: [],
  boolean: false,
  number: "",
  path: "",
  secret: "",
};

export async function resolveCommandForm({
  commandId,
  commandPath,
  contents,
  formRoot,
  pluginId,
  pluginMetadata,
}) {
  const parsed = parseCommandDocToForm({
    commandId,
    commandPath,
    contents,
  });

  const overlay = await readCommandOverlay(
    formRoot,
    pluginId,
    commandId,
    pluginMetadata,
  );
  const preset = await readPreset(
    formRoot,
    selectPresetName({
      commandId,
      overlay,
      pluginMetadata,
    }),
  );

  const composedGroupNames = [
    ...normalizeArray(preset?.compose),
    ...normalizeArray(overlay?.compose),
  ];

  const groups = await Promise.all(
    composedGroupNames.map((groupName) => readGroup(formRoot, groupName)),
  );

  const baseForm = createBaseForm({
    commandId,
    commandPath,
    parsed,
  });

  const merged = mergeFormSchema(baseForm, preset);
  const withGroups = groups.reduce(mergeFormSchema, merged);
  const finalForm = mergeFormSchema(withGroups, overlay);

  const normalized = normalizeResolvedForm(finalForm);

  return normalized;
}

function createBaseForm({ commandId, commandPath, parsed }) {
  return {
    mode: "inline",
    commandPath,
    submitLabel: `Run ${humanizeId(commandId)}`,
    fields: parsed?.fields ?? [],
    remove: [],
    order: [],
    source: {
      parser: "markdown",
      composedFrom: [],
      ...deepClone(parsed?.source ?? {}),
    },
  };
}

function mergeFormSchema(baseSchema, layer) {
  if (!layer) {
    return baseSchema;
  }

  const merged = {
    ...baseSchema,
    ...copyWithoutSpecialKeys(layer),
    mode: layer.mode ?? baseSchema.mode ?? "inline",
    submitLabel: layer.submitLabel ?? baseSchema.submitLabel,
    fields: mergeFieldLists(baseSchema.fields, layer.fields),
    remove: [
      ...normalizeArray(baseSchema.remove),
      ...normalizeArray(layer.remove),
    ],
    order: resolveOrder(baseSchema.order, layer.order),
    source: mergeSourceMetadata(baseSchema.source, layer.source, layer),
  };

  if (layer.overrides && typeof layer.overrides === "object") {
    merged.fields = applyFieldOverrides(merged.fields, layer.overrides);
  }

  if (merged.remove.length > 0) {
    const removals = new Set(merged.remove);
    merged.fields = merged.fields.filter((field) => !removals.has(field.name));
  }

  if (merged.order.length > 0) {
    merged.fields = orderFields(merged.fields, merged.order);
  }

  return merged;
}

function mergeFieldLists(baseFields, nextFields) {
  const merged = [];
  const indexByName = new Map();

  for (const field of normalizeArray(baseFields)) {
    const copied = deepClone(field);
    indexByName.set(copied.name, merged.length);
    merged.push(copied);
  }

  for (const field of normalizeArray(nextFields)) {
    if (!field || typeof field !== "object" || typeof field.name !== "string") {
      continue;
    }

    const copied = deepClone(field);
    const existingIndex = indexByName.get(copied.name);

    if (existingIndex === undefined) {
      indexByName.set(copied.name, merged.length);
      merged.push(copied);
      continue;
    }

    merged[existingIndex] = {
      ...merged[existingIndex],
      ...copied,
    };
  }

  return merged;
}

function applyFieldOverrides(fields, overrides) {
  return normalizeArray(fields).map((field) => {
    const patch = overrides[field.name];
    if (!patch || typeof patch !== "object") {
      return field;
    }

    return {
      ...field,
      ...deepClone(patch),
    };
  });
}

function orderFields(fields, order) {
  const position = new Map(
    normalizeArray(order).map((name, index) => [name, index]),
  );

  return [...fields].sort((left, right) => {
    const leftOrder = position.has(left.name)
      ? position.get(left.name)
      : Number.MAX_SAFE_INTEGER;
    const rightOrder = position.has(right.name)
      ? position.get(right.name)
      : Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.name.localeCompare(right.name);
  });
}

function resolveOrder(baseOrder, nextOrder) {
  return normalizeArray(nextOrder).length > 0
    ? normalizeArray(nextOrder)
    : normalizeArray(baseOrder);
}

function mergeSourceMetadata(baseSource, nextSource, layer) {
  const composedFrom = [
    ...normalizeArray(baseSource?.composedFrom),
    ...normalizeArray(layer?.compose),
  ];

  return {
    ...deepClone(baseSource ?? {}),
    ...deepClone(nextSource ?? {}),
    composedFrom: Array.from(new Set(composedFrom)),
  };
}

function normalizeResolvedForm(form) {
  const normalizedFields = normalizeArray(form.fields)
    .filter((field) => field && typeof field.name === "string")
    .map((field) => normalizeField(field));

  return {
    mode: form.mode ?? "inline",
    commandPath: form.commandPath ?? null,
    submitLabel: form.submitLabel ?? "Run",
    minimumConfiguration: normalizeArray(form.minimumConfiguration).filter(
      (name) => typeof name === "string" && name.trim().length > 0,
    ),
    readinessRules: normalizeReadinessRules(form.readinessRules),
    fields: normalizedFields,
    source: form.source ?? {
      parser: "markdown",
      composedFrom: [],
    },
  };
}

function normalizeField(field) {
  const type = normalizeFieldType(field.type);
  const normalized = {
    ...field,
    type,
    label: field.label ?? humanizeId(field.name),
    required: Boolean(field.required),
  };

  if (normalized.defaultValue === undefined) {
    normalized.defaultValue = defaultValueForType(type);
  }

  if (type === "multiselect") {
    normalized.defaultValue = Array.isArray(normalized.defaultValue)
      ? normalized.defaultValue.map((item) => String(item))
      : normalized.defaultValue == null || normalized.defaultValue === ""
        ? []
        : [String(normalized.defaultValue)];
  }

  if (type === "boolean") {
    normalized.defaultValue = Boolean(normalized.defaultValue);
  }

  if (type === "select" || type === "multiselect") {
    normalized.options = normalizeOptions(normalized.options);
  }

  return normalized;
}

function normalizeReadinessRules(rules) {
  return normalizeArray(rules)
    .filter((rule) => rule && typeof rule === "object")
    .map((rule) => ({
      when: normalizeReadinessCondition(rule.when),
      requireAll: normalizeArray(rule.requireAll).filter(
        (name) => typeof name === "string" && name.trim().length > 0,
      ),
      requireOneOf: normalizeArray(rule.requireOneOf).filter(
        (name) => typeof name === "string" && name.trim().length > 0,
      ),
    }))
    .filter(
      (rule) =>
        rule.when &&
        typeof rule.when.field === "string" &&
        rule.when.field.trim().length > 0 &&
        (rule.requireAll.length > 0 || rule.requireOneOf.length > 0),
    );
}

function normalizeReadinessCondition(condition) {
  if (!condition || typeof condition !== "object") {
    return null;
  }

  return {
    field:
      typeof condition.field === "string" ? condition.field.trim() : undefined,
    hasValue:
      typeof condition.hasValue === "boolean" ? condition.hasValue : undefined,
    equals:
      typeof condition.equals === "string" ||
      typeof condition.equals === "number" ||
      typeof condition.equals === "boolean"
        ? condition.equals
        : undefined,
    in: normalizeArray(condition.in).filter(
      (value) =>
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean",
    ),
  };
}

function normalizeOptions(options) {
  return normalizeArray(options)
    .filter((option) => option && typeof option === "object")
    .map((option) => ({
      label: option.label ?? String(option.value ?? ""),
      value: String(option.value ?? ""),
    }))
    .filter((option) => option.value.length > 0);
}

function normalizeFieldType(type) {
  if (
    type === "text" ||
    type === "textarea" ||
    type === "select" ||
    type === "multiselect" ||
    type === "boolean" ||
    type === "number" ||
    type === "path" ||
    type === "secret"
  ) {
    return type;
  }

  return "text";
}

function defaultValueForType(type) {
  return FIELD_TYPE_DEFAULTS[type] ?? "";
}

function copyWithoutSpecialKeys(value) {
  const clone = deepClone(value ?? {});
  delete clone.fields;
  delete clone.overrides;
  delete clone.remove;
  delete clone.order;
  delete clone.compose;
  delete clone.extends;
  return clone;
}

function selectPresetName({ commandId, overlay, pluginMetadata }) {
  if (typeof overlay?.extends === "string" && overlay.extends.trim()) {
    return overlay.extends.trim();
  }

  if (pluginMetadata?.type === "connector" && commandId === "collect") {
    return "connector-collect";
  }

  if (pluginMetadata?.type === "connector" && commandId === "setup") {
    return "connector-setup";
  }

  if (pluginMetadata?.type === "connector" && commandId === "status") {
    return "connector-status";
  }

  if (pluginMetadata?.type === "framework" && commandId === "assess") {
    return "framework-assess";
  }

  if (
    pluginMetadata?.type === "framework" &&
    commandId === "evidence-checklist"
  ) {
    return "framework-evidence-checklist";
  }

  if (pluginMetadata?.type === "framework" && commandId === "map-framework") {
    return "framework-map-framework";
  }

  if (
    pluginMetadata?.type === "framework" &&
    (commandId === "baseline-select" || commandId === "select-baseline")
  ) {
    return "framework-baseline-select";
  }

  return null;
}

async function readCommandOverlay(
  formRoot,
  pluginId,
  commandId,
  pluginMetadata,
) {
  const categoryDirectories = Array.from(
    new Set(
      [pluginMetadata?.category, pluginMetadata?.type]
        .filter((value) => typeof value === "string" && value.trim().length > 0)
        .flatMap((value) => [value, pluralizeDirectoryName(value)]),
    ),
  );

  const candidatePaths = [
    path.join(formRoot, pluginId, `${commandId}.json`),
    path.join(formRoot, pluginId, `${commandId}.form.json`),
    ...categoryDirectories.flatMap((directory) => [
      path.join(formRoot, directory, pluginId, `${commandId}.json`),
      path.join(formRoot, directory, pluginId, `${commandId}.form.json`),
    ]),
  ];

  for (const candidatePath of candidatePaths) {
    const data = await readJsonIfExists(candidatePath);
    if (data) {
      return data;
    }
  }

  return null;
}

function pluralizeDirectoryName(value) {
  if (value === "connector") {
    return "connectors";
  }

  if (value === "framework") {
    return "frameworks";
  }

  return value;
}

async function readPreset(formRoot, presetName) {
  if (!presetName) {
    return null;
  }

  const presetPath = path.join(formRoot, "_presets", `${presetName}.json`);
  return readJsonIfExists(presetPath);
}

async function readGroup(formRoot, groupName) {
  const groupPath = path.join(formRoot, "_groups", `${groupName}.json`);
  const group = await readJsonIfExists(groupPath);

  if (!group) {
    return {
      fields: [],
      source: {
        missingGroup: groupName,
      },
    };
  }

  return group;
}

async function readJsonIfExists(filePath) {
  try {
    const contents = await fs.readFile(filePath, "utf8");
    return JSON.parse(contents);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return null;
    }

    throw error;
  }
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function deepClone(value) {
  if (value === undefined) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value));
}

function humanizeId(value) {
  return String(value ?? "")
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
