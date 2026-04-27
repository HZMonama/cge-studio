import fs from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";

/**
 * Read command schema from schema.yaml file
 * @param {string} toolkitPath - Path to CLI toolkit
 * @param {string} pluginId - Plugin ID (e.g., 'soc2')
 * @param {string} commandId - Command ID (e.g., 'assess')
 * @returns {Promise<Object|null>} Parsed schema or null if not found
 */
export async function readCommandSchema(toolkitPath, pluginId, commandId) {
  const schemaPath = path.join(
    toolkitPath,
    "plugins",
    pluginId,
    "commands",
    commandId,
    "schema.yaml"
  );

  try {
    const content = await fs.readFile(schemaPath, "utf8");
    const schema = yaml.load(content);
    
    // Validate required sections
    if (!schema.meta || !schema.execution) {
      console.warn(`[schema-reader] Invalid schema for ${pluginId}/${commandId}: missing meta or execution`);
      return null;
    }
    
    return schema;
  } catch (error) {
    if (error.code === "ENOENT") {
      // Schema.yaml doesn't exist yet (command not migrated)
      return null;
    }
    console.error(`[schema-reader] Error reading ${schemaPath}:`, error.message);
    return null;
  }
}

/**
 * Read README.md for a command
 * @param {string} toolkitPath - Path to CLI toolkit
 * @param {string} pluginId - Plugin ID
 * @param {string} commandId - Command ID
 * @returns {Promise<string|null>} README content or null
 */
export async function readCommandReadme(toolkitPath, pluginId, commandId) {
  const readmePath = path.join(
    toolkitPath,
    "plugins",
    pluginId,
    "commands",
    commandId,
    "README.md"
  );

  try {
    return await fs.readFile(readmePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    return null;
  }
}

/**
 * Discover all plugins and their commands with schemas
 * @param {string} toolkitPath - Path to CLI toolkit
 * @returns {Promise<Array>} Array of plugin objects with commands
 */
export async function discoverCommandsWithSchemas(toolkitPath) {
  const pluginsRoot = path.join(toolkitPath, "plugins");
  
  try {
    await fs.access(pluginsRoot);
  } catch {
    return [];
  }

  const plugins = [];
  const pluginDirs = await findPluginDirectories(pluginsRoot);

  for (const pluginDir of pluginDirs) {
    // Use relative path from plugins root as pluginId to handle nested plugins (e.g., frameworks/soc2)
    const pluginId = path.relative(pluginsRoot, pluginDir);
    const commandsDir = path.join(pluginDir, "commands");
    
    try {
      await fs.access(commandsDir);
    } catch {
      continue;
    }

    const commands = await discoverCommandsInPlugin(toolkitPath, pluginId, commandsDir);
    
    if (commands.length > 0) {
      const metadata = inferPluginMetadata(pluginDir, pluginId);
      const baseId = path.basename(pluginId);
      
      plugins.push({
        id: baseId,
        label: humanizeId(baseId),
        ...metadata,
        commands: commands.sort((a, b) => a.id.localeCompare(b.id)),
      });
    }
  }

  return plugins.sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Parse frontmatter from markdown content
 * Simple parser that extracts YAML frontmatter between --- markers
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};
  
  const frontmatter = {};
  const lines = match[1].split('\n');
  
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();
      // Remove quotes if present
      frontmatter[key] = value.replace(/^["'](.*)["']$/, '$1');
    }
  }
  
  return frontmatter;
}

/**
 * Extract first paragraph from markdown content
 */
function extractFirstParagraph(content) {
  // Remove frontmatter
  const withoutFrontmatter = content.replace(/^---\s*\n[\s\S]*?\n---\s*/, '');
  // Find first non-empty line that's not a heading
  const lines = withoutFrontmatter.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('-') && !trimmed.startsWith('*')) {
      return trimmed;
    }
  }
  return null;
}

/**
 * Discover commands within a plugin directory
 * Includes both migrated commands (with schema.yaml) and planned commands (.md files)
 */
