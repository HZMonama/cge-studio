# Phase 2: Simplify Runner Architecture

## Goal

Transform the runner from a form composition layer into a simple coordinator that:
1. Reads explicit schemas from CLI (no inference/composition)
2. Validates inputs against schemas
3. Routes execution to appropriate handler
4. Streams events to frontend

## Architecture Changes

### Before (v1 - Complex)

```
Runner Form Resolution:
1. Parse markdown command docs
2. Infer fields from Arguments/Options sections  ← FRAGILE
3. Apply command-family preset (_presets/*.json) ← COMPLEX
4. Compose reusable groups (_groups/*.json)      ← COMPLEX
5. Apply command-specific overlay (forms/**/*.json) ← MAINTENANCE BURDEN
6. Return composed form schema
```

### After (v2 - Simple)

```
Runner Form Resolution:
1. Read schema.yaml from CLI command directory  ← EXPLICIT
2. Parse YAML into schema object                ← STRAIGHTFORWARD
3. Return schema as-is                          ← PASS-THROUGH
```

## Files To Remove

### Directories (Entirely)
- `apps/runner/forms/_presets/` - Command-family presets
- `apps/runner/forms/_groups/` - Reusable field groups
- `apps/runner/forms/` - All command-specific overlays (keep grc-engineer, connectors, frameworks subdirs for now)

### Code Files
- `apps/runner/src/form-parser.js` - Markdown inference logic
- `apps/runner/src/form-engine.js` - Form composition logic

## Files To Update

### Major Changes
- `apps/runner/src/server.js` - Replace form discovery with schema.yaml reading
- `apps/runner/src/workflow-runner.js` - May need updates for schema validation

### Frontend Updates
- `apps/web/lib/plugins.ts` - Update Plugin/Command types for new schema
- `apps/web/lib/command-form.ts` - Update form value handling

## New Simplified Form Engine

### schema-reader.js (NEW)

```javascript
// Reads schema.yaml files directly from CLI

export async function readCommandSchema(toolkitPath, pluginId, commandId) {
  const schemaPath = path.join(
    toolkitPath, 
    'plugins', 
    pluginId, 
    'commands', 
    commandId, 
    'schema.yaml'
  );
  
  const content = await fs.readFile(schemaPath, 'utf8');
  return yaml.parse(content);
}

export async function discoverCommandsWithSchemas(toolkitPath) {
  // Walk plugins/**/commands/*/
  // Find all schema.yaml files
  // Return array of { plugin, command, schema }
}
```

### Validation Layer

```javascript
// Validate user inputs against CLI schema

export function validateCommandInputs(schema, values) {
  const errors = [];
  
  for (const input of schema.inputs || []) {
    const value = values[input.name];
    
    // Check required
    if (input.required && (value === undefined || value === '')) {
      errors.push({ field: input.name, error: 'required' });
      continue;
    }
    
    // Validate type
    if (value !== undefined) {
      const typeError = validateType(input.type, value, input);
      if (typeError) errors.push({ field: input.name, error: typeError });
    }
  }
  
  return errors;
}
```

## CLI Directory Structure (Source of Truth)

```
cli/claude-grc-engineering/
└── plugins/
    └── {plugin}/
        └── commands/
            └── {command}/
                ├── schema.yaml    # ← Runner reads this
                └── README.md      # ← For reference only
```

## Schema.yaml Format (From CLI)

```yaml
meta:
  id: assess
  plugin: soc2
  description: Assess SOC 2 readiness

documentation:
  summary: Evaluates organizational readiness...
  readme: ./README.md

inputs:
  - name: scope
    type: select
    label: Assessment Scope
    required: true
    options:
      - value: security
        label: Security (CC)
    default: security

outputs:
  type: document
  format: markdown
  schema:
    title:
      type: string
      required: true

execution:
  mode: agent
  skill: soc2-assessor

ui:
  icon: shield
  category: framework-assessment
```

## API Changes

### GET /registry/plugins

**Before:**
```json
{
  "plugins": [
    {
      "id": "soc2",
      "commands": [
        {
          "id": "assess",
          "form": { /* composed form */ }
        }
      ]
    }
  ]
}
```

**After:**
```json
{
  "plugins": [
    {
      "id": "soc2",
      "commands": [
        {
          "id": "assess",
          "meta": { "id": "assess", "plugin": "soc2", ... },
          "documentation": { "summary": "...", ... },
          "inputs": [...],
          "outputs": { "type": "document", ... },
          "execution": { "mode": "agent", ... },
          "ui": { "icon": "shield", ... }
        }
      ]
    }
  ]
}
```

## Migration Strategy

### Step 1: Remove Composition Code
- Delete form-parser.js
- Delete form-engine.js
- Remove forms/ directory contents (backup first)

### Step 2: Create Schema Reader
- Create schema-reader.js
- Implement readCommandSchema()
- Implement discoverCommandsWithSchemas()

### Step 3: Update Server.js
- Replace discoverPlugins() to use schema-reader
- Update /registry/plugins endpoint
- Remove form composition calls

### Step 4: Update Frontend Types
- Update Plugin and Command interfaces
- Update form rendering logic

### Step 5: Test
- Start runner
- Verify /registry/plugins returns new format
- Verify command execution still works

## Fallback Strategy

Since we're breaking compatibility, the old .md files will still exist for now. If needed:
- Old commands can use legacy discovery (markdown parsing)
- New commands use schema.yaml
- Gradual migration until all commands moved

## Success Criteria

- [ ] Runner starts without errors
- [ ] GET /registry/plugins returns schema.yaml content
- [ ] No form composition code remains
- [ ] Frontend can render forms from new schema (may need updates)
- [ ] Command execution routes correctly (script/agent/workflow)

## Breaking Changes

This is intentionally a breaking change:
- Old form composition removed
- API response format changed
- Frontend will need updates to match
- Some commands may not work until migrated

This is acceptable per "it's ok if it breaks the app for now"
