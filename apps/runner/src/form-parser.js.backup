function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function humanizeId(value) {
  return value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function stripCodeFences(value) {
  return value.replace(/```[\s\S]*?```/g, "").trim();
}

function findHeadingSection(contents, heading) {
  const headingPattern = new RegExp(
    `^##\\s+${escapeRegExp(heading)}\\s*$`,
    "im",
  );
  const match = headingPattern.exec(contents);
  if (!match) {
    return null;
  }

  const startIndex = match.index + match[0].length;
  const rest = contents.slice(startIndex);
  const nextHeadingMatch = /^\s*##\s+/m.exec(rest);
  const endIndex = nextHeadingMatch
    ? startIndex + nextHeadingMatch.index
    : contents.length;

  return contents.slice(startIndex, endIndex).trim();
}

function findBoldLabelSection(contents, label) {
  const labelPattern = new RegExp(
    `^\\*\\*${escapeRegExp(label)}\\*\\*:\\s*$`,
    "im",
  );
  const match = labelPattern.exec(contents);
  if (!match) {
    return null;
  }

  const startIndex = match.index + match[0].length;
  const rest = contents.slice(startIndex);
  const nextMatch = /^\s*(\*\*[A-Za-z ].*?\*\*:|##\s+)/m.exec(rest);
  const endIndex = nextMatch ? startIndex + nextMatch.index : contents.length;

  return contents.slice(startIndex, endIndex).trim();
}

function findSection(contents, name) {
  return (
    findHeadingSection(contents, name) ?? findBoldLabelSection(contents, name)
  );
}

function extractBulletItems(section) {
  if (!section) {
    return [];
  }

  return section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim());
}

function parseParentheticalEnumValues(text) {
  const match = text.match(/\((?:required|optional)\s*:\s*([^)]+)\)/i);
  if (!match) {
    return [];
  }

  return match[1]
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((value) => ({
      label: humanizeId(value),
      value,
    }));
}

