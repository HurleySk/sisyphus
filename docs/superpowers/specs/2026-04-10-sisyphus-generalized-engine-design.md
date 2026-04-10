# Sisyphus Generalized Engine — Design Spec

## Context

Sisyphus started as a spec-driven document orchestrator with a three-agent architecture (orchestrator, producer, evaluator). The core loop — gather data, produce output, evaluate against criteria, retry on failure — is domain-agnostic. Only the top layer (markdown output, section assembly, table/heading checks) is document-specific.

This design generalizes Sisyphus into a **layered engine** where the core handles orchestration and domain layers provide checks, prompts, and assembly logic. The first domain layer is "documentation" (what Sisyphus already does). Future layers (codegen, data-pipeline, etc.) plug in without changing the engine.

Inspired by [agentic-loop](https://github.com/allierays/agentic-loop) (Ralph's autonomous coding loop), with key differences: Sisyphus uses adversarial evaluation with agent isolation, a layered plugin architecture, and a budgeted lessons system.

## Vocabulary

All concepts map to the Sisyphus myth:

| Term | Meaning |
|------|---------|
| **Boulder** | A unit of work — the thing being pushed up the hill |
| **Stack** | Gather data the boulder needs before it gets pushed |
| **Start** | Spawn a fresh Claude instance to push the boulder |
| **Descend** | Evaluate whether the boulder rolled back (did it fail?) |
| **Climb** | Retry with failure feedback — push it up again |

## Agent Roles

Four named agents, strict isolation between them:

| Agent | Myth | Terminal | Sees | Does NOT see | Produces |
|-------|------|----------|------|-------------|----------|
| **Zeus** | God-architect | T1 | User conversation, final results | Boulder loop internals | Spec (the plan), summary |
| **Thanatos** | Enforcer | T2 | Spec, all boulder results, check outcomes | User conversation | Dispatch decisions, retry feedback, final report |
| **Sisyphus** | Boulder-pusher | Spawned by T2 | Boulder description, stacked data, climb feedback | Criteria | Boulder output (content/code/artifact) |
| **Hades** | Judge of the dead | Spawned by T2 | Boulder output, criteria, stacked data | Boulder description, goal | Pass/fail with evidence |

### Isolation Boundaries (Load-Bearing)

1. Sisyphus never sees criteria — can't optimize for the test instead of the task
2. Hades never sees the goal — can't rationalize a pass based on intent
3. Thanatos never produces content — can't short-circuit the loop
4. Zeus never touches the boulder loop — stays at the architect level

## Architecture: The Layer Stack

```
+-----------------------------------+
|  Technology Layer (optional)      |  Sherlock skills, ADO backends,
|  e.g. "migration", "dynamics"    |  specific prompt augmentations
+-----------------------------------+
|  Domain Layer                     |  "documentation" -> markdown checks, assembler
|  e.g. "docs", "codegen",         |  "codegen" -> compile check, test runner
|       "data-pipeline"            |  "data-pipeline" -> schema validation
+-----------------------------------+
|  Core Engine                      |  spec parser, stack pipeline, start,
|  (the generalized runner)         |  produce/descend loop, climb, reporting
+-----------------------------------+
```

Each layer provides: **check types**, **prompt templates**, **assemblers**, and optionally **stack backends**. The spec declares which layer it uses, and the engine loads it.

## Core Engine

The engine knows about boulders, stacking, starting, descending, and climbing. It does not know about markdown, documents, sections, or any domain.

### Core Modules

| Module | Role |
|--------|------|
| `spec.ts` | Parse + validate against base schema, then delegate to layer for domain validation |
| `stack.ts` | Data stacking pipeline (file reads, agent dispatch for large files) |
| `start.ts` | Spawn fresh Claude instances via `claude -p` |
| `engine.ts` | The boulder loop: stack -> start -> descend -> climb |
| `checks.ts` | Check registry — layers populate, engine executes |
| `prompt-builder.ts` | Build prompts from layer templates + dynamic data |
| `assembler.ts` | Delegates to layer's assembly logic |
| `report.ts` | Run report generation |
| `types.ts` | Core interfaces: Boulder, Layer, StackResult, CheckResult |

### The Boulder Loop

```
for each boulder in spec.boulders:
  stackResults = stack(boulder.stack)
  for attempt 0..maxRetries:                             // climb loop
    output = start(layer.buildProducerPrompt(...))       // start sisyphus
    structuralResults = layer.runChecks(output, criteria) // descend (deterministic)
    if customCriteria:
      customResults = start(layer.buildEvaluatorPrompt(...))  // hades judges
    allResults = [...structural, ...custom]
    if all pass -> save boulder output, break             // boulder stays at top
    else -> feedback = formatFailures(allResults)         // prepare next climb

layer.assemble(boulderOutputs, spec.output)
writeReport(results)
```

### Spawning Claude

Each invocation is a fresh process. No shared context, no conversation history. The spec file and prompt templates are the only interface.

```typescript
interface StartOptions {
  prompt: string;
  model?: 'opus' | 'sonnet' | 'haiku';
  outputFormat?: 'text' | 'json';
  timeout?: number;
}

async function start(options: StartOptions): Promise<string> {
  const args = ['-p', options.prompt];
  if (options.model) args.push('--model', options.model);
  if (options.outputFormat) args.push('--output-format', options.outputFormat);

  const result = await execFile('claude', args, {
    timeout: options.timeout ?? 120000,
    maxBuffer: 10 * 1024 * 1024,
  });

  return result.stdout;
}
```

## Layer Interface

The contract a domain layer must fulfill:

```typescript
interface Layer {
  name: string;

  // Schema extension — additional validation for domain-specific fields
  validateSpec(spec: Spec): ValidationResult;

  // Check registry — return domain-specific check functions
  getChecks(): Map<string, CheckFn>;

  // Prompt building — layer controls what the producer/evaluator see
  buildProducerPrompt(boulder: Boulder, stackResults: StackResult[], feedback?: string): string;
  buildEvaluatorPrompt(output: string, criteria: Criterion[], stackResults: StackResult[]): string;

  // Assembly — how to combine boulder outputs into the final artifact
  assemble(outputs: BoulderOutput[], outputPath: string): void;
}
```

### Discovery

The engine resolves `layers/{layerName}/index.ts` and expects a default export satisfying the Layer interface.

### Extensibility Path

Today: layers are directories in this repo. Tomorrow: swap discovery to check `node_modules/@sisyphus/{layerName}` as a fallback. The interface stays identical — only the resolution changes.

### Core vs Layer Responsibilities

| Core engine owns | Layer provides |
|-----------------|----------------|
| Spec parsing + base validation | Domain-specific validation |
| Stack pipeline (file reading, agent dispatch) | -- |
| Claude spawning (start) | Prompt templates + building |
| Check execution (run the function, collect results) | Check implementations (the actual logic) |
| Boulder loop + climb logic | -- |
| Report writing | -- |
| -- | Assembly of outputs into artifact |

## Zeus — The Conversational Front

Zeus is the user-facing agent. Two modes:

### Design Mode (Interactive Spec Building)

Zeus walks the user through:

1. What are you trying to produce? (goal, audience, scope)
2. Where does the data live? (maps to stack sources)
3. How do we know it's right? (maps to criteria)
4. Structure the boulders, propose the spec
5. User confirms -> validated spec JSON

This follows the brainstorming pattern: ask one question at a time, propose approaches, converge on a design. Zeus's prompt references the brainstorming skill and credits it as inspiration from the superpowers skill ecosystem.

### Execution Mode

1. Zeus invokes Thanatos (T2) with the confirmed spec
2. Waits for results
3. Presents summary: which boulders passed clean, which needed climbs, which got flagged
4. Offers next steps: review flagged boulders, adjust criteria, re-run

### What Zeus Does NOT Do

- Produce boulder content (Sisyphus does that)
- Evaluate output (Hades does that)
- Coordinate the boulder loop (Thanatos does that)

Zeus is the face of the system — the conversational interface between user and machine.

## Thanatos — The Orchestrator

Thanatos reads the spec cold, dispatches agents, and enforces the loop. Key behaviors:

- Relentless but not infinite — `maxRetries` is the sentence length
- Never produces content — only dispatches, assesses, and decides
- Spawns Sisyphus for production, Hades for judgment
- Formats failure feedback for the next climb attempt
- When all climbs exhausted: flags the boulder and moves on, reports to Zeus

### Decision Logic

```
descend(boulderOutput):
  structuralResults = runChecks(output, criteria)     // deterministic, in code
  if customCriteria:
    customResults = start(hades, output, criteria, stackResults)

  allResults = [...structural, ...custom]
  if all pass -> boulder stays at the top, next boulder
  if any fail AND climbs remain -> format feedback, send Sisyphus back up
  if any fail AND no climbs remain -> flag boulder, report to Zeus
```

## Spec Format

### Base Schema (Core Validates)

```json
{
  "title": "string (required)",
  "description": "string (optional)",
  "layer": "string (required) — which domain layer to load",
  "output": "string (required) — path for final artifact",
  "maxRetries": "number (1-10, default 3)",
  "boulders": [
    {
      "name": "string (required)",
      "description": "string (required) — what to produce",
      "stack": [
        { "type": "analysis|...", "source": "...", "instruction": "..." }
      ],
      "criteria": [
        { "check": "string", "description": "string", "...params": "..." }
      ],
      "maxRetries": "number (optional override)"
    }
  ]
}
```

### Layer Extensions

Validated by the layer, not the core:

- Documentation layer: `foreach` support, markdown-specific check types (contains-table, row-count, contains-heading, word-count)
- Future codegen layer: `language`, `testCommand`, compilation checks
- Future data-pipeline layer: schema validation, stage chaining

### Example Spec (Documentation Layer)

```json
{
  "title": "Wave 3 Migration Status",
  "description": "Comprehensive status report for all alm_ entities",
  "layer": "documentation",
  "output": "output/wave3-status.md",
  "maxRetries": 3,
  "boulders": [
    {
      "name": "Entity Inventory",
      "description": "Complete list of alm_ entities with migration status",
      "stack": [
        { "type": "analysis", "source": "schema/_index.json", "instruction": "Extract all entity names and their status" },
        { "type": "analysis", "source": "pipeline/*.json", "instruction": "List pipeline-to-entity mappings" }
      ],
      "criteria": [
        { "check": "contains-table", "columns": ["Entity", "Status", "Pipeline", "ADO Item"] },
        { "check": "row-count-gte", "min": 10 },
        { "check": "custom", "description": "Every entity has a valid status (migrated, in-progress, blocked, not-started)" }
      ]
    }
  ]
}
```

## The Retrospective Loop

After all boulders are resolved and the artifact is assembled, one more phase:

### Phase: Reflect

Zeus asks Thanatos: "What happened down there?" Thanatos reports:

- Which boulders passed clean on first push
- Which needed climbs, and what Hades flagged each time
- Which got flagged as incomplete after max climbs
- Patterns (e.g., "Hades rejected 3/5 boulders for the same reason")
- Prompt effectiveness observations

Zeus processes lessons into two buckets:

### Bucket 1 — Local Lessons (Auto-Updated)

| What | Where | Example |
|------|-------|---------|
| Spec refinements | Spec file or `lessons/` | "Criteria X too strict, suggest loosening" |
| Prompt improvements | `layers/{layer}/prompts/` | "Adding row completeness instruction reduced climbs by 60%" |
| Stack adjustments | Spec templates / examples | "This source consistently needs agent extraction" |
| Run history | `runs/` directory | Structured logs for Zeus to reference |

### Bucket 2 — Core Improvements (PR Against Repo)

| What | Example |
|------|---------|
| New check type needed | "Runs keep needing a contains-code-block check" |
| Engine behavior | "Climb feedback should include Hades's evidence, not just verdict" |
| Layer interface gap | "Layers need a beforeStack hook" |

Zeus drafts a PR with the proposed change and evidence from runs. Human reviews before merge.

### Guard Rails

- Local updates limited to prompt templates, lessons files, spec annotations — Zeus doesn't modify engine code locally
- PRs require human review before merge
- Zeus presents lessons summary to user before acting

## Lessons System (with Context Budget)

Inspired by agentic-loop's `/lesson` and auto-extraction, but with a cap to prevent context bloat.

### Lesson Sources

1. **Auto-extracted** — When Sisyphus fails then succeeds after climbing, Thanatos extracts what changed. Zeus distills it into a lesson.
2. **User-taught** — User tells Zeus directly. Zeus saves it.

### Storage

```
lessons/
  global.json          # applies to all runs regardless of layer
  documentation.json   # layer-specific
  codegen.json         # layer-specific (future)
```

Each lesson:

```json
{
  "id": "lesson-004",
  "text": "Row count criteria should reference the source data count, not a hardcoded number",
  "source": "auto",
  "layer": "documentation",
  "created": "2026-04-10",
  "lastUsed": "2026-04-10",
  "useCount": 3,
  "relevance": ["criteria", "row-count"]
}
```

### Context Budget

Hard cap: lessons injected into a prompt are limited to a configurable token budget (default ~2000 tokens / ~50 lessons). Managed via:

1. **Relevance filtering** — Lessons have `relevance` tags. Only lessons matching the current boulder's context are included.
2. **Recency + frequency scoring** — Lessons used often and recently rank higher. A lesson unused in 10 runs gets demoted.
3. **Consolidation** — Zeus periodically merges redundant lessons during the reflect phase. Five lessons about "make sure tables are complete" become one crisp rule.
4. **Eviction** — Lessons below a usefulness threshold after N runs are archived to `lessons/archive/`. Not deleted — Zeus can resurface them — but they stop consuming prompt budget.

### Injection Scope

| Lesson type | Stored in | Injected into |
|-------------|-----------|---------------|
| Global | `global.json` | Every Sisyphus and Hades prompt |
| Layer-specific | `{layer}.json` | Prompts for that layer only |
| Boulder-specific (rare) | Inline in spec | That boulder's prompt only |

## Execution Flow (End to End)

```
User invokes Sisyphus
  |
Zeus (T1) — Design Mode
  |  Conversational spec building
  |  Ask questions, propose approaches, converge on spec
  |  Output: validated spec JSON
  |
Zeus hands spec to Thanatos (T2)
  |
Thanatos — Boulder Loop
  |  For each boulder:
  |    stack() -> gather data
  |    start(sisyphus) -> produce output
  |    descend():
  |      runChecks() -> structural (deterministic)
  |      start(hades) -> custom criteria (adversarial)
  |    if fail AND climbs remain -> climb (retry with feedback)
  |    if fail AND no climbs -> flag boulder
  |    if pass -> save, next boulder
  |
  |  assemble(boulderOutputs) -> final artifact
  |  reflect() -> lessons report
  |
Zeus receives results
  |  Present summary to user
  |  Process lessons (local updates, potential PRs)
  |  Offer next steps
  |
User
```

## Directory Structure

```
sisyphus/
  bin/
    sisyphus.ts                  # CLI entry point
  src/
    engine.ts                    # Boulder loop: stack -> start -> descend -> climb
    spec.ts                      # Parse + validate base schema, delegate to layer
    stack.ts                     # Data stacking pipeline
    start.ts                     # Spawn fresh Claude instances
    checks.ts                    # Check registry (layers populate, engine executes)
    prompt-builder.ts            # Core prompt assembly
    assembler.ts                 # Delegates to layer's assembly logic
    report.ts                    # Run report generation
    types.ts                     # Core interfaces
  layers/
    documentation/
      index.ts                   # Layer interface implementation
      checks/                    # contains-table, row-count, contains-heading, word-count
      prompts/
        zeus.md                  # Conversational architect prompt
        sisyphus.md              # Producer prompt
        hades.md                 # Evaluator prompt
      assembler.ts               # Concatenate markdown into document
  # Note: Thanatos has no prompt template — Thanatos IS the engine code (engine.ts).
  # It's TypeScript orchestration logic, not an LLM agent.
  lib/
    spec-schema.json             # Base schema (boulders, stack, criteria)
  lessons/
    global.json                  # Cross-layer lessons
    documentation.json           # Documentation layer lessons
  examples/
    migration-status.json        # Updated to new schema
    entity-mapping.json          # Updated to new schema
  docs/                          # Design specs and documentation
  package.json
  tsconfig.json
  .gitignore
  CLAUDE.md
```

### Artifacts Removed (Superseded)

| Artifact | Reason |
|----------|--------|
| `skills/sisyphus/sisyphus.md` | Replaced by engine.ts + thanatos role |
| `skills/sisyphus/producer.md` | Moved to `layers/documentation/prompts/sisyphus.md` |
| `skills/sisyphus/evaluator.md` | Moved to `layers/documentation/prompts/hades.md` |
| `skills/sisyphus/spec-builder.md` | Absorbed into Zeus prompt |
| `skills/sisyphus/task.md` | Future layer, not in MVP |
| `backends/` | Absorbed into stack pipeline + layer backends |
| `lib/structural-checks.md` | Logic moves to `layers/documentation/checks/` as code |
| `docs/sisyphus-runner-design.md` | Superseded by this design |
| `docs/design.md` | Superseded by this design |

## MVP Scope

**In**:
- CLI with `run` and `validate` commands
- Core engine (boulder loop with stack/start/descend/climb)
- Layer interface + documentation layer
- Documentation layer checks: contains-table, row-count, contains-heading, word-count
- Analysis stack backend (file reads + agent dispatch for large files)
- Sisyphus/Hades prompt templates for documentation
- Zeus prompt template for documentation (design mode)
- Retry loop with climb feedback
- Artifact assembly and run report
- Glob support for stack source paths
- Lessons storage (global + layer-specific)
- .gitignore

**Out (future)**:
- `init` command (interactive spec builder as CLI)
- ADO search stack backend
- Boomerang task stack backend
- `foreach` boulder templates
- Checkpoint mode (save/resume)
- Parallel boulder execution
- `--watch` mode
- Cost tracking / token budget
- Auto-PR for core improvements
- Additional layers (codegen, data-pipeline)
- Technology layer stacking (e.g., Sherlock skills on top of documentation)
- Lesson consolidation and eviction automation
