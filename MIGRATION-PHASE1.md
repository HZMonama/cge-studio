# Phase 1 Migration Summary

## Completed Work

### New Schema Format Established

Created new directory-based command structure with explicit schema definitions:

```
plugins/{plugin}/commands/{command}/
├── schema.yaml    # Explicit inputs, outputs, execution config
└── README.md      # Prose documentation
```

### Example Commands Migrated (3 of 152)

1. **soc2/assess** - Framework assessment (agent mode)
   - `plugins/frameworks/soc2/commands/assess/schema.yaml`
   - `plugins/frameworks/soc2/commands/assess/README.md`

2. **aws-inspector/collect** - Connector data collection (script mode)
   - `plugins/connectors/aws-inspector/commands/collect/schema.yaml`
   - `plugins/connectors/aws-inspector/commands/collect/README.md`

3. **grc-engineer/gap-assessment** - Multi-framework analysis (script mode)
   - `plugins/grc-engineer/commands/gap-assessment/schema.yaml`
   - `plugins/grc-engineer/commands/gap-assessment/README.md`

### Documentation Created

- `docs/COMMAND-SCHEMA-v2.md` - Complete schema format specification

## Schema Format Highlights

### Explicit Input Definition
```yaml
inputs:
  - name: scope
    type: select
    label: Assessment Scope
    required: true
    options:
      - value: security
        label: Security (CC)
```

### Output Contract
```yaml
outputs:
  type: document
  format: markdown
  schema:
    title:
      type: string
      required: true
    readinessScore:
      type: number
      required: true
      range: [0, 100]
```

### Execution Configuration
```yaml
execution:
  mode: agent        # script | workflow | agent
  skill: soc2-assessor
```

## Remaining Commands to Migrate (149)

### Persona Plugins (4 plugins, ~20 commands)
- [ ] grc-engineer (16 commands)
- [ ] grc-auditor (3 commands)
- [ ] grc-internal (3 commands)
- [ ] grc-tprm (3 commands)

### Framework Plugins (21 plugins, ~110 commands)
- [ ] cis-controls (5 commands)
- [ ] cmmc (5 commands)
- [ ] csa-ccm (5 commands)
- [ ] dora (5 commands)
- [ ] essential8 (5 commands)
- [ ] fedramp-20x (4 commands)
- [ ] fedramp-rev5 (4 commands)
- [ ] gdpr (5 commands)
- [ ] glba (5 commands)
- [ ] hitrust (5 commands)
- [ ] irap (4 commands)
- [ ] ismap (4 commands)
- [ ] iso27001 (7 commands)
- [ ] nist-800-53 (7 commands)
- [ ] nydfs (5 commands)
- [ ] pbmm (4 commands)
- [ ] pci-dss (5 commands)
- [ ] singapore-pdpa (3 commands)
- [ ] soc2 (7 commands)
- [ ] stateramp (5 commands)
- [ ] us-export (6 commands)

### Connector Plugins (4 plugins, 12 commands)
- [ ] aws-inspector (setup, status - 2 remaining)
- [ ] gcp-inspector (3 commands)
- [ ] github-inspector (3 commands)
- [ ] okta-inspector (3 commands)

### Tool Plugins (3 plugins, 7 commands)
- [ ] oscal (3 commands)
- [ ] fedramp-ssp (2 commands)
- [ ] grc-reporter (4 commands)

## Migration Pattern

For each command, follow this process:

1. **Create directory**:
   ```bash
   mkdir -p plugins/{plugin}/commands/{command}
   ```

2. **Create schema.yaml**:
   - Extract inputs from Arguments/Options sections
   - Define outputs based on command description
   - Set execution mode (agent for frameworks, script for connectors/personas)

3. **Create README.md**:
   - Copy prose documentation from old .md file
   - Remove frontmatter and Arguments/Options sections
   - Keep examples, explanations, tables

4. **Remove old file**:
   ```bash
   rm plugins/{plugin}/commands/{command}.md
   ```

## Key Decisions Made

1. **No presets/overlays** - CLI is single source of truth
2. **Mixed schema strictness** - Required fields validated strictly, optional fields are guidance
3. **YAML format** - Human-readable, standard
4. **Separate files** - schema.yaml for structure, README.md for prose
5. **Git versioning** - No version fields in schema
6. **Output schemas deferred** - Add to skills later, not in Phase 1

## Next Steps

### Option 1: Continue Manual Migration
- Migrate remaining 149 commands manually
- Estimated: 2-3 days of work

### Option 2: Automated Migration
- Create script to parse existing .md files
- Auto-generate schema.yaml from frontmatter + Arguments/Options
- Manual review and cleanup
- Estimated: 1 day to build script + 1 day review

### Option 3: Hybrid
- Auto-migrate simple commands
- Manually handle complex commands (gap-assessment, collect, etc.)

## Files Changed

```
cli/claude-grc-engineering/
├── docs/
│   └── COMMAND-SCHEMA-v2.md                    [NEW]
├── plugins/
│   ├── frameworks/soc2/
│   │   └── commands/
│   │       └── assess/
│   │           ├── schema.yaml                 [NEW]
│   │           └── README.md                   [NEW]
│   ├── connectors/aws-inspector/
│   │   └── commands/
│   │       └── collect/
│   │           ├── schema.yaml                 [NEW]
│   │           └── README.md                   [NEW]
│   └── grc-engineer/
│       └── commands/
│           └── gap-assessment/
│               ├── schema.yaml                 [NEW]
│               └── README.md                   [NEW]
```

## Verification

To verify a migrated command:

1. Check schema.yaml parses as valid YAML
2. Verify all required fields are present
3. Ensure README.md has no schema-like content
4. Test via runner (once runner updated for new format)

## Questions?

- Should we proceed with manual or automated migration?
- Priority order for remaining commands?
- Any schema adjustments needed based on these examples?
