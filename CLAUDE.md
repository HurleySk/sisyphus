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

- **Engine built and tested** -- 234 tests, CLI working (`npx sisyphus run/validate`)
- Documentation layer complete with structural checks (code-block-aware)
- Lessons system operational (global + per-layer, budget-capped)
- Ink-based terminal UI with agent-first layout, live streaming, per-boulder status bar, incremental rendering
- UI polish: relative paths in gathering, compressed retry history, title pinning in Static eviction, truncated error messages
- Codebase refactored: shared UI helpers (`sliceViewport`, `boulderStatusStyle`), extracted `processBoulder`/`parseEvaluatorResponse` from engine, consolidated type casts

## Next Steps

1. Test with real specs against real data (migration status report)
2. Build Zeus (T1 conversational architect) as a Claude Code skill
3. Add foreach boulder support
4. Add ADO search and boomerang task stack backends

## MVP Scope (Shipped)

**Done**: CLI (`run`, `validate`, `--dry-run`), core engine (boulder loop), documentation layer (6 structural checks + assembler), analysis stack backend, lessons system, producer/evaluator spawning via stdin pipe, retry loop with climb feedback, artifact assembly, run report, Ink v3 agent-first UI (AgentPanel with mode switching, StatusBar with boulder badges, CompletionSummary with per-boulder results, live produce:stream support)

**Next**: Zeus (T1 conversational architect), ADO/boomerang stack backends, foreach boulders, checkpoint mode, parallel boulders, watch mode, cost tracking

## Related Repos

- **HurleySk/boomerang-**: Git-based bridge for the data migration project. Sisyphus was born from this project's needs.
- **HurleySk/sherlock**: Domain analyst skills (migration-analyst, mapping-guide, lineage-tracer). Sisyphus-aware -- can generate compatible spec templates.

## Key Design Decisions

- **Generalized engine** over document-only tool -- domain layers make it extensible to any artifact type
- **Fresh build** over forking agentic-loop -- verification model is fundamentally different (artifact evaluation vs code verification)
- **Node.js/TypeScript** runtime -- matches Claude Code ecosystem, spawning via stdin pipe
- **Structural checks as code** -- deterministic TypeScript functions per domain layer, can't be gamed
- **Gather agents** -- for files >200 lines, spawn haiku to extract relevant data before passing to producer
- **Thin engine + fat prompts** -- logic lives in prompt templates, engine is orchestration glue
- **Lessons system** -- cross-run learning that persists patterns and anti-patterns, with capacity management
