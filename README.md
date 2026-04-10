# Sisyphus

Spec-driven artifact engine with adversarial evaluation. Define what you want, how to get the data, and how to know it's right. Sisyphus pushes the boulder until it stays at the top.

## How It Works

```
npx sisyphus run specs/my-spec.json
```

1. **Stack** -- Gather data from files, globs, and agent-extracted summaries
2. **Start** -- Spawn a fresh Claude instance (Sisyphus) to produce content from the data
3. **Descend** -- Run structural checks in code, then spawn an adversarial evaluator (Hades) to judge custom criteria
4. **Climb** -- If anything fails, format specific feedback and send Sisyphus back up the hill

The loop continues until all criteria pass or max retries are exhausted.

## Architecture

Three layers, four agents, strict isolation:

```
+-----------------------------------+
|  Domain Layer                     |  "documentation" -> markdown checks, assembler
|  (extensible to codegen, etc.)    |
+-----------------------------------+
|  Core Engine                      |  spec parser, stack pipeline, spawn,
|  (domain-agnostic)                |  produce/descend loop, climb, reporting
+-----------------------------------+
```

| Agent | Role | Isolation |
|-------|------|-----------|
| **Zeus** | Conversational architect (T1) | Sees user, not the loop |
| **Thanatos** | Orchestrator (T2, the engine) | Dispatches, never produces |
| **Sisyphus** | Producer (T3) | Sees data + feedback, never criteria |
| **Hades** | Evaluator (T3) | Sees output + criteria, never the goal |

## Spec Format

A spec defines **boulders** (units of work) with **stack sources** (data) and **criteria** (acceptance):

```json
{
  "title": "Entity Migration Status",
  "layer": "documentation",
  "output": "output/reports/status.md",
  "maxRetries": 3,
  "boulders": [
    {
      "name": "Entity Inventory",
      "description": "Complete list of entities with migration status",
      "stack": [
        { "type": "analysis", "source": "schema/_index.json", "instruction": "Extract all entities" }
      ],
      "criteria": [
        { "check": "contains-table", "description": "Has entity table", "columns": ["Entity", "Status"] },
        { "check": "row-count-gte", "description": "Covers all entities", "min": 10 },
        { "check": "custom", "description": "Each entity has a valid status" }
      ]
    }
  ]
}
```

## CLI

```bash
sisyphus validate <spec-file>     # Validate spec against schema
sisyphus run <spec-file>          # Execute the spec
sisyphus run <spec-file> --dry-run    # Show plan without executing
sisyphus run <spec-file> --section <name>  # Run one boulder only
```

## Documentation Layer Checks

Deterministic, in-code checks that can't be gamed:

| Check | What it does |
|-------|-------------|
| `contains-table` | Verify markdown table exists with required columns |
| `row-count-gte` / `row-count-lte` | Verify row count bounds |
| `contains-heading` | Find heading by text and optional level |
| `word-count-gte` / `word-count-lte` | Verify word count bounds |
| `custom` | LLM-evaluated by Hades with adversarial stance |

All structural checks are code-block-aware -- tables and headings inside fenced code blocks are ignored.

## Project Structure

```
bin/sisyphus.ts              # CLI entry point
src/
  engine.ts                  # Boulder loop (Thanatos)
  spec.ts                    # Spec loading + JSON schema validation
  stack.ts                   # Data stacking pipeline
  start.ts                   # Claude spawning via stdin pipe
  checks.ts                  # Check registry
  prompt-builder.ts          # Prompt assembly with isolation
  lessons.ts                 # Cross-run learning system
  report.ts                  # Run report generation
  types.ts                   # Core interfaces
layers/
  documentation/
    index.ts                 # Layer interface implementation
    assembler.ts             # Markdown document assembly
    checks/                  # Structural check implementations
    prompts/
      sisyphus.md            # Producer prompt
      hades.md               # Evaluator prompt
lib/spec-schema.json         # Base spec JSON schema
lessons/                     # Lesson stores (global + per-layer)
examples/                    # Example specs
```

## Lessons System

Sisyphus learns across runs. When a boulder fails then succeeds after climbing, the pattern is captured as a lesson. Lessons are:

- Filtered by relevance tags before injection into prompts
- Scored by recency and frequency
- Budget-capped to prevent context bloat (default ~2000 chars)
- Stored per-layer (`lessons/documentation.json`) and globally (`lessons/global.json`)

## Setup

```bash
npm install
npm run build
npm test
```

Requires Node.js 18+ and the [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code).

## Why "Sisyphus"?

The boulder always rolls back down. But unlike the myth, this engine keeps climbing with specific feedback until it stays at the top -- or flags it and moves on.

## Related

- [agentic-loop](https://github.com/allierays/agentic-loop) -- Inspiration for the two-terminal architecture
- [HurleySk/sherlock](https://github.com/HurleySk/sherlock) -- Domain analyst skills, Sisyphus-aware
