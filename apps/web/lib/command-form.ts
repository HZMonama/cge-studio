import {
  type Command,
  type CommandFormField,
  type CommandFormOption,
  type CommandFormReadinessCondition,
  type CommandFormReadinessRule,
  type CommandFormSchema,
  getCommandForm,
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
  if (!command) {
    return {};
  }
  
  // Phase 3: Use getCommandForm helper to work with both v1 and v2 formats
  const form = getCommandForm(command);
  
  if (!form?.fields?.length) {
    return {};
  }

  return Object.fromEntries(
    form.fields.map((field) => [
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

    const serializedValues = Array.isArray(serialized)
      ? serialized
      : [serialized];

    if (field.position === "argument") {
      argumentTokens.push(
        ...serializedValues.map((serializedValue) =>
          quoteIfNeeded(serializedValue),
        ),
      );
      continue;
    }

    if (field.flag) {
      optionTokens.push(
        ...serializedValues.map(
          (serializedValue) =>
            `${field.flag}=${quoteIfNeeded(serializedValue)}`,
        ),
      );
    }
  }

  return [normalizedPath, ...argumentTokens, ...optionTokens]
    .filter(Boolean)
    .join(" ")
    .trim();
}

export function parsePromptToCommandFormValues(
  commandPath: string,
  schema: CommandFormSchema | null | undefined,
  prompt: string,
): CommandFormValues | null {
  const normalizedPath = commandPath.trim();
  const normalizedPrompt = prompt.trim();

  if (!normalizedPath || !normalizedPrompt.startsWith(normalizedPath)) {
    return null;
  }

  const nextCharacter = normalizedPrompt.charAt(normalizedPath.length);
  if (nextCharacter && !/\s/.test(nextCharacter)) {
    return null;
  }

  // Phase 3: Use schema parameter directly (already converted by caller if needed)
  if (!schema?.fields?.length) {
    return {};
  }

  const tokens = tokenizePrompt(normalizedPrompt.slice(normalizedPath.length).trim());
  if (tokens === null) {
    return null;
  }

  const values = Object.fromEntries(
    schema.fields.map((field) => [field.name, getDefaultFieldValue(field)]),
  ) as CommandFormValues;
  const argumentFields = schema.fields.filter((field) => field.position === "argument");
  const optionFields = schema.fields.filter(
    (field) => field.position !== "argument" && field.flag,
  );
  let argumentIndex = 0;

  for (const token of tokens) {
    if (token.startsWith("--")) {
      const separatorIndex = token.indexOf("=");
      const flag = separatorIndex >= 0 ? token.slice(0, separatorIndex) : token;
      const rawValue = separatorIndex >= 0 ? token.slice(separatorIndex + 1) : null;
      const field = optionFields.find((item) => item.flag === flag);

      if (!field) {
        return null;
      }

      if (field.type === "boolean") {
        if (rawValue !== null) {
          return null;
        }

        values[field.name] = true;
        continue;
      }

      if (rawValue === null) {
        return null;
      }

      const parsedValue = parseFieldToken(field, rawValue);
      if (parsedValue === null) {
        return null;
      }

      values[field.name] = parsedValue;
      continue;
    }

    const field = argumentFields[argumentIndex];
    if (!field) {
      return null;
    }

    const parsedValue = parseFieldToken(field, token);
    if (parsedValue === null) {
      return null;
    }

    values[field.name] = parsedValue;
    argumentIndex += 1;
  }

  return values;
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
): string | string[] | null {
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

  if (field.type === "textarea" && field.repeatable) {
    if (typeof value !== "string") {
      return null;
    }

    const items = value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    return items.length > 0 ? items : null;
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

function parseFieldToken(
  field: CommandFormField,
  rawValue: string,
): CommandFormValue | null {
  if (field.type === "multiselect") {
    return rawValue
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (field.type === "number") {
    return rawValue.trim();
  }

  return rawValue;
}

function tokenizePrompt(prompt: string): string[] | null {
  if (!prompt) {
    return [];
  }

  const tokens: string[] = [];
  let index = 0;

  while (index < prompt.length) {
    while (index < prompt.length && /\s/.test(prompt.charAt(index))) {
      index += 1;
    }

    if (index >= prompt.length) {
      break;
    }

    let token = "";

    while (index < prompt.length && !/\s/.test(prompt.charAt(index))) {
      const character = prompt.charAt(index);

      if (character === "\"" || character === "'") {
        const quoted = readQuotedToken(prompt, index, character);
        if (quoted === null) {
          return null;
        }

        token += quoted.value;
        index = quoted.nextIndex;
        continue;
      }

      token += character;
      index += 1;
    }

    if (!token) {
      return null;
    }

    tokens.push(token);
  }

  return tokens;
}

function readQuotedToken(
  input: string,
  startIndex: number,
  quote: "\"" | "'",
): { value: string; nextIndex: number } | null {
  let index = startIndex + 1;
  let escaped = false;

  while (index < input.length) {
    const character = input.charAt(index);

    if (escaped) {
      escaped = false;
      index += 1;
      continue;
    }

    if (character === "\\") {
      escaped = true;
      index += 1;
      continue;
    }

    if (character === quote) {
      const rawToken = input.slice(startIndex, index + 1);
      const decoded = decodeQuotedToken(rawToken);
      return decoded === null
        ? null
        : {
            value: decoded,
            nextIndex: index + 1,
          };
    }

    index += 1;
  }

  return null;
}

function decodeQuotedToken(token: string): string | null {
  if (token.startsWith("\"") && token.endsWith("\"")) {
    try {
      return JSON.parse(token) as string;
    } catch {
      return null;
    }
  }

  if (token.startsWith("'") && token.endsWith("'")) {
    return token
      .slice(1, -1)
      .replace(/\\'/g, "'")
      .replace(/\\\\/g, "\\");
  }

  return token;
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
  const forbidAllSatisfied = (rule.forbidAll ?? []).every(
    (fieldName) => !hasMeaningfulValue(values[fieldName]),
  );

  if (!forbidAllSatisfied) {
    return false;
  }

  const forbidOneOf = rule.forbidOneOf ?? [];
  if (
    forbidOneOf.length > 0 &&
    forbidOneOf.every((fieldName) => hasMeaningfulValue(values[fieldName]))
  ) {
    return false;
  }

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
