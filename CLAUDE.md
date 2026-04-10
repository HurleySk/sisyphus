# Sisyphus

Spec-driven document orchestrator. Three-agent architecture: orchestrator (dispatcher) + producer + evaluator.

## Architecture

1. **Spec**: JSON file defining sections, gather sources, and acceptance criteria
2. **Runner**: External Node.js/TypeScript CLI that reads a spec cold and spawns fresh Claude instances
3. **Producer**: Claude instance that writes section content from gathered data (does NOT see criteria)
4. **Evaluator**: Separate Claude instance that adversarially checks content against criteria

Core principle: the orchestrator dispatches, never produces. Producer and evaluator are always separate processes with no shared context.

## Current State

- Skills layer complete: `skills/sisyphus/` has orchestrator, producer, evaluator, spec-builder, task prompts
- Spec schema defined: `lib/spec-schema.json`
- Structural checks documented: `lib/structural-checks.md`
- Backends documented: `backends/` (analysis, ado-search, boomerang-tasks)
- Example specs: `examples/`
- **Runner design spec written**: `docs/sisyphus-runner-design.md` — awaiting user review, then implementation planning

## Next Steps

1. User reviews `docs/sisyphus-runner-design.md`
2. Create implementation plan (writing-plans skill)
3. Build the TypeScript runner: `bin/`, `src/`, `package.json`, `tsconfig.json`

## Runner MVP Scope

**In**: CLI (`run`, `validate`), analysis gather backend, producer/evaluator spawning via `claude -p`, structural checks in TypeScript, retry loop, document assembly, run report

**Out**: `init` command, ADO/task gather backends, foreach sections, checkpoint mode, parallel sections, watch mode, cost tracking

## Related Repos

- **HurleySk/boomerang-**: Git-based bridge for the data migration project. Sisyphus was born from this project's needs.
- **HurleySk/sherlock**: Domain analyst skills (migration-analyst, mapping-guide, lineage-tracer). Sisyphus-aware — can generate compatible spec templates.

## Key Design Decisions

- **Fresh build** over forking agentic-loop — verification model is fundamentally different (document evaluation vs code verification)
- **Node.js/TypeScript** runtime — matches Claude Code ecosystem, `claude -p` spawning via `execFile`
- **Structural checks as code** — deterministic TypeScript (contains-table, row-count, contains-heading, word-count), can't be gamed
- **Gather agents** — for files >200 lines, spawn haiku to extract relevant data before passing to producer
- **Thin runner (~200-300 lines) + fat prompts** — logic lives in prompt templates, runner is orchestration glue
