# Sisyphus Runner — External CLI for Autonomous Document Production

## Context

Sisyphus is a spec-driven document orchestrator. We built the spec format, producer/evaluator prompts, and structural check definitions. During a trial run, two problems emerged: the orchestrator produced content itself instead of dispatching agents, and it shared conversational context that let agents rationalize. The fix is an external runner (like agentic-loop's Ralph) that reads a spec file cold and spawns fresh Claude instances with no shared memory.

## Overview

A Node.js/TypeScript CLI that:
1. Reads a spec JSON file
2. For each section: gathers data, spawns a producer Claude instance, runs structural checks in code, spawns an evaluator Claude instance, retries on failure
3. Assembles the final document

```
npx sisyphus run specs/my-spec.json
```

## Architecture

```
npx sisyphus run specs/wave3-mapping.json
  │
  ├─ spec.ts: Parse JSON, validate against lib/spec-schema.json
  │
  ├─ For each section (sequential):
  │   │
  │   ├─ gather.ts: Read files from spec's gather sources
  │   │   ├─ Small files (< 200 lines): pass contents directly
  │   │   └─ Large files: spawn gather agent (haiku) to extract per instruction
  │   │
  │   ├─ spawn.ts → Producer: claude -p with:
  │   │   ├─ producer.md prompt template
  │   │   ├─ Sherlock skill files (if referenced in spec or detected)
  │   │   ├─ Section description + gathered data
  │   │   ├─ Retry feedback (if retrying)
  │   │   └─ NOT criteria (producer must not see acceptance criteria)
  │   │   → Returns: section markdown
  │   │
  │   ├─ checks.ts: Pass 1 — structural checks IN CODE
  │   │   ├─ contains-table: regex parse markdown tables, verify columns
  │   │   ├─ row-count-gte/lte: count data rows in first table
  │   │   ├─ contains-heading: regex match headings by level and text
  │   │   ├─ word-count-gte/lte: strip markdown syntax, count tokens
  │   │   └─ Returns: array of pass/fail per structural criterion
  │   │
  │   ├─ spawn.ts → Evaluator (only if custom criteria exist): claude -p with:
  │   │   ├─ evaluator.md prompt template
  │   │   ├─ Section text (from producer)
  │   │   ├─ Custom criteria only (structural results already determined)
  │   │   ├─ Gathered source data (for cross-reference)
  │   │   └─ NOT section description or original goal
  │   │   → Returns: JSON array of pass/fail with evidence
  │   │
  │   ├─ retry.ts: Combine structural + custom results
  │   │   ├─ All pass → save section, move to next
  │   │   └─ Any fail → write failure context, retry (up to maxRetries)
  │   │       └─ Failure context includes: which criteria failed, evaluator feedback
  │   │
  │   └─ Output: section markdown saved to temp directory
  │
  ├─ Assemble all section outputs into final document at spec.output path
  └─ Write run-report.json with section statuses, retry counts, timing
```

## File Structure

```
sisyphus/
├── bin/
│   └── sisyphus.ts              # CLI entry point (commander or yargs)
├── src/
│   ├── runner.ts                # Main loop: iterate sections, orchestrate
│   ├── spec.ts                  # Parse spec JSON, validate against schema
│   ├── gather.ts                # Read files, spawn gather agents for large files
│   ├── spawn.ts                 # Spawn claude -p, capture output, handle errors
│   ├── checks.ts                # Structural check implementations (TypeScript)
│   ├── prompt-builder.ts        # Build prompts from templates + dynamic data
│   └── types.ts                 # TypeScript interfaces for spec, results, etc.
├── skills/sisyphus/             # Existing prompt templates (unchanged)
│   ├── producer.md
│   ├── evaluator.md
│   ├── spec-builder.md
│   └── sisyphus.md              # Kept for skill-mode invocation (not used by runner)
├── lib/
│   └── spec-schema.json         # Existing spec schema
├── backends/                    # Existing backend docs (not used by MVP runner)
├── examples/                    # Existing example specs
├── package.json
├── tsconfig.json
└── README.md
```

## Spawning Claude

```typescript
interface SpawnOptions {
  prompt: string;
  model?: 'opus' | 'sonnet' | 'haiku';  // default: sonnet for producer/evaluator, haiku for gather
  outputFormat?: 'text' | 'json';
  timeout?: number;  // ms, default 120000
}

async function spawnClaude(options: SpawnOptions): Promise<string> {
  const args = ['-p', options.prompt];
  if (options.model) args.push('--model', options.model);
  if (options.outputFormat) args.push('--output-format', options.outputFormat);

  const result = await execFile('claude', args, {
    timeout: options.timeout ?? 120000,
    maxBuffer: 10 * 1024 * 1024,  // 10MB
  });

  return result.stdout;
}
```

Each invocation is a fresh process. No shared context, no conversation history. The spec file and prompt templates are the only interface.

## Prompt Building

```typescript
function buildProducerPrompt(section: Section, gatherResults: GatherResult[], retryFeedback?: string, skills?: string[]): string {
  let prompt = fs.readFileSync('skills/sisyphus/producer.md', 'utf-8');

  // Load Sherlock skills if specified
  for (const skill of skills ?? []) {
    prompt += `\n\n--- Skill: ${skill} ---\n`;
    prompt += fs.readFileSync(skill, 'utf-8');
  }

  prompt += `\n\n--- Section Description ---\n${section.description}`;
  prompt += `\n\n--- Gathered Data ---\n${JSON.stringify(gatherResults, null, 2)}`;

  if (retryFeedback) {
    prompt += `\n\n--- Previous Attempt Failed ---\n${retryFeedback}`;
    prompt += `\nFix the specific issues identified above. Do not start from scratch.`;
  }

  prompt += `\n\n--- Output ---\nWrite the section content as markdown. Output ONLY the markdown, no commentary.`;

  return prompt;
}
```

Note: criteria are NOT included in the producer prompt. The producer writes from the data, not toward the criteria.

## Structural Checks (Code)

```typescript
interface CheckResult {
  criterion: string;
  pass: boolean;
  message: string;
}

function containsTable(markdown: string, columns?: string[]): CheckResult {
  // Regex: find lines matching | col | col | pattern
  // Identify header row (followed by |---|---| separator)
  // Extract column names, compare against required columns (case-insensitive)
}

function rowCountGte(markdown: string, min: number): CheckResult {
  // Find first table, count data rows (after separator), compare to min
}

function containsHeading(markdown: string, text: string, level?: number): CheckResult {
  // Regex: find lines starting with # characters
  // Match text (case-insensitive substring), optionally check level
}

function wordCount(markdown: string, min?: number, max?: number): CheckResult {
  // Strip markdown syntax, split on whitespace, count
}
```

These run in milliseconds, cost nothing, and can't be gamed. They filter out obviously wrong output before the more expensive LLM evaluator runs.

## Gather Pipeline

```typescript
async function gather(sources: GatherSource[]): Promise<GatherResult[]> {
  const results: GatherResult[] = [];

  for (const source of sources) {
    if (source.type === 'analysis') {
      const files = await glob(source.source);  // resolve glob patterns
      for (const file of files) {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');

        if (lines.length <= 200) {
          // Small file: pass directly
          results.push({ type: 'analysis', source: file, data: content });
        } else {
          // Large file: spawn gather agent for extraction
          const extracted = await spawnClaude({
            prompt: `Read this file and ${source.instruction}. Return ONLY the extracted data.\n\n${content}`,
            model: 'haiku',
          });
          results.push({ type: 'analysis', source: file, data: extracted });
        }
      }
    }
    // ADO, task backends: not in MVP, log warning and skip
  }

  return results;
}
```

## Retry Loop

```typescript
for (let attempt = 0; attempt <= section.maxRetries; attempt++) {
  // Gather (only on first attempt — data doesn't change)
  if (attempt === 0) gatherResults = await gather(section.gather);

  // Produce
  const markdown = await spawnClaude({
    prompt: buildProducerPrompt(section, gatherResults, lastFailure),
    model: 'sonnet',
  });

  // Evaluate
  const structuralResults = runStructuralChecks(markdown, section.criteria);
  const customCriteria = section.criteria.filter(c => c.check === 'custom');
  let customResults: CheckResult[] = [];

  if (customCriteria.length > 0) {
    const evalOutput = await spawnClaude({
      prompt: buildEvaluatorPrompt(markdown, customCriteria, gatherResults),
      model: 'sonnet',
      outputFormat: 'json',
    });
    customResults = JSON.parse(evalOutput);
  }

  const allResults = [...structuralResults, ...customResults];
  const failures = allResults.filter(r => !r.pass);

  if (failures.length === 0) {
    // Pass — save section and move on
    saveSection(section.name, markdown);
    break;
  }

  if (attempt < section.maxRetries) {
    // Fail — build retry context
    lastFailure = failures.map(f => `FAIL: ${f.criterion} — ${f.message}`).join('\n');
    log(`Section "${section.name}" failed (attempt ${attempt + 1}/${section.maxRetries}): ${failures.length} criteria`);
  } else {
    // Max retries — flag and move on
    flagSection(section.name, markdown, failures);
    log(`Section "${section.name}" FLAGGED after ${section.maxRetries} retries`);
  }
}
```

## CLI Interface

```
sisyphus run <spec-file>          # Execute a spec
sisyphus validate <spec-file>     # Validate spec against schema without running
sisyphus init                     # Interactive spec builder (future: wraps spec-builder.md)
```

Flags:
- `--dry-run`: Parse spec, show plan, don't execute
- `--section <name>`: Run only a specific section
- `--model <model>`: Override model for producer/evaluator (default: sonnet)
- `--verbose`: Show full prompts and responses
- `--output <path>`: Override output path from spec

## MVP Scope

**In**:
- CLI with `run` and `validate` commands
- Analysis gather backend (file reads + gather agents for large files)
- Producer spawning with prompt template + Sherlock skill loading
- Structural checks in TypeScript (contains-table, row-count, contains-heading, word-count)
- Evaluator spawning for custom criteria
- Retry loop with failure context
- Document assembly and run report
- Glob support for gather source paths

**Out (future)**:
- `init` command (interactive spec builder)
- ADO search gather backend
- Boomerang task gather backend
- `foreach` section templates
- Checkpoint mode (save/resume)
- Parallel section execution
- `--watch` mode
- Cost tracking / token budget

## Verification

1. Create a simple test spec with 2 sections and known-good source files
2. `npx sisyphus validate test-spec.json` — verify schema validation
3. `npx sisyphus run test-spec.json --dry-run` — verify plan output
4. `npx sisyphus run test-spec.json` — verify full execution:
   - Gather reads files correctly
   - Producer spawns and returns markdown
   - Structural checks pass/fail correctly
   - Evaluator spawns and returns JSON
   - Retry loop works on intentionally-failing criteria
   - Final document is assembled correctly
   - Run report is written
5. Run on Wave 3 mapping spec (2-3 entities) with Sherlock skills loaded
