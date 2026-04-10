# Sisyphus

Spec-driven document and task orchestrator for Claude Code.

Define what you want. Sisyphus builds it, checks it, and keeps pushing until it's right.

## What It Does

1. **Converse** — You describe what you need. Sisyphus asks clarifying questions and produces a structured spec with verifiable acceptance criteria.
2. **Execute** — Autonomous agents gather data and produce document sections, pulling from local files, ADO work items, or remote task execution.
3. **Evaluate** — An adversarial evaluator checks each section against the spec. Structural checks (table presence, row counts) are deterministic code. Custom criteria require evidence to pass.
4. **Retry** — Failed sections get specific feedback and retry. The loop continues until all criteria pass or max retries are exhausted.

## Usage

```
/sisyphus I need a migration status report for all alm_ entities

/sisyphus:task Deploy the updated SP to dev, run the pipeline, verify no errors
```

## Installation

Install as a Claude Code skill plugin:

```bash
claude skill install HurleySk/sisyphus
```

## Project Structure

```
skills/sisyphus/          # Claude Code skills
  sisyphus.md             # Main orchestrator
  spec-builder.md         # Conversational spec phase
  evaluator.md            # Adversarial evaluator
  task.md                 # Task loop mode

lib/                      # Shared definitions
  spec-schema.json        # JSON Schema for spec files
  structural-checks.md    # Deterministic check implementations

backends/                 # Pluggable data gathering
  analysis.md             # Local file analysis (built-in)
  ado-search.md           # Azure DevOps work items (built-in)
  boomerang-tasks.md      # Boomerang task dispatch (plugin)

examples/                 # Example specs
  migration-status.json   # Migration status report
  entity-mapping.json     # Entity schema mapping
  deploy-and-test.json    # Task loop: deploy and verify
```

## How Specs Work

A spec defines **sections** with **data sources** and **acceptance criteria**:

```json
{
  "title": "Entity Migration Status",
  "output": "output/reports/status.md",
  "sections": [
    {
      "name": "Entity Inventory",
      "gather": [
        { "type": "analysis", "source": "schema/_index.json", "instruction": "Extract all entities" }
      ],
      "criteria": [
        { "check": "contains-table", "columns": ["Entity", "Status"] },
        { "check": "custom", "description": "Each entity has a status from: Complete, In Progress, Blocked" }
      ]
    }
  ]
}
```

Criteria are the contract. The evaluator checks them adversarially — it must find specific evidence that each criterion is met, or it fails the section with actionable feedback.

## Backends

| Backend | Type | Description |
|---------|------|-------------|
| Analysis | Built-in | Read local files, Grep/Glob, agent synthesis |
| ADO Search | Built-in | Search Azure DevOps work items via `ado-search` CLI |
| Boomerang Tasks | Plugin | Dispatch task files to a remote work PC, poll for results |

Add custom backends by creating a new `.md` file in `backends/` following the existing format.

## Why "Sisyphus"?

Because documentation is the boulder that always rolls back down. But unlike the myth, this one actually gets it to the top — eventually.
