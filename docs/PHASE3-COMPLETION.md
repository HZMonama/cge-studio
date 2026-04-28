# Phase 3: Frontend Updates for v2 Schema Format

## Goal

Update the frontend (apps/web) to work with the new simplified runner API that returns v2 schema format from CLI.

## Changes Made

### 1. Updated Type Definitions (`lib/plugins.ts`)

**New Types Added:**
- `InputFieldType` - Type for input fields from schema.yaml
- `InputField` - Input field definition matching schema.yaml structure
- `InputFieldOption` - Options for select/multiselect fields
- `OutputSchema` - Output specification from schema.yaml
- `ExecutionConfig` - Execution mode configuration
- `UiConfig` - UI hints for rendering
- `DocumentationConfig` - Documentation metadata

**Updated Interfaces:**
- `Command` now includes:
  - `documentation?: DocumentationConfig`
  - `inputs?: InputField[]` (from schema.yaml)
  - `outputs?: OutputSchema`
  - `execution?: ExecutionConfig`
  - `ui?: UiConfig`
  - `runtime?: { executionMode, runnerSupport }` (from runner)
  - Legacy fields kept for backward compatibility

- `Plugin` remains compatible

**Helper Functions Added:**
- `inputsToFormFields()` - Convert v2 inputs to legacy form fields
- `getCommandForm()` - Get form schema (works with v1 and v2)
- `getRunnerSupport()` - Get runner support status
- `getExecutionMode()` - Get execution mode
- `getUiHint()` - Get UI hint/category

### 2. Updated API Client (`lib/runner.ts`)

**Changes:**
- Added `format?: "v2" | "v1"` to `PluginRegistryResponse`
- Added `processV2Commands()` helper function
- Updated `fetchPluginRegistry()` to:
  - Detect v2 format from response
  - Process commands to add runtime info
  - Mark unmigrated commands as "planned"
  - Return backward-compatible structure

**Unmigrated Command Detection:**
Commands without schema.yaml (no `inputs` field) are automatically marked as:
- `runnerSupport: "planned"`
- Shows "planned" badge in UI

### 3. Updated Form Utilities (`lib/command-form.ts`)

**Changes:**
- Import `getCommandForm` from plugins
- Updated `createInitialFormValues()` to use `getCommandForm()`
- Works with both v1 (form fields) and v2 (inputs) formats

### 4. Plugin Panel Compatibility

The existing `plugin-panel.tsx` already shows:
- `ready` commands count (green badge)
- `planned` commands count (pink badge)

This continues to work because:
- v2 commands with schema.yaml → `runnerSupport: "ready"`
- Unmigrated commands → `runnerSupport: "planned"`

## API Format Handling

### V2 Format (from new runner)

```json
{
  "plugins": [{
    "id": "soc2",
    "type": "framework",
    "commands": [{
      "id": "assess",
      "description": "Assess SOC 2 readiness",
      "documentation": { "summary": "...", "readme": "./README.md" },
      "inputs": [...],
      "outputs": { "type": "document", "format": "markdown" },
      "execution": { "mode": "agent", "skill": "soc2-assessor" },
      "ui": { "icon": "shield", "category": "assessment" },
      "runtime": { "executionMode": "agent", "runnerSupport": "ready" }
    }]
  }],
  "format": "v2"
}
```

### V1 Format (legacy, fallback)

```json
{
  "plugins": [{
    "id": "soc2",
    "commands": [{
      "id": "assess",
      "description": "...",
      "form": { "fields": [...] },
      "runnerSupport": "ready"
    }]
  }]
}
```

## Migration Status Display

Commands that haven't been migrated to schema.yaml format will show:
- **Plugin panel**: Pink "planned" badge
- **Ready count**: Excludes unmigrated commands
- **Click behavior**: Can still click (may not have form)

## Backward Compatibility

The changes maintain backward compatibility:
1. If runner returns v1 format → Works as before
2. If runner returns v2 format → Converted to compatible structure
3. If command has legacy `form` field → Used directly
4. If command has v2 `inputs` → Converted to form fields

## Testing

### Test Scenarios

1. **With migrated commands** (soc2/assess, aws-inspector/collect):
   - Shows "ready" badge
   - Form renders from schema.yaml inputs
   - Can submit command

2. **With unmigrated commands**:
   - Shows "planned" badge
   - No form (or minimal form)
   - Can still submit basic command

3. **Fallback mode** (runner unavailable):
   - Uses FALLBACK_PLUGINS (currently empty)
   - Can still use hardcoded forms for critical commands

## Next Steps

### Option 1: Complete Command Migration

Continue migrating all 149 remaining commands to schema.yaml:
1. Create `schema.yaml` with inputs/outputs/execution
2. Move prose to `README.md`
3. Delete old `.md` command file

### Option 2: Form Rendering Update

Update form components to use v2 `inputs` directly:
- Instead of converting to legacy form fields
- Use native v2 structure for better type safety
- Simpler, more direct mapping

### Option 3: Both (Recommended)

1. Migrate high-priority commands first (gap-assessment, collect, assess)
2. Update form rendering to support v2 natively
3. Gradually migrate remaining commands
4. Remove legacy conversion code once all commands migrated

## Success Criteria

- ✅ Frontend types updated for v2 format
- ✅ API client handles v2 format
- ✅ Form utilities work with both formats
- ✅ Unmigrated commands show as "planned"
- ✅ Migrated commands show as "ready"
- ✅ Plugin panel displays correct counts
- ✅ Backward compatibility maintained

## Files Changed

```
apps/web/lib/
├── plugins.ts          [UPDATED: New types and helpers]
├── runner.ts           [UPDATED: V2 format handling]
└── command-form.ts     [UPDATED: Use getCommandForm helper]
```

## Notes

- The simplified runner now starts and serves v2 format
- Only 3 commands are migrated (soc2/assess, aws-inspector/collect, grc-engineer/gap-assessment)
- All other 149 commands show as "planned" until migrated
- Frontend can handle both formats seamlessly