async function discoverCommandsInPlugin(toolkitPath, pluginId, commandsDir) {
  const commands = [];
  const discoveredCommandIds = new Set();
  
  try {
    const entries = await fs.readdir(commandsDir, { withFileTypes: true });
    
    // First pass: discover migrated commands (directories with schema.yaml)
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      
      const commandId = entry.name;
      const schema = await readCommandSchema(toolkitPath, pluginId, commandId);

      if (schema) {
        // Validate schema structure before using
        const isValid = validateSchema(schema, pluginId, commandId);

        if (isValid) {
          discoveredCommandIds.add(commandId);

          // Determine execution mode/runtime support
          const runtime = resolveCommandRuntime(schema);

          commands.push({
            id: commandId,
            description: schema.meta?.description || humanizeId(commandId),
            documentation: schema.documentation || {},
            inputs: schema.inputs || [],
            outputs: schema.outputs || {},
            execution: schema.execution || {},
            ui: schema.ui || {},
            runtime,
          });
        } else {
          // Schema exists but is invalid - treat as planned
          console.warn(`[schema-reader] ${pluginId}/${commandId}: Invalid schema, treating as planned`);
          discoveredCommandIds.add(commandId);
          commands.push({
            id: commandId,
            description: schema.meta?.description || humanizeId(commandId),
            documentation: {},
            inputs: [],
            outputs: {},
            execution: {},
            ui: {},
            runtime: {
              executionMode: "agent",
              intendedExecutionMode: "agent",
              runnerSupport: "planned",
            },
          });
        }
      }
    }
    
    // Second pass: discover planned commands (.md files without schema directories)
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) {
        continue;
      }
      
      const commandId = entry.name.replace(/\.md$/, '');
      
      // Skip if already discovered as a migrated command
      if (discoveredCommandIds.has(commandId)) {
        continue;
      }
      
      // Read the .md file to get description from frontmatter
      const mdPath = path.join(commandsDir, entry.name);
      let description = humanizeId(commandId);
      
      try {
        const content = await fs.readFile(mdPath, 'utf8');
        const frontmatter = parseFrontmatter(content);
        description = frontmatter.description || extractFirstParagraph(content) || humanizeId(commandId);
      } catch (error) {
        // Use default description if file can't be read
      }
      
      // Add as planned command
      commands.push({
        id: commandId,
        description,
        documentation: {},
        inputs: [],
        outputs: {},
        execution: {},
        ui: {},
        runtime: {
          executionMode: "agent",
          intendedExecutionMode: "agent",
          runnerSupport: "planned",
        },
      });
    }
  } catch (error) {
    console.error(`[schema-reader] Error discovering commands in ${commandsDir}:`, error.message);
  }
  
  return commands;
}

/**
 * Validate schema.yaml structure
 * Logs validation errors but returns boolean to indicate if schema is usable
 * @param {Object} schema - Parsed schema object
 * @param {string} pluginId - Plugin ID for logging
 * @param {string} commandId - Command ID for logging
 * @returns {boolean} - True if schema is valid and usable, false otherwise
 */
function validateSchema(schema, pluginId, commandId) {
  const errors = [];
  const context = `${pluginId}/${commandId}`;

  // Required: meta section
  if (!schema.meta) {
    errors.push(`Missing required section: meta`);
  } else {
    if (!schema.meta.id) errors.push(`meta.id is required`);
    if (!schema.meta.plugin) errors.push(`meta.plugin is required`);
    if (!schema.meta.description) errors.push(`meta.description is recommended`);
  }

  // Required: execution section
  if (!schema.execution) {
    errors.push(`Missing required section: execution`);
  } else {
    if (!schema.execution.mode) errors.push(`execution.mode is required (script|agent)`);
    const validModes = ["script", "agent"];
    if (schema.execution.mode && !validModes.includes(schema.execution.mode)) {
      errors.push(`execution.mode must be one of: ${validModes.join(", ")}`);
    }
  }

  // Optional: validate inputs if present
  if (schema.inputs) {
    if (!Array.isArray(schema.inputs)) {
      errors.push(`inputs must be an array`);
    } else {
      schema.inputs.forEach((input, index) => {
        if (!input.name) errors.push(`inputs[${index}].name is required`);
        if (!input.type) errors.push(`inputs[${index}].type is required`);
        const validTypes = ["text", "select", "boolean", "number", "multiselect", "path", "textarea", "json"];
        if (input.type && !validTypes.includes(input.type)) {
          errors.push(`inputs[${index}].type must be one of: ${validTypes.join(", ")}`);
        }
        if (input.type === "select" && !input.options) {
          errors.push(`inputs[${index}].options is required for select type`);
        }
      });
    }
  }

  // Optional: validate outputs if present
  if (schema.outputs) {
    if (!schema.outputs.type) {
      errors.push(`outputs.type is recommended (findings|status|document|artifact)`);
    }
  }

  // Optional: validate ui if present
  if (schema.ui) {
    if (!schema.ui.icon) {
      console.warn(`[schema-reader] ${context}: ui.icon is recommended`);
    }
    if (!schema.ui.category) {
      console.warn(`[schema-reader] ${context}: ui.category is recommended`);
    }
  }

  // Log errors but don't fail - schema is still usable for discovery
  if (errors.length > 0) {
    console.warn(`[schema-reader] Validation warnings for ${context}:`);
    errors.forEach(err => console.warn(`  - ${err}`));
    // Return true if only warnings, false if critical errors
    const criticalErrors = errors.filter(e => 
      e.includes("Missing required") || 
      e.includes("must be one of")
    );
    if (criticalErrors.length > 0) {
      console.error(`[schema-reader] ${context} has critical errors, marking as planned`);
      return false;
    }
  }

  return true;
}

