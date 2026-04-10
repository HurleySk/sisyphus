# Sisyphus

Generalized spec-driven artifact engine. Three-layer architecture with four named agents.

## Architecture

### Three Layers

1. **Core Engine** -- layer-agnostic orchestration: spec parsing, agent spawning, retry loops, lessons system, run reporting
2. **Domain Layers** -- artifact-type-specific logic (e.g., `layers/documentation/`): section templates, structural checks, assembly rules
3. **Technology Layers** -- gather backends for specific data sources (e.g., analysis, ADO, boomerang tasks)

### Four Agents

| Agent | Tier | Role |
|---|---|---|
| **Zeus** | T1 | Conversational architect -- helps users design specs interactively |
| **Thanatos** | T2 | Orchestrator -- dispatches work, never produces content |
| **Sisyphus** | T3 | Producer -- writes artifact content from gathered data (does NOT see criteria) |
| **Hades** | T3 | Evaluator -- adversarially checks content against criteria |

Core principle: Thanatos dispatches, never produces. Sisyphus and Hades are always separate processes with no shared context.

### Vocabulary

- **Boulder** -- a unit of work (the thing being pushed up the hill)
- **Stack** -- gather data the boulder needs before it gets pushed
- **Start** -- spawn a fresh Claude instance to push the boulder
- **Descend** -- evaluate whether the boulder rolled back (did it fail?)
- **Climb** -- retry with failure feedback (push it up again)

## Current State

- Design spec written: `docs/superpowers/specs/2026-04-10-sisyphus-generalized-engine-design.md`
- Spec schema defined: `lib/spec-schema.json`
- Example specs: `examples/`
- Awaiting user review of design spec, then implementation planning

## Next Steps

1. User reviews `docs/superpowers/specs/2026-04-10-sisyphus-generalized-engine-design.md`
2. Create implementation plan (writing-plans skill)
3. Build the TypeScript engine: `bin/`, `src/`, `package.json`, `tsconfig.json`

## MVP Scope

**In**: CLI (`run`, `validate`), core engine, documentation layer, analysis stack backend, lessons system, producer/evaluator spawning via `claude -p`, structural checks as TypeScript, retry loop, artifact assembly, run report

**Out**: Zeus (T1 conversational architect), ADO/boomerang gather backends, foreach sections, checkpoint mode, parallel sections, watch mode, cost tracking

## Related Repos

- **HurleySk/boomerang-**: Git-based bridge for the data migration project. Sisyphus was born from this project's needs.
- **HurleySk/sherlock**: Domain analyst skills (migration-analyst, mapping-guide, lineage-tracer). Sisyphus-aware -- can generate compatible spec templates.

## Key Design Decisions

- **Generalized engine** over document-only tool -- domain layers make it extensible to any artifact type
- **Fresh build** over forking agentic-loop -- verification model is fundamentally different (artifact evaluation vs code verification)
- **Node.js/TypeScript** runtime -- matches Claude Code ecosystem, `claude -p` spawning via `execFile`
- **Structural checks as code** -- deterministic TypeScript functions per domain layer, can't be gamed
- **Gather agents** -- for files >200 lines, spawn haiku to extract relevant data before passing to producer
- **Thin engine + fat prompts** -- logic lives in prompt templates, engine is orchestration glue
- **Lessons system** -- cross-run learning that persists patterns and anti-patterns, with capacity management
