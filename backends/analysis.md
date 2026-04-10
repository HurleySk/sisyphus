---
name: analysis
description: Built-in backend for gathering data from local files using file reads, searches, and agent synthesis
---

# Analysis Backend

The analysis backend gathers data from local files. It is always available — no external dependencies.

## Gather Spec

```json
{
  "type": "analysis",
  "source": "dataverse-schema/_index.json",
  "instruction": "Extract all entities with alm_ prefix, return as array of {logicalName, entitySetName, primaryId}"
}
```

**Fields:**
- `source`: File path or glob pattern (e.g., `work-repo/pipeline/*.json`, `db-export/dev/procedure/p_*.sql`)
- `instruction`: What to extract or analyze from the source files

## Execution

1. **Resolve source path**: Use Glob if the source contains wildcards, Read if it's a specific file
2. **Single file**: Read the file, apply the instruction, return structured data
3. **Multiple files** (glob match): Read each file, apply the instruction per-file, aggregate results
4. **Large files**: For files over ~500 lines, dispatch an Explore agent to extract the relevant portions rather than reading the entire file into context

## Template Variables

Source paths can contain template variables when used inside `foreach` sections:
- `"source": "dataverse-schema/dev/{entity}.json"` — resolved per iteration

## Return Format

The gather result is a structured object that other parts of the loop can reference:

```json
{
  "type": "analysis",
  "source": "dataverse-schema/_index.json",
  "itemCount": 47,
  "data": [
    { "logicalName": "alm_meeting", "entitySetName": "alm_meetings", "primaryId": "alm_meetingid" },
    ...
  ]
}
```

The `data` field shape depends on the instruction. The producer and evaluator receive this alongside the section spec.

## Multi-File Synthesis

When the instruction requires understanding across multiple files (e.g., "compare staging table columns to DV entity attributes"), dispatch an agent with all relevant file contents and the instruction. The agent returns the synthesized result.

Keep agent prompts focused: tell it exactly what to compare and what format to return. Don't ask for analysis or recommendations — just data extraction.
