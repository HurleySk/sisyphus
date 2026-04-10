---
name: sisyphus
description: Spec-driven document and task orchestrator — builds specs conversationally, executes autonomously, evaluates adversarially
---

# Sisyphus

A spec-driven orchestrator that produces documents and executes tasks with verifiable acceptance criteria.

## Invocation

```
/sisyphus <description of what you want to produce>
```

Or without arguments to start an interactive session.

## Three Phases

### Phase 1: Converse (Spec Building)

If no spec file is provided, invoke the **spec-builder** skill to create one through conversation. The spec builder will:

1. Ask clarifying questions (one at a time, multiple choice preferred)
2. Identify data sources and map them to gather backends
3. Define specific, falsifiable acceptance criteria
4. Output a structured JSON spec for approval

**The spec is the contract.** Once approved, the autonomous loop uses it as the sole source of truth. The user's original description is not consulted again.

Save the approved spec to a file (default: `specs/{slug}.json`).

### Phase 2: Execute (Per-Section Loop)

Process each section in order. For each section:

#### 2a. Gather Data

Execute each `gather` source using the appropriate backend:

- **`analysis`**: Read the specified file(s), apply the instruction to extract/analyze data. Use Glob for pattern matching, Read for file content, and agent dispatch for synthesis across multiple files.

- **`ado-search`**: Run `ado-search search "<query>" --data-dir ./ado-export --format json` with any specified filters. Parse results. Use `ado-search show <id>` for full work item content when needed.

- **`task`**: Write a Boomerang task file containing the step definition. Commit and push. Poll for results via git pull. Parse the result JSON when available. See `backends/boomerang-tasks.md` for details.

Store gathered data in memory for this section — the producer and evaluator both need it.

#### 2b. Produce Draft

You MUST use the **Agent tool** to spawn a separate **producer subagent** (see `skills/sisyphus/producer.md`). Hand it:
- The section description from the spec
- All gathered data
- If retrying: the previous draft + evaluator feedback

The producer subagent writes the section content as markdown and returns it to you. You receive the markdown back; you do not write it yourself.

**Do NOT pass acceptance criteria to the producer.** The producer should not know what will be checked — that is the evaluator's job. This separation prevents the producer from writing content that games the criteria instead of accurately representing the data.

#### 2c. Evaluate

You MUST use the **Agent tool** to spawn a separate **evaluator subagent** (see `skills/sisyphus/evaluator.md`). Hand it:
- The produced section text (returned from the producer agent)
- The section's criteria from the spec
- The gathered source data (for cross-reference)

The evaluator MUST be a separate Agent invocation from the producer. Never evaluate in the same agent context that produced the content — this defeats adversarial evaluation.

The evaluator runs two passes:
1. **Structural checks** (deterministic, see `lib/structural-checks.md`)
2. **Custom criteria** (adversarial LLM evaluation with evidence requirement)

#### 2d. Decide

- **All criteria pass** → Section complete. Append to output document. Move to next section.
- **Any criteria fail** → Check retry count.
  - Under max retries → Retry from 2b with evaluator feedback as context.
  - At max retries → Flag section as incomplete. Record evaluator notes. Move to next section.

### Phase 3: Finalize

After all sections are processed:

1. Assemble the complete document from section outputs
2. Write to the output path specified in the spec
3. Report summary:
   - Sections completed clean (no retries needed)
   - Sections completed after retries (list retry counts)
   - Sections flagged as incomplete (list failing criteria)
4. If any sections are incomplete, ask the user if they want to manually address them

## Progress Reporting

Use TaskCreate/TaskUpdate to track progress:
- One task per section: "Section: {name}"
- Mark in_progress when starting gather
- Mark completed when evaluator passes
- For flagged sections: leave in_progress with a note about failing criteria

Print status lines during execution:
```
[sisyphus] Section 1/4: Entity Inventory
  ├─ Gathering: reading dataverse-schema/_index.json... 47 entities found
  ├─ Gathering: ado-search "migration alm_"... 23 work items
  ├─ Producing draft...
  ├─ Evaluating:
  │   ✓ contains-table (Entity, Status, ADO Item, Notes)
  │   ✓ row-count-gte 47
  │   ✗ custom: "3 entities missing status value"
  ├─ Retrying (1/3) with feedback...
  ├─ Evaluating:
  │   ✓ all criteria pass
  └─ ✓ Section complete
```

## Foreach Sections

When a section has a `foreach` field:

1. During gather, resolve the referenced data to get the iteration list
2. Create one section instance per item
3. Process each instance through the full gather → produce → evaluate loop
4. Template variables (`{entity}`, etc.) are substituted in section name, gather sources, and instructions

Example: `"foreach": "gather[0].entities"` with a gather that found 47 entities creates 47 section instances.

**Optimization**: For large foreach sets, batch evaluation — produce all instances first, then evaluate in parallel. But still retry individually on failure.

## Error Handling

- **Gather failure** (file not found, task timeout, ADO search error): Log the error, skip the gather source, produce with available data. The evaluator will catch if the missing data causes criteria failures.
- **Producer failure** (agent error): Retry the production step (counts toward retry limit).
- **Evaluator failure** (agent error): Re-run evaluation. If persistent, flag section for manual review.
- **All retries exhausted**: Flag section, move on. Never block the entire document on one section.

## Anti-Patterns

**If you find yourself writing markdown content for a section, STOP.** You are the orchestrator. You are the dispatcher. You gather data, you dispatch producer agents, you dispatch evaluator agents, you manage the retry loop. You never write document content yourself.

Violations of this rule:
- Writing markdown headings, tables, or prose for a section body
- "Drafting" content and then sending it to the evaluator as if a producer wrote it
- Combining production and evaluation in a single agent call
- Skipping the Agent tool and inlining the producer or evaluator logic

The orchestrator's output is the assembled document from section outputs returned by producer agents. The only text you write directly is progress/status logging.

## Spec File Location

Specs are saved and loaded from a `specs/` directory. The user can specify a different location.

When loading an existing spec: validate against `lib/spec-schema.json` before execution.