function extractInlineEnumValues(text) {
  const values = [];
  const seen = new Set();

  for (const match of text.matchAll(/`([^`]+)`/g)) {
    const raw = match[1].trim();
    if (
      !raw ||
      raw.includes(" ") ||
      raw.startsWith("--") ||
      raw.startsWith("/")
    ) {
      continue;
    }

    const pipeParts = raw
      .split("|")
      .map((part) => part.trim())
      .filter(Boolean);
    const candidateParts = pipeParts.length > 1 ? pipeParts : [raw];

    for (const candidate of candidateParts) {
      if (
        !candidate ||
        candidate.startsWith("<") ||
        candidate.endsWith(">") ||
        seen.has(candidate)
      ) {
        continue;
      }

      seen.add(candidate);
      values.push({
        label: humanizeId(candidate),
        value: candidate,
      });
    }
  }

  return values;
}

function inferFieldType(input) {
  const { name, flag, placeholder, description, booleanFlag, explicitType } =
    input;

  if (explicitType) {
    return explicitType;
  }

  if (booleanFlag) {
    return "boolean";
  }

  const lowerName = name.toLowerCase();
  const lowerFlag = (flag ?? "").toLowerCase();
  const lowerPlaceholder = (placeholder ?? "").toLowerCase();
  const lowerDescription = description.toLowerCase();

  if (
    lowerName.includes("path") ||
    lowerName.includes("dir") ||
    lowerFlag.includes("path") ||
    lowerFlag.includes("dir") ||
    lowerPlaceholder.includes("path") ||
    lowerPlaceholder.includes("dir")
  ) {
    return "path";
  }

  if (
    lowerName.includes("secret") ||
    lowerName.includes("token") ||
    lowerName.includes("apikey") ||
    lowerName.includes("api-key") ||
    lowerName.includes("password") ||
    lowerFlag.includes("token") ||
    lowerFlag.includes("secret") ||
    lowerFlag.includes("password")
  ) {
    return "secret";
  }

  if (
    lowerName.includes("count") ||
    lowerName.includes("limit") ||
    lowerName.includes("concurrency") ||
    lowerPlaceholder === "int" ||
    lowerPlaceholder === "number" ||
    lowerDescription.includes("integer")
  ) {
    return "number";
  }

  if (
    lowerPlaceholder === "csv" ||
    lowerName.endsWith("s") ||
    lowerName.includes("regions") ||
    lowerName.includes("frameworks") ||
    lowerName.includes("sources") ||
    lowerName.includes("services")
  ) {
    return "multiselect";
  }

  if (
    lowerName.includes("output") ||
    lowerName.includes("format") ||
    lowerDescription.includes("choose") ||
    lowerDescription.includes("one of")
  ) {
    return "select";
  }

  return "text";
}

function deriveDefaultValue(type, description) {
  if (type === "boolean") {
    return false;
  }

  const defaultMatch = description.match(/default:\s*`?([^`.,)]+)`?/i);
  if (!defaultMatch) {
    return undefined;
  }

  const raw = defaultMatch[1].trim();

  if (type === "multiselect") {
    return raw.includes(",")
      ? raw
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : [raw];
  }

  if (type === "number") {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return raw;
}

function parsePositionalArgumentItem(item) {
  const angleMatch = item.match(
    /^`?(<([^>]+)>)`?\s*(\((required|optional)\))?\s*:\s*(.+)$/i,
  );

  if (angleMatch) {
    const placeholder = angleMatch[2].trim();
    const requiredLabel = (angleMatch[4] ?? "").toLowerCase();
    const description = normalizeWhitespace(angleMatch[5]);

    const inlineEnumValues = extractInlineEnumValues(description);
    const parentheticalEnumValues = parseParentheticalEnumValues(description);
    const enumValues =
      inlineEnumValues.length > 0 ? inlineEnumValues : parentheticalEnumValues;

    const type = inferFieldType({
      name: placeholder,
      placeholder,
      description,
      booleanFlag: false,
      explicitType: enumValues.length > 0 ? "select" : null,
    });

    return {
      name: sanitizeFieldName(placeholder),
      label: humanizeId(placeholder),
      type,
      required: requiredLabel !== "optional",
      position: "argument",
      description,
      options: enumValues.length > 0 ? enumValues : undefined,
      defaultValue: deriveDefaultValue(type, description),
    };
  }

  const positionalMatch = item.match(
    /^`?(\$([0-9]+))`?\s*-\s*(.+?)(?:\s*\((required|optional)(?::\s*([^)]+))?\))?$/i,
  );
  if (!positionalMatch) {
    return null;
  }

  const rawLabel = positionalMatch[3].trim();
  const requiredLabel = (positionalMatch[4] ?? "").toLowerCase();
  const explicitEnumList = positionalMatch[5] ?? "";
  const description = normalizeWhitespace(rawLabel);

  const name = sanitizeFieldName(rawLabel);
  const inlineEnumValues = extractInlineEnumValues(description);
  const explicitEnumValues = explicitEnumList
    ? explicitEnumList
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((value) => ({
          label: humanizeId(value),
          value,
        }))
    : [];
  const enumValues =
    inlineEnumValues.length > 0 ? inlineEnumValues : explicitEnumValues;

  const type = inferFieldType({
    name,
    placeholder: name,
    description,
    booleanFlag: false,
    explicitType: enumValues.length > 0 ? "select" : null,
  });

  return {
    name,
    label: humanizeId(name),
    type,
    required: requiredLabel === "required",
    position: "argument",
    description,
    options: enumValues.length > 0 ? enumValues : undefined,
    defaultValue: deriveDefaultValue(type, description),
  };
}

function parseOptionItem(item) {
  const match = item.match(
    /^`?(--[a-z0-9-]+)(?:=(<[^>]+>|[A-Z]+))?`?\s*(?:—|-)\s*(.+)$/i,
  );
  if (!match) {
    return null;
  }

  const flag = match[1];
  const rawPlaceholder = match[2] ?? null;
  const description = normalizeWhitespace(match[3]);

  const name = sanitizeFieldName(
    rawPlaceholder
      ? rawPlaceholder.replace(/[<>]/g, "")
      : flag.replace(/^--/, ""),
  );

  const enumValues = extractInlineEnumValues(description);
  const booleanFlag = !rawPlaceholder;

  let explicitType = null;
  if (enumValues.length > 0) {
    explicitType = enumValues.length > 1 ? "select" : null;
  }

  const type = inferFieldType({
    name,
    flag,
    placeholder: rawPlaceholder ? rawPlaceholder.replace(/[<>]/g, "") : null,
    description,
    booleanFlag,
    explicitType,
  });

  return {
    name,
    label: humanizeId(name),
    type,
    required: false,
    flag,
    description,
    options: enumValues.length > 0 ? enumValues : undefined,
    defaultValue: deriveDefaultValue(type, description),
  };
}

function sanitizeFieldName(value) {
  return value
    .trim()
    .replace(/[<>]/g, "")
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
    .replace(/^[A-Z]/, (char) => char.toLowerCase());
}

function parseUsageLine(contents) {
  const usageSection = findSection(contents, "Usage");
  if (!usageSection) {
    return null;
  }

  const firstCodeLineMatch = usageSection.match(/```[\w-]*\n([\s\S]*?)```/);
  if (firstCodeLineMatch) {
    const line = firstCodeLineMatch[1]
      .split("\n")
      .map((item) => item.trim())
      .find(Boolean);

    return line ?? null;
  }

  return (
    usageSection
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.startsWith("/")) ?? null
  );
}

