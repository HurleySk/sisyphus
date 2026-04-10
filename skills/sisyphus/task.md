---
name: task
description: Task loop mode — build, send, retrieve, analyze, fix, retry for Boomerang deploy/test cycles
---

# Sisyphus Task Loop

A simplified mode for deploy-test-fix cycles on the Boomerang work PC.

## Invocation

```
/sisyphus:task <goal description>
```

Example:
```
/sisyphus:task Deploy p_SecurityModelConfig to dev, run the pipeline, verify no errors
```

## How It Works

The task loop uses the same core pattern as document mode (execute → evaluate → retry) but with a simpler spec shape: a linear sequence of steps with success/failure criteria.

### Step 1: Parse the Goal

Analyze the user's goal and decompose it into ordered steps. Each step maps to a Boomerang task type:

| User says | Task step type |
|-----------|---------------|
| "Deploy SP X" | `sql-deploy-sp` |
| "Deploy pipeline X" | `adf-deploy-pipeline` |
| "Run pipeline X" | `adf-run-and-wait` |
| "Query table X" | `sql-query` |
| "Check for errors" | `adf-activity-errors` or `adf-export-errors` |
| "Pull latest schema" | `schema-pull` or `sql-schema-pull` |
| "Revert dev" | `dev-revert` |

### Step 2: Build and Send

For each step:
1. Generate the task JSON with appropriate step type and parameters
2. Add `"confirm": true` for any write/deploy operation
3. Commit and push the task file
4. Wait for results (poll `tasks/results/`)

### Step 3: Evaluate Result

Check the result:
- **Success**: Move to next step
- **Failure**: Analyze the error

### Step 4: Fix and Retry (on failure)

When a step fails:
1. Read the error details from the result
2. Determine root cause:
   - SQL error in SP → Read the SP source, identify the issue, fix it, redeploy
   - Pipeline error → Check activity errors, trace the failure, fix the underlying SP or config
   - Connection/auth error → Report to user (can't fix automatically)
3. If fixable: make the fix, retry from the appropriate step
4. If not fixable: report the error with analysis to the user

### Retry Strategy

- Fix attempts are cumulative across steps (fixing a SP and redeploying counts as retries for both steps)
- Max total retries: 5 (configurable)
- Each retry includes all previous error context so the fixer doesn't repeat failed approaches
- If a fix introduces a new error, include both the original and new error in context

## Progress Reporting

```
[sisyphus:task] Goal: Deploy p_SecurityModelConfig to dev, run pipeline, verify
  Step 1/3: Deploy SP
  ├─ Task: sql-deploy-sp, connection: dev, name: p_SecurityModelConfig
  ├─ Waiting for result...
  └─ ✓ Deployed successfully

  Step 2/3: Run pipeline
  ├─ Task: adf-run-and-wait, factory: dev1, pipeline: New_Security_Model_Updates_Incl_Inactives
  ├─ Waiting for result...
  ├─ ✗ Failed: 3 activity errors
  ├─ Analyzing: Column 'alm_fercorgcdfk' not found
  ├─ Fix: Updating SP column reference...
  ├─ Retry from step 1...
  │
  Step 1/3 (retry 1): Deploy fixed SP
  ├─ ...
  └─ ✓ Deployed

  Step 2/3 (retry 1): Run pipeline
  ├─ ...
  └─ ✓ Completed in 4m 32s

  Step 3/3: Check errors
  ├─ Task: adf-activity-errors, factory: dev1, runId: xxx
  └─ ✓ No errors

  ═══ All steps complete (1 retry) ═══
```

## Safety

- All write operations require `"confirm": true` — the work PC operator approves each one
- Never target production unless the user explicitly specified it and confirmed
- Connection/environment names are validated against `connections.json` before building tasks
- SP fixes are made in `work-repo-staging/` (not `work-repo/` directly)

## Limitations

- Requires the work PC to be actively processing task files
- Cannot fix auth/connectivity issues (reports them for manual resolution)
- SP fixes are best-effort — complex logic errors may need human intervention
- Pipeline JSON modifications are limited to parameter changes (structural pipeline changes need manual review)
