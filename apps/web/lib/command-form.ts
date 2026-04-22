import {
  type Command,
  type CommandFormField,
  type CommandFormOption,
  type CommandFormReadinessCondition,
  type CommandFormReadinessRule,
  type CommandFormSchema,
} from "@/lib/plugins";

export type CommandFormValue =
  | string
  | number
  | boolean
  | string[]
  | null
  | undefined;

export type CommandFormValues = Record<string, CommandFormValue>;

export interface BuildPromptOptions {
  redactSecrets?: boolean;
}

export function createInitialFormValues(
  command: Command | null | undefined,
): CommandFormValues {
  if (!command?.form?.fields?.length) {
    return {};
  }

  return Object.fromEntries(
    command.form.fields.map((field) => [
      field.name,
      getDefaultFieldValue(field),
    ]),
  );
}

export function buildPromptFromCommandForm(
  commandPath: string,
  schema: CommandFormSchema | null | undefined,
  values: CommandFormValues,
  options?: BuildPromptOptions,
): string {
  const normalizedPath = commandPath.trim();

  if (!schema?.fields?.length) {
    return normalizedPath;
  }

  const argumentTokens: string[] = [];
  const optionTokens: string[] = [];

  for (const field of schema.fields) {
    const value = values[field.name];

    if (field.type === "boolean") {
      if (value === true && field.flag) {
        optionTokens.push(field.flag);
      }
      continue;
    }

    const serialized = serializeFieldValue(field, value, options);
    if (!serialized) {
      continue;
    }

    if (field.position === "argument") {
      argumentTokens.push(quoteIfNeeded(serialized));
      continue;
    }

    if (field.flag) {
      optionTokens.push(`${field.flag}=${quoteIfNeeded(serialized)}`);
    }
  }

  return [normalizedPath, ...argumentTokens, ...optionTokens]
    .filter(Boolean)
    .join(" ")
    .trim();
}

export function isCommandFormValid(
  schema: CommandFormSchema | null | undefined,
  values: CommandFormValues,
): boolean {
  if (!schema?.fields?.length) {
    return true;
  }

  const minimumConfiguration =
    Array.isArray(schema.minimumConfiguration) &&
    schema.minimumConfiguration.length > 0
      ? new Set(schema.minimumConfiguration)
      : null;

  const baseValid = schema.fields.every((field) => {
    const isRequired =
      minimumConfiguration?.has(field.name) ?? Boolean(field.required);

    if (!isRequired) {
      return true;
    }

    const value = values[field.name];

    if (field.type === "boolean") {
      return typeof value === "boolean";
    }

    if (Array.isArray(value)) {
      return value.length > 0;
    }

    if (field.type === "number") {
      return typeof value === "number"
        ? Number.isFinite(value)
        : typeof value === "string" && value.trim().length > 0;
    }

    return typeof value === "string" && value.trim().length > 0;
  });

  if (!baseValid) {
    return false;
  }

  return getActiveReadinessRules(schema, values).every((rule) =>
    isReadinessRuleSatisfied(rule, values),
  );
}

export function getCommandFormOptions(
  field: CommandFormField,
): CommandFormOption[] {
  return Array.isArray(field.options) ? field.options : [];
}

function getDefaultFieldValue(field: CommandFormField): CommandFormValue {
  if (field.defaultValue !== undefined) {
    if (field.type === "multiselect") {
      return Array.isArray(field.defaultValue)
        ? field.defaultValue.map((item) => String(item))
        : typeof field.defaultValue === "string" &&
            field.defaultValue.length > 0
          ? [field.defaultValue]
          : [];
    }

    if (field.type === "boolean") {
      return Boolean(field.defaultValue);
    }

    if (field.type === "number") {
      return typeof field.defaultValue === "number"
        ? field.defaultValue
        : typeof field.defaultValue === "string" &&
            field.defaultValue.trim().length > 0
          ? field.defaultValue
          : "";
    }

    if (typeof field.defaultValue === "string") {
      return field.defaultValue;
    }
  }

  if (field.type === "multiselect") {
    return [];
  }

  if (field.type === "boolean") {
    return false;
  }

  if (field.type === "number") {
    return "";
  }

  return "";
}

function serializeFieldValue(
  field: CommandFormField,
  value: CommandFormValue,
  options?: BuildPromptOptions,
): string | null {
  if (field.type === "secret" && options?.redactSecrets) {
    if (typeof value !== "string") {
      return null;
    }

    return value.trim().length > 0 ? "[REDACTED]" : null;
  }

  if (field.type === "multiselect") {
    if (!Array.isArray(value) || value.length === 0) {
      return null;
    }

    const items = value.map((item) => String(item).trim()).filter(Boolean);

    return items.length > 0 ? items.join(",") : null;
  }

  if (field.type === "number") {
    if (typeof value === "number") {
      return Number.isFinite(value) ? String(value) : null;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }

    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function quoteIfNeeded(value: string): string {
  return /\s/.test(value) ? JSON.stringify(value) : value;
}

function getActiveReadinessRules(
  schema: CommandFormSchema,
  values: CommandFormValues,
): CommandFormReadinessRule[] {
  return Array.isArray(schema.readinessRules)
    ? schema.readinessRules.filter((rule) =>
        isReadinessConditionSatisfied(rule.when, values),
      )
    : [];
}

function isReadinessConditionSatisfied(
  condition: CommandFormReadinessCondition,
  values: CommandFormValues,
): boolean {
  const value = values[condition.field];

  if (condition.hasValue !== undefined) {
    return condition.hasValue ? hasMeaningfulValue(value) : !hasMeaningfulValue(value);
  }

  if (condition.equals !== undefined) {
    return value === condition.equals;
  }

  if (Array.isArray(condition.in) && condition.in.length > 0) {
    return condition.in.includes(value as string | number | boolean);
  }

  return false;
}

function isReadinessRuleSatisfied(
  rule: CommandFormReadinessRule,
  values: CommandFormValues,
): boolean {
  const requireAllSatisfied = (rule.requireAll ?? []).every((fieldName) =>
    hasMeaningfulValue(values[fieldName]),
  );

  if (!requireAllSatisfied) {
    return false;
  }

  const requireOneOf = rule.requireOneOf ?? [];
  if (requireOneOf.length === 0) {
    return true;
  }

  return requireOneOf.some((fieldName) => hasMeaningfulValue(values[fieldName]));
}

function hasMeaningfulValue(value: CommandFormValue): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (typeof value === "boolean") {
    return value;
  }

  return false;
}