function parseUsageArguments(usageLine) {
  if (!usageLine) {
    return [];
  }

  const angleMatches = [...usageLine.matchAll(/<([^>]+)>/g)].map((match) => ({
    name: sanitizeFieldName(match[1]),
    label: humanizeId(match[1]),
    type: inferFieldType({
      name: match[1],
      placeholder: match[1],
      description: "",
      booleanFlag: false,
      explicitType: null,
    }),
    required: true,
    position: "argument",
  }));

  const positionalMatches = [...usageLine.matchAll(/\$([0-9]+)/g)].map(
    (match) => ({
      name: `arg${match[1]}`,
      label: `Arg ${match[1]}`,
      type: "text",
      required: true,
      position: "argument",
    }),
  );

  return [...angleMatches, ...positionalMatches];
}

function mergeFieldLists(primaryFields, secondaryFields) {
  const byName = new Map();

  for (const field of secondaryFields) {
    byName.set(field.name, { ...field });
  }

  for (const field of primaryFields) {
    const existing = byName.get(field.name);
    byName.set(field.name, existing ? { ...existing, ...field } : { ...field });
  }

  return Array.from(byName.values());
}

function inferSubmitLabel(commandId) {
  return `Run ${humanizeId(commandId)}`;
}

function buildSourceMetadata(args, sections) {
  return {
    kind: "parsed",
    commandId: args.commandId,
    commandPath: args.commandPath,
    sections,
  };
}

export function parseCommandDocToForm(args) {
  const { commandId, commandPath, contents, frontmatter = {} } = args;

  const strippedContents = stripCodeFences(contents);
  const description =
    frontmatter.description ??
    extractDescription(strippedContents) ??
    humanizeId(commandId);

  const argumentsSection = findSection(contents, "Arguments");
  const optionsSection = findSection(contents, "Options");
  const usageLine = parseUsageLine(contents);

  const argumentItems = extractBulletItems(argumentsSection);

  const parsedArgumentFields = argumentItems
    .filter((item) => !item.trim().startsWith("--"))
    .map(parsePositionalArgumentItem)
    .filter(Boolean);

  const parsedOptionFields = [
    ...argumentItems.filter((item) => item.trim().startsWith("--")),
    ...extractBulletItems(optionsSection),
  ]
    .map(parseOptionItem)
    .filter(Boolean);

  const usageArgumentFields = parseUsageArguments(usageLine);

  const fields = mergeFieldLists(
    [...parsedArgumentFields, ...parsedOptionFields],
    usageArgumentFields,
  );

  if (fields.length === 0) {
    return null;
  }

  return normalizeParsedForm({
    mode: "inline",
    title: frontmatter.name ?? humanizeId(commandId),
    description,
    submitLabel: inferSubmitLabel(commandId),
    fields,
    source: buildSourceMetadata(
      { commandId, commandPath },
      {
        usage: Boolean(usageLine),
        arguments: Boolean(argumentsSection),
        options: Boolean(optionsSection),
      },
    ),
  });
}

function extractDescription(contents) {
  const lines = contents
    .replace(/^---\n[\s\S]*?\n---\n?/, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (line.startsWith("#") || line.startsWith("```")) {
      continue;
    }
    return line;
  }

  return null;
}

function normalizeParsedForm(form) {
  return {
    mode: form.mode ?? "inline",
    title: form.title,
    description: form.description,
    submitLabel: form.submitLabel,
    source: form.source ?? { kind: "parsed" },
    fields: form.fields.map(normalizeField).filter(Boolean),
  };
}

function normalizeField(field) {
  if (!field?.name) {
    return null;
  }

  const normalized = {
    name: field.name,
    label: field.label ?? humanizeId(field.name),
    type: field.type ?? "text",
    required: field.required === true,
    description: field.description,
    placeholder: field.placeholder,
    defaultValue: field.defaultValue,
    options:
      Array.isArray(field.options) && field.options.length > 0
        ? field.options.map((option) => ({
            label: option.label ?? humanizeId(option.value),
            value: String(option.value),
          }))
        : undefined,
    flag: field.flag,
    position: field.position,
  };

  if (!normalized.options) {
    delete normalized.options;
  }

  if (normalized.defaultValue === undefined) {
    delete normalized.defaultValue;
  }

  if (!normalized.placeholder) {
    delete normalized.placeholder;
  }

  if (!normalized.description) {
    delete normalized.description;
  }

  if (!normalized.flag) {
    delete normalized.flag;
  }

  if (!normalized.position) {
    delete normalized.position;
  }

  return normalized;
}
