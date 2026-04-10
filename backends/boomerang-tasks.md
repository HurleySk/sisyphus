---
name: boomerang-tasks
description: Backend plugin for dispatching Boomerang task files to a work PC and retrieving results
---

# Boomerang Tasks Backend

Dispatches data-gathering operations to a remote work PC via Boomerang's task file system. Used when the orchestrator needs data that only the work PC can provide (SQL queries, Dataverse queries, ADF run history).

## Prerequisites

- Running inside a Boomerang project (has `tasks/` and `tasks/results/` directories)
- `connections.json` present with configured connections/environments
- Work PC actively polling for task files

## Gather Spec

```json
{
  "type": "task",
  "step": {
    "type": "sql-query",
    "connection": "dev",
    "sql": "SELECT TOP 100 * FROM alm_meetings_staging"
  }
}
```

The `step` field accepts any valid Boomerang task step definition (sql-query, dataverse-query, adf-query-runs, etc.).

## Execution

### Wait Mode (v1)

1. **Build task file**: Create a task JSON with the step definition
   - Filename: `sisyphus-gather-{sectionIndex}-{gatherIndex}.json`
   - Single step, no confirmation required for read-only queries
2. **Commit and push**: Stage the task file, commit with message `sisyphus: gather for {sectionName}`, push to remote
3. **Poll for results**: Periodically run `git pull` and check for `tasks/results/sisyphus-gather-{...}-result.json`
   - Poll interval: 30 seconds initially, backing off to 2 minutes
   - Timeout: 10 minutes (configurable)
4. **Parse results**: Read the result JSON, extract output data (CSV paths, row counts, error messages)
5. **Clean up**: Remove the task file and result file after processing

### Checkpoint Mode (Future)

When the poll times out or the user wants to resume later:
1. Save loop state to `sisyphus-checkpoint.json`:
   - Current section index
   - Retry count
   - Gathered data so far
   - Pending task file names
2. On resume: load checkpoint, check for results, continue loop

## Return Format

```json
{
  "type": "task",
  "step": { "type": "sql-query", "connection": "dev", "sql": "..." },
  "status": "success",
  "itemCount": 100,
  "data": [
    { "column1": "value1", "column2": "value2" }
  ],
  "outputFile": "samples/sisyphus-gather-1-0_dev.csv"
}
```

On failure:
```json
{
  "type": "task",
  "step": { "type": "sql-query", "connection": "dev", "sql": "..." },
  "status": "error",
  "error": "Invalid column name 'alm_fercorgcdfk'",
  "data": null
}
```

## Safety

- **Read-only by default**: Gather steps should be queries, not mutations. The backend does not add `"confirm": true` to gather steps.
- **Write steps**: If a task loop spec includes write operations (deploy, update), the step must have `"confirm": true`. The backend adds this automatically for step types that modify data.
- **Connection validation**: Before writing a task file, verify the connection/environment name exists in `connections.json`.

## Task Loop Integration

When used via `/sisyphus:task` (task loop mode), the backend handles the full build-send-retrieve-fix cycle:

1. Build deployment/mutation task (with confirmation)
2. Wait for result
3. If error: pass error details to the producer for analysis and fix
4. Rebuild and retry

The task loop mode produces task files with write steps — these always include `"confirm": true` so the work PC operator approves each mutation.