/**
 * Find all plugin directories recursively
 */
async function findPluginDirectories(rootPath) {
  const directories = [];

  async function walk(currentPath) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    
    // If this directory has a 'commands' subdirectory, it's a plugin
    if (entries.some((entry) => entry.isDirectory() && entry.name === "commands")) {
      directories.push(currentPath);
      return;
    }

    // Otherwise, recurse into subdirectories
    await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => walk(path.join(currentPath, entry.name)))
    );
  }

  await walk(rootPath);
  return directories;
}

/**
 * Infer plugin metadata from directory path
 */
function inferPluginMetadata(pluginDir, pluginId) {
  const allPersonas = ["engineer", "auditor", "internal", "tprm"];
  const relativePath = pluginDir;

  if (relativePath.includes("connectors")) {
    return { type: "connector", category: "connector", personas: ["engineer"] };
  }

  if (relativePath.includes("frameworks")) {
    return { type: "framework", category: "framework", personas: allPersonas };
  }

  if (pluginId === "grc-engineer") {
    return { type: "hub", category: "persona", personas: ["engineer"] };
  }

  if (pluginId === "grc-auditor") {
    return { type: "hub", category: "persona", personas: ["auditor"] };
  }

  if (pluginId === "grc-internal") {
    return { type: "hub", category: "persona", personas: ["internal"] };
  }

  if (pluginId === "grc-tprm") {
    return { type: "hub", category: "persona", personas: ["tprm"] };
  }

  if (pluginId === "grc-reporter") {
    return { type: "tool", category: "reporting", personas: allPersonas };
  }

  if (pluginId === "oscal" || pluginId === "fedramp-ssp") {
    return { type: "tool", category: "conversion", personas: allPersonas };
  }

  return { type: "tool", category: "tool", personas: allPersonas };
}

/**
 * Resolve command runtime information
 */
function resolveCommandRuntime(schema) {
  const mode = schema.execution?.mode || "agent";
  
  switch (mode) {
    case "script":
      return {
        executionMode: "script",
        intendedExecutionMode: "script",
        runnerSupport: schema.execution?.script ? "ready" : "planned",
      };
    case "workflow":
      return {
        executionMode: "workflow",
        intendedExecutionMode: "workflow",
        runnerSupport: "ready",
      };
    case "agent":
    default:
      return {
        executionMode: "agent",
        intendedExecutionMode: "agent",
        runnerSupport: "ready",
      };
  }
}

/**
 * Validate input values against command schema
 * @param {Object} schema - Command schema
 * @param {Object} values - Input values
 * @returns {Array} Array of validation errors
 */
export function validateCommandInputs(schema, values) {
  const errors = [];
  
  for (const input of schema.inputs || []) {
    const value = values[input.name];
    
    // Check required
    if (input.required && (value === undefined || value === "" || value === null)) {
      errors.push({
        field: input.name,
        error: "required",
        message: `${input.label || input.name} is required`,
      });
      continue;
    }
    
    // Skip validation if value is empty and not required
    if (value === undefined || value === "" || value === null) {
      continue;
    }
    
    // Validate type
    const typeError = validateType(input.type, value, input);
    if (typeError) {
      errors.push({
        field: input.name,
        error: "type",
        message: typeError,
      });
    }
  }
  
  return errors;
}

/**
 * Validate a value against its expected type
 */
function validateType(type, value, input) {
  switch (type) {
    case "text":
    case "textarea":
    case "path":
    case "secret":
      if (typeof value !== "string") {
        return `Expected string, got ${typeof value}`;
      }
      break;
      
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return `Expected number, got ${typeof value}`;
      }
      if (input.range) {
        const [min, max] = input.range;
        if (value < min || value > max) {
          return `Expected value between ${min} and ${max}`;
        }
      }
      break;
      
    case "boolean":
      if (typeof value !== "boolean") {
        return `Expected boolean, got ${typeof value}`;
      }
      break;
      
    case "select":
      if (typeof value !== "string") {
        return `Expected string, got ${typeof value}`;
      }
      if (input.options && !input.options.some(opt => opt.value === value)) {
        return `Invalid option: ${value}`;
      }
      break;
      
    case "multiselect":
      if (!Array.isArray(value)) {
        return `Expected array, got ${typeof value}`;
      }
      if (input.options) {
        const validValues = new Set(input.options.map(opt => opt.value));
        const invalid = value.filter(v => !validValues.has(v));
        if (invalid.length > 0) {
          return `Invalid options: ${invalid.join(", ")}`;
        }
      }
      break;
      
    default:
      return null;
  }
  
  return null;
}

/**
 * Build initial form values from schema defaults
 * @param {Object} schema - Command schema
 * @returns {Object} Initial form values
 */
export function buildInitialFormValues(schema) {
  const values = {};
  
  for (const input of schema.inputs || []) {
    if (input.default !== undefined) {
      values[input.name] = input.default;
    } else {
      // Set appropriate default based on type
      switch (input.type) {
        case "boolean":
          values[input.name] = false;
          break;
        case "multiselect":
          values[input.name] = [];
          break;
        case "number":
          values[input.name] = "";
          break;
        default:
          values[input.name] = "";
      }
    }
  }
  
  return values;
}

/**
 * Convert form values to command argument tokens
 * @param {Object} schema - Command schema
 * @param {Object} values - Form values
 * @returns {Array} Array of argument tokens
 */
export function buildCommandArgs(schema, values) {
  const args = [];
  
  // Add positional arguments first
  for (const input of schema.inputs || []) {
    if (input.position === "argument" && values[input.name] !== undefined && values[input.name] !== "") {
      args.push(String(values[input.name]));
    }
  }
  
  // Add flags
  for (const input of schema.inputs || []) {
    if (input.position === "argument") continue;
    
    const value = values[input.name];
    if (value === undefined || value === "" || value === null) continue;
    
    // Handle different flag formats
    const flag = input.flag || `--${input.name}`;
    
    switch (input.type) {
      case "boolean":
        if (value === true) {
          args.push(flag);
        }
        break;
        
      case "multiselect":
        if (Array.isArray(value) && value.length > 0) {
          args.push(`${flag}=${value.join(",")}`);
        }
        break;
        
      default:
        args.push(`${flag}=${value}`);
    }
  }
  
  return args;
}

/**
 * Humanize an identifier (e.g., 'soc2' -> 'SOC 2')
 */
function humanizeId(value) {
  const OVERRIDES = {
    "aws-inspector": "AWS Inspector",
    "cis-controls": "CIS Controls",
    "cmmc": "CMMC",
    "csa-ccm": "CSA CCM",
    "dora": "DORA",
    "essential8": "Essential Eight",
    "fedramp-20x": "FedRAMP 20x",
    "fedramp-rev5": "FedRAMP Rev 5",
    "fedramp-ssp": "FedRAMP SSP",
    "gcp-inspector": "GCP Inspector",
    "gdpr": "GDPR",
    "github-inspector": "GitHub Inspector",
    "glba": "GLBA",
    "grc-auditor": "GRC Auditor",
    "grc-engineer": "GRC Engineer",
    "grc-internal": "GRC Internal",
    "grc-tprm": "GRC TPRM",
    "hitrust": "HITRUST",
    "irap": "IRAP",
    "ismap": "ISMAP",
    "iso27001": "ISO 27001",
    "nist-800-53": "NIST 800-53",
    "nydfs": "NYDFS",
    "okta-inspector": "Okta Inspector",
    "oscal": "OSCAL",
    "pbmm": "PBMM",
    "pci-dss": "PCI DSS",
    "singapore-pdpa": "Singapore PDPA",
    "soc2": "SOC 2",
    "stateramp": "StateRAMP",
    "us-export": "US Export",
  };
  
  if (OVERRIDES[value]) {
    return OVERRIDES[value];
  }
  
  return value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
