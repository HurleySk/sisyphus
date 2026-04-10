# Sisyphus Generalized Engine — MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Sisyphus core engine, CLI, documentation layer, and lessons system as a TypeScript Node.js CLI tool.

**Architecture:** A layered engine where `src/` contains domain-agnostic orchestration (boulder loop, spawning, stacking) and `layers/documentation/` provides markdown-specific checks, prompt templates, and assembly. The CLI reads a spec JSON file and processes boulders sequentially through the stack/start/descend/climb loop.

**Tech Stack:** TypeScript 5.x, Node.js 18+, commander (CLI), glob (file patterns), Ajv (JSON Schema validation), vitest (testing)

---

## File Map

### Core Engine (`src/`)

| File | Responsibility |
|------|----------------|
| `src/types.ts` | All core interfaces: Spec, Boulder, StackSource, Criterion, StackResult, CheckResult, BoulderOutput, Layer, RunReport |
| `src/spec.ts` | Load spec JSON, validate against base schema with Ajv, resolve layer, delegate domain validation |
| `src/stack.ts` | Read files from stack sources, resolve globs, spawn haiku gather agents for large files |
| `src/start.ts` | Spawn `claude -p` as child process, capture stdout, handle errors/timeouts |
| `src/checks.ts` | Check registry: register check functions from layer, execute them against output, collect results |
| `src/prompt-builder.ts` | Load prompt templates from layer, inject boulder data + stack results + lessons + feedback |
| `src/engine.ts` | Main boulder loop: iterate boulders, call stack/start/descend/climb, delegate assembly |
| `src/report.ts` | Generate run-report.json with per-boulder status, attempt counts, timing |
| `src/lessons.ts` | Load/save lessons JSON, filter by relevance, enforce token budget |

### CLI (`bin/`)

| File | Responsibility |
|------|----------------|
| `bin/sisyphus.ts` | CLI entry point using commander: `run` and `validate` commands with flags |

### Documentation Layer (`layers/documentation/`)

| File | Responsibility |
|------|----------------|
| `layers/documentation/index.ts` | Layer interface implementation: registers checks, builds prompts, assembles output |
| `layers/documentation/checks/contains-table.ts` | Parse markdown tables, verify required columns exist |
| `layers/documentation/checks/row-count.ts` | Count data rows in first markdown table, compare to min/max |
| `layers/documentation/checks/contains-heading.ts` | Find headings by text and optional level |
| `layers/documentation/checks/word-count.ts` | Strip markdown, count words, compare to min/max |
| `layers/documentation/checks/index.ts` | Re-export all checks as a Map |
| `layers/documentation/assembler.ts` | Concatenate boulder markdown outputs with headings into final document |
| `layers/documentation/prompts/sisyphus.md` | Producer prompt template |
| `layers/documentation/prompts/hades.md` | Evaluator prompt template |

### Schema + Config

| File | Responsibility |
|------|----------------|
| `lib/spec-schema.json` | Updated base schema (boulders/stack/criteria, layer field) |
| `lessons/global.json` | Global lessons store (starts empty) |
| `lessons/documentation.json` | Documentation layer lessons (starts empty) |
| `package.json` | Dependencies, bin entry, scripts |
| `tsconfig.json` | TypeScript config |

### Tests (`tests/`)

| File | Responsibility |
|------|----------------|
| `tests/types.test.ts` | Type guard validation tests |
| `tests/spec.test.ts` | Spec loading and validation tests |
| `tests/checks/contains-table.test.ts` | Markdown table parsing tests |
| `tests/checks/row-count.test.ts` | Row counting tests |
| `tests/checks/contains-heading.test.ts` | Heading detection tests |
| `tests/checks/word-count.test.ts` | Word counting tests |
| `tests/stack.test.ts` | File reading and glob resolution tests |
| `tests/start.test.ts` | Claude spawning tests (mocked) |
| `tests/checks.test.ts` | Check registry tests |
| `tests/prompt-builder.test.ts` | Prompt assembly tests |
| `tests/engine.test.ts` | Boulder loop integration tests |
| `tests/lessons.test.ts` | Lessons load/save/filter tests |
| `tests/report.test.ts` | Report generation tests |
| `tests/documentation-layer.test.ts` | Documentation layer integration tests |
| `tests/fixtures/` | Test spec files, sample markdown, sample source files |

---

## Task 1: Project Setup

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`

- [ ] **Step 1: Initialize package.json**

```json
{
  "name": "sisyphus",
  "version": "0.1.0",
  "description": "Spec-driven artifact engine with adversarial evaluation",
  "type": "module",
  "bin": {
    "sisyphus": "./dist/bin/sisyphus.js"
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "dev": "tsc --watch"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "license": "MIT"
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*", "bin/**/*", "layers/**/*.ts"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Install dependencies**

Run: `npm install commander ajv glob`
Run: `npm install -D typescript vitest @types/node`

- [ ] **Step 4: Verify setup compiles**

Create a minimal `src/types.ts` with a single export:

```typescript
export interface Spec {
  title: string;
}
```

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Verify vitest runs**

Create `tests/setup.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

describe('setup', () => {
  it('vitest works', () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npx vitest run`
Expected: 1 test passes

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json package-lock.json src/types.ts tests/setup.test.ts
git commit -m "chore: initialize TypeScript project with vitest"
```

---

## Task 2: Core Types

**Files:**
- Create: `src/types.ts` (replace minimal version from Task 1)
- Create: `tests/types.test.ts`

- [ ] **Step 1: Write type guard tests**

Create `tests/types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { isStackSource, isCriterion, isBoulder, isSpec } from '../src/types.js';

describe('type guards', () => {
  describe('isStackSource', () => {
    it('accepts valid analysis source', () => {
      expect(isStackSource({ type: 'analysis', source: 'foo.json', instruction: 'extract' })).toBe(true);
    });

    it('rejects missing type', () => {
      expect(isStackSource({ source: 'foo.json' })).toBe(false);
    });

    it('rejects non-object', () => {
      expect(isStackSource('not an object')).toBe(false);
      expect(isStackSource(null)).toBe(false);
    });
  });

  describe('isCriterion', () => {
    it('accepts valid structural criterion', () => {
      expect(isCriterion({ check: 'contains-table', description: 'has a table' })).toBe(true);
    });

    it('accepts criterion with extra params', () => {
      expect(isCriterion({ check: 'row-count-gte', description: 'enough rows', min: 5 })).toBe(true);
    });

    it('rejects missing check', () => {
      expect(isCriterion({ description: 'no check field' })).toBe(false);
    });
  });

  describe('isBoulder', () => {
    it('accepts valid boulder', () => {
      const boulder = {
        name: 'Test',
        description: 'A test boulder',
        stack: [{ type: 'analysis', source: 'f.json', instruction: 'read' }],
        criteria: [{ check: 'custom', description: 'looks good' }],
      };
      expect(isBoulder(boulder)).toBe(true);
    });

    it('accepts boulder with no stack', () => {
      const boulder = {
        name: 'Test',
        description: 'No data needed',
        criteria: [{ check: 'custom', description: 'looks good' }],
      };
      expect(isBoulder(boulder)).toBe(true);
    });

    it('rejects boulder with empty criteria', () => {
      expect(isBoulder({ name: 'Test', description: 'x', criteria: [] })).toBe(false);
    });
  });

  describe('isSpec', () => {
    it('accepts minimal valid spec', () => {
      const spec = {
        title: 'Test',
        layer: 'documentation',
        output: 'out.md',
        boulders: [{
          name: 'B1',
          description: 'first',
          criteria: [{ check: 'custom', description: 'ok' }],
        }],
      };
      expect(isSpec(spec)).toBe(true);
    });

    it('rejects spec with no boulders', () => {
      expect(isSpec({ title: 'T', layer: 'docs', output: 'o', boulders: [] })).toBe(false);
    });

    it('rejects spec missing layer', () => {
      expect(isSpec({ title: 'T', output: 'o', boulders: [{ name: 'B', description: 'd', criteria: [{ check: 'c', description: 'd' }] }] })).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/types.test.ts`
Expected: FAIL — module `../src/types.js` exports not found

- [ ] **Step 3: Implement types and type guards**

Replace `src/types.ts`:

```typescript
// --- Core data types ---

export interface StackSource {
  type: string;
  source?: string;
  instruction?: string;
  [key: string]: unknown;
}

export interface Criterion {
  check: string;
  description: string;
  columns?: string[];
  heading?: string;
  level?: number;
  min?: number;
  max?: number;
  source?: string;
  [key: string]: unknown;
}

export interface Boulder {
  name: string;
  description: string;
  stack?: StackSource[];
  criteria: Criterion[];
  maxRetries?: number;
}

export interface Spec {
  title: string;
  description?: string;
  layer: string;
  output: string;
  maxRetries?: number;
  boulders: Boulder[];
}

// --- Result types ---

export interface StackResult {
  type: string;
  source: string;
  data: string;
}

export interface CheckResult {
  criterion: string;
  pass: boolean;
  message: string;
}

export interface BoulderOutput {
  name: string;
  content: string;
  attempts: number;
  status: 'passed' | 'flagged';
  failures?: CheckResult[];
}

export interface RunReport {
  title: string;
  startedAt: string;
  completedAt: string;
  boulders: BoulderOutput[];
  totalBoulders: number;
  passedClean: number;
  passedAfterClimb: number;
  flagged: number;
}

// --- Layer interface ---

export type CheckFn = (markdown: string, criterion: Criterion) => CheckResult;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface Layer {
  name: string;
  validateSpec(spec: Spec): ValidationResult;
  getChecks(): Map<string, CheckFn>;
  buildProducerPrompt(boulder: Boulder, stackResults: StackResult[], feedback?: string, lessons?: string): string;
  buildEvaluatorPrompt(output: string, criteria: Criterion[], stackResults: StackResult[], lessons?: string): string;
  assemble(outputs: BoulderOutput[], outputPath: string): Promise<void>;
}

// --- Lesson types ---

export interface Lesson {
  id: string;
  text: string;
  source: 'auto' | 'user';
  layer?: string;
  created: string;
  lastUsed: string;
  useCount: number;
  relevance: string[];
}

// --- Type guards ---

export function isStackSource(value: unknown): value is StackSource {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.type === 'string';
}

export function isCriterion(value: unknown): value is Criterion {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.check === 'string' && typeof obj.description === 'string';
}

export function isBoulder(value: unknown): value is Boulder {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj.name !== 'string' || typeof obj.description !== 'string') return false;
  if (!Array.isArray(obj.criteria) || obj.criteria.length === 0) return false;
  if (obj.stack !== undefined && !Array.isArray(obj.stack)) return false;
  return obj.criteria.every(isCriterion);
}

export function isSpec(value: unknown): value is Spec {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj.title !== 'string') return false;
  if (typeof obj.layer !== 'string') return false;
  if (typeof obj.output !== 'string') return false;
  if (!Array.isArray(obj.boulders) || obj.boulders.length === 0) return false;
  return obj.boulders.every(isBoulder);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/types.test.ts`
Expected: All 10 tests pass

- [ ] **Step 5: Delete setup test**

Remove `tests/setup.test.ts` (no longer needed).

- [ ] **Step 6: Commit**

```bash
git add src/types.ts tests/types.test.ts
git rm tests/setup.test.ts
git commit -m "feat: core type definitions and type guards"
```

---

## Task 3: Spec Schema + Validation

**Files:**
- Modify: `lib/spec-schema.json` (update to new vocabulary)
- Create: `src/spec.ts`
- Create: `tests/spec.test.ts`
- Create: `tests/fixtures/valid-spec.json`
- Create: `tests/fixtures/invalid-spec-no-layer.json`

- [ ] **Step 1: Update spec-schema.json to new vocabulary**

Replace `lib/spec-schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Sisyphus Spec",
  "description": "A spec-driven artifact definition with boulders, stack sources, and acceptance criteria",
  "type": "object",
  "required": ["title", "layer", "output", "boulders"],
  "properties": {
    "title": {
      "type": "string",
      "description": "Human-readable title for this spec"
    },
    "description": {
      "type": "string",
      "description": "Brief description of what this spec produces"
    },
    "layer": {
      "type": "string",
      "description": "Domain layer to use (e.g., 'documentation')"
    },
    "output": {
      "type": "string",
      "description": "Output file path (relative to working directory)"
    },
    "maxRetries": {
      "type": "integer",
      "default": 3,
      "minimum": 1,
      "maximum": 10,
      "description": "Default max retries per boulder"
    },
    "boulders": {
      "type": "array",
      "minItems": 1,
      "items": { "$ref": "#/$defs/boulder" }
    }
  },
  "$defs": {
    "boulder": {
      "type": "object",
      "required": ["name", "description", "criteria"],
      "properties": {
        "name": {
          "type": "string",
          "description": "Boulder name"
        },
        "description": {
          "type": "string",
          "description": "What this boulder should produce"
        },
        "stack": {
          "type": "array",
          "items": { "$ref": "#/$defs/stackSource" },
          "description": "Data sources to stack before producing"
        },
        "criteria": {
          "type": "array",
          "minItems": 1,
          "items": { "$ref": "#/$defs/criterion" },
          "description": "Acceptance criteria for this boulder"
        },
        "maxRetries": {
          "type": "integer",
          "minimum": 0,
          "description": "Override max retries for this boulder"
        }
      }
    },
    "stackSource": {
      "type": "object",
      "required": ["type"],
      "properties": {
        "type": {
          "type": "string",
          "description": "Stack backend type (e.g., 'analysis')"
        },
        "source": {
          "type": "string",
          "description": "File path or glob pattern"
        },
        "instruction": {
          "type": "string",
          "description": "What to extract from the source"
        }
      },
      "additionalProperties": true
    },
    "criterion": {
      "type": "object",
      "required": ["check", "description"],
      "properties": {
        "check": {
          "type": "string",
          "description": "Check type (structural checks registered by layer, or 'custom' for LLM evaluation)"
        },
        "description": {
          "type": "string",
          "description": "Human-readable description of what this criterion verifies"
        }
      },
      "additionalProperties": true
    }
  }
}
```

Note: The `check` field no longer has an `enum` constraint — layers register their own check types. The base schema only ensures `check` and `description` are present. The `criterion` and `stackSource` objects allow `additionalProperties` so layers can add domain-specific fields (like `columns`, `min`, `heading`).

- [ ] **Step 2: Create test fixtures**

Create `tests/fixtures/valid-spec.json`:

```json
{
  "title": "Test Spec",
  "layer": "documentation",
  "output": "output/test.md",
  "maxRetries": 2,
  "boulders": [
    {
      "name": "Introduction",
      "description": "Write an introduction section",
      "stack": [
        { "type": "analysis", "source": "README.md", "instruction": "Summarize the project" }
      ],
      "criteria": [
        { "check": "word-count-gte", "description": "At least 100 words", "min": 100 },
        { "check": "contains-heading", "description": "Has a heading", "heading": "Introduction" }
      ]
    },
    {
      "name": "Summary",
      "description": "Write a summary section",
      "criteria": [
        { "check": "custom", "description": "Accurately summarizes the introduction" }
      ]
    }
  ]
}
```

Create `tests/fixtures/invalid-spec-no-layer.json`:

```json
{
  "title": "Missing Layer",
  "output": "out.md",
  "boulders": [
    {
      "name": "B1",
      "description": "test",
      "criteria": [{ "check": "custom", "description": "ok" }]
    }
  ]
}
```

- [ ] **Step 3: Write spec validation tests**

Create `tests/spec.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { loadSpec, validateSpec } from '../src/spec.js';
import path from 'path';

const fixturesDir = path.join(import.meta.dirname, 'fixtures');

describe('loadSpec', () => {
  it('loads and validates a valid spec file', async () => {
    const spec = await loadSpec(path.join(fixturesDir, 'valid-spec.json'));
    expect(spec.title).toBe('Test Spec');
    expect(spec.layer).toBe('documentation');
    expect(spec.boulders).toHaveLength(2);
    expect(spec.boulders[0].name).toBe('Introduction');
    expect(spec.maxRetries).toBe(2);
  });

  it('throws on non-existent file', async () => {
    await expect(loadSpec('nonexistent.json')).rejects.toThrow();
  });
});

describe('validateSpec', () => {
  it('returns valid for a correct spec', () => {
    const result = validateSpec({
      title: 'T',
      layer: 'docs',
      output: 'o.md',
      boulders: [{ name: 'B', description: 'd', criteria: [{ check: 'c', description: 'd' }] }],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns errors for missing layer field', () => {
    const result = validateSpec({
      title: 'T',
      output: 'o.md',
      boulders: [{ name: 'B', description: 'd', criteria: [{ check: 'c', description: 'd' }] }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('returns errors for empty boulders array', () => {
    const result = validateSpec({
      title: 'T',
      layer: 'docs',
      output: 'o.md',
      boulders: [],
    });
    expect(result.valid).toBe(false);
  });

  it('returns errors for boulder missing criteria', () => {
    const result = validateSpec({
      title: 'T',
      layer: 'docs',
      output: 'o.md',
      boulders: [{ name: 'B', description: 'd' }],
    });
    expect(result.valid).toBe(false);
  });

  it('applies default maxRetries of 3', async () => {
    const spec = await loadSpec(path.join(fixturesDir, 'valid-spec.json'));
    // valid-spec.json has maxRetries: 2, so it should use that
    expect(spec.maxRetries).toBe(2);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run tests/spec.test.ts`
Expected: FAIL — `loadSpec` and `validateSpec` not found

- [ ] **Step 5: Implement spec.ts**

Create `src/spec.ts`:

```typescript
import fs from 'fs/promises';
import path from 'path';
import Ajv from 'ajv';
import type { Spec, ValidationResult } from './types.js';

// Load schema once
const schemaPath = path.join(import.meta.dirname, '..', 'lib', 'spec-schema.json');

let ajvValidate: ReturnType<Ajv['compile']> | null = null;

async function getValidator(): Promise<ReturnType<Ajv['compile']>> {
  if (!ajvValidate) {
    const schemaText = await fs.readFile(schemaPath, 'utf-8');
    const schema = JSON.parse(schemaText);
    const ajv = new Ajv({ allErrors: true, useDefaults: true });
    ajvValidate = ajv.compile(schema);
  }
  return ajvValidate;
}

export function validateSpec(data: unknown): ValidationResult {
  // Synchronous validation for already-loaded data
  const schemaText = require('fs').readFileSync(schemaPath, 'utf-8');
  const schema = JSON.parse(schemaText);
  const ajv = new Ajv({ allErrors: true, useDefaults: true });
  const validate = ajv.compile(schema);
  const valid = validate(data);

  if (valid) {
    return { valid: true, errors: [] };
  }

  const errors = (validate.errors ?? []).map(
    (e) => `${e.instancePath || '/'}: ${e.message ?? 'unknown error'}`
  );
  return { valid: false, errors };
}

export async function loadSpec(filePath: string): Promise<Spec> {
  const absolutePath = path.resolve(filePath);
  const content = await fs.readFile(absolutePath, 'utf-8');
  let data: unknown;

  try {
    data = JSON.parse(content);
  } catch {
    throw new Error(`Invalid JSON in spec file: ${absolutePath}`);
  }

  const validate = await getValidator();
  const valid = validate(data);

  if (!valid) {
    const errors = (validate.errors ?? []).map(
      (e) => `${e.instancePath || '/'}: ${e.message ?? 'unknown error'}`
    );
    throw new Error(`Spec validation failed:\n${errors.join('\n')}`);
  }

  return data as Spec;
}
```

Note: `validateSpec` uses synchronous `fs.readFileSync` for the simpler use case (validate command). `loadSpec` uses async. Both validate against the same schema. This is intentional — `validateSpec` is used by tests and the `validate` CLI command for quick checks.

**Important:** Since we use ESM (`"type": "module"` in package.json), `require('fs')` won't work. Replace the synchronous approach in `validateSpec`:

```typescript
import { readFileSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import Ajv from 'ajv';
import type { Spec, ValidationResult } from './types.js';

const schemaPath = path.join(import.meta.dirname, '..', 'lib', 'spec-schema.json');

function loadSchema(): object {
  const schemaText = readFileSync(schemaPath, 'utf-8');
  return JSON.parse(schemaText);
}

let cachedValidator: ReturnType<Ajv['compile']> | null = null;

function getValidator(): ReturnType<Ajv['compile']> {
  if (!cachedValidator) {
    const schema = loadSchema();
    const ajv = new Ajv({ allErrors: true, useDefaults: true });
    cachedValidator = ajv.compile(schema);
  }
  return cachedValidator;
}

export function validateSpec(data: unknown): ValidationResult {
  const validate = getValidator();
  const valid = validate(structuredClone(data)); // clone so defaults don't mutate input

  if (valid) {
    return { valid: true, errors: [] };
  }

  const errors = (validate.errors ?? []).map(
    (e) => `${e.instancePath || '/'}: ${e.message ?? 'unknown error'}`
  );
  return { valid: false, errors };
}

export async function loadSpec(filePath: string): Promise<Spec> {
  const absolutePath = path.resolve(filePath);
  const content = await fs.readFile(absolutePath, 'utf-8');
  let data: unknown;

  try {
    data = JSON.parse(content);
  } catch {
    throw new Error(`Invalid JSON in spec file: ${absolutePath}`);
  }

  const result = validateSpec(data);
  if (!result.valid) {
    throw new Error(`Spec validation failed:\n${result.errors.join('\n')}`);
  }

  return data as Spec;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/spec.test.ts`
Expected: All 5 tests pass

- [ ] **Step 7: Commit**

```bash
git add lib/spec-schema.json src/spec.ts tests/spec.test.ts tests/fixtures/valid-spec.json tests/fixtures/invalid-spec-no-layer.json
git commit -m "feat: spec loading and JSON schema validation"
```

---

## Task 4: Documentation Layer Checks

**Files:**
- Create: `layers/documentation/checks/contains-table.ts`
- Create: `layers/documentation/checks/row-count.ts`
- Create: `layers/documentation/checks/contains-heading.ts`
- Create: `layers/documentation/checks/word-count.ts`
- Create: `layers/documentation/checks/index.ts`
- Create: `tests/checks/contains-table.test.ts`
- Create: `tests/checks/row-count.test.ts`
- Create: `tests/checks/contains-heading.test.ts`
- Create: `tests/checks/word-count.test.ts`

- [ ] **Step 1: Write contains-table tests**

Create `tests/checks/contains-table.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { containsTable } from '../../layers/documentation/checks/contains-table.js';

const simpleTable = `
# Results

| Name | Status | Notes |
|------|--------|-------|
| Alice | Active | Lead |
| Bob | Inactive | - |
`;

const noTable = `
# Results

No tabular data here. Just paragraphs.
`;

const wrongColumns = `
| Foo | Bar |
|-----|-----|
| 1   | 2   |
`;

describe('containsTable', () => {
  it('passes when table exists with no column requirement', () => {
    const result = containsTable(simpleTable, { check: 'contains-table', description: 'has table' });
    expect(result.pass).toBe(true);
  });

  it('passes when table has required columns', () => {
    const result = containsTable(simpleTable, {
      check: 'contains-table',
      description: 'has table',
      columns: ['Name', 'Status'],
    });
    expect(result.pass).toBe(true);
  });

  it('column matching is case-insensitive', () => {
    const result = containsTable(simpleTable, {
      check: 'contains-table',
      description: 'has table',
      columns: ['name', 'status', 'notes'],
    });
    expect(result.pass).toBe(true);
  });

  it('fails when no table found', () => {
    const result = containsTable(noTable, { check: 'contains-table', description: 'has table' });
    expect(result.pass).toBe(false);
    expect(result.message).toContain('No markdown table found');
  });

  it('fails when required columns are missing', () => {
    const result = containsTable(wrongColumns, {
      check: 'contains-table',
      description: 'has table',
      columns: ['Name', 'Status'],
    });
    expect(result.pass).toBe(false);
    expect(result.message).toContain('Missing columns');
  });
});
```

- [ ] **Step 2: Write row-count tests**

Create `tests/checks/row-count.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { rowCountGte, rowCountLte } from '../../layers/documentation/checks/row-count.js';

const threeRowTable = `
| Name | Value |
|------|-------|
| A    | 1     |
| B    | 2     |
| C    | 3     |
`;

const noTable = `Just text, no table.`;

describe('rowCountGte', () => {
  it('passes when row count meets minimum', () => {
    const result = rowCountGte(threeRowTable, { check: 'row-count-gte', description: 'enough', min: 3 });
    expect(result.pass).toBe(true);
  });

  it('passes when row count exceeds minimum', () => {
    const result = rowCountGte(threeRowTable, { check: 'row-count-gte', description: 'enough', min: 2 });
    expect(result.pass).toBe(true);
  });

  it('fails when row count below minimum', () => {
    const result = rowCountGte(threeRowTable, { check: 'row-count-gte', description: 'enough', min: 5 });
    expect(result.pass).toBe(false);
    expect(result.message).toContain('3');
    expect(result.message).toContain('5');
  });

  it('fails when no table found', () => {
    const result = rowCountGte(noTable, { check: 'row-count-gte', description: 'enough', min: 1 });
    expect(result.pass).toBe(false);
  });
});

describe('rowCountLte', () => {
  it('passes when row count within maximum', () => {
    const result = rowCountLte(threeRowTable, { check: 'row-count-lte', description: 'not too many', max: 5 });
    expect(result.pass).toBe(true);
  });

  it('fails when row count exceeds maximum', () => {
    const result = rowCountLte(threeRowTable, { check: 'row-count-lte', description: 'not too many', max: 2 });
    expect(result.pass).toBe(false);
  });
});
```

- [ ] **Step 3: Write contains-heading tests**

Create `tests/checks/contains-heading.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { containsHeading } from '../../layers/documentation/checks/contains-heading.js';

const markdown = `
# Introduction

Some text here.

## Details

More text.

### Sub-details
`;

describe('containsHeading', () => {
  it('finds heading by text', () => {
    const result = containsHeading(markdown, {
      check: 'contains-heading',
      description: 'has intro',
      heading: 'Introduction',
    });
    expect(result.pass).toBe(true);
  });

  it('finds heading case-insensitively', () => {
    const result = containsHeading(markdown, {
      check: 'contains-heading',
      description: 'has details',
      heading: 'details',
    });
    expect(result.pass).toBe(true);
  });

  it('checks heading level when specified', () => {
    const result = containsHeading(markdown, {
      check: 'contains-heading',
      description: 'h2 details',
      heading: 'Details',
      level: 2,
    });
    expect(result.pass).toBe(true);
  });

  it('fails when heading exists at wrong level', () => {
    const result = containsHeading(markdown, {
      check: 'contains-heading',
      description: 'h1 details',
      heading: 'Details',
      level: 1,
    });
    expect(result.pass).toBe(false);
  });

  it('fails when heading not found', () => {
    const result = containsHeading(markdown, {
      check: 'contains-heading',
      description: 'has conclusion',
      heading: 'Conclusion',
    });
    expect(result.pass).toBe(false);
  });
});
```

- [ ] **Step 4: Write word-count tests**

Create `tests/checks/word-count.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { wordCountGte, wordCountLte } from '../../layers/documentation/checks/word-count.js';

const shortText = 'Hello world.';
const longerText = 'The quick brown fox jumps over the lazy dog. ' +
  'This sentence adds more words to reach a higher count. ' +
  'And one more sentence for good measure.';

describe('wordCountGte', () => {
  it('passes when word count meets minimum', () => {
    const result = wordCountGte(shortText, { check: 'word-count-gte', description: 'enough', min: 2 });
    expect(result.pass).toBe(true);
  });

  it('fails when word count below minimum', () => {
    const result = wordCountGte(shortText, { check: 'word-count-gte', description: 'enough', min: 100 });
    expect(result.pass).toBe(false);
  });

  it('strips markdown syntax before counting', () => {
    const md = '# Heading\n\n**bold** and *italic* and [link](url)\n\n- list item\n- another';
    const result = wordCountGte(md, { check: 'word-count-gte', description: 'enough', min: 5 });
    expect(result.pass).toBe(true);
  });
});

describe('wordCountLte', () => {
  it('passes when word count within maximum', () => {
    const result = wordCountLte(shortText, { check: 'word-count-lte', description: 'not too long', max: 100 });
    expect(result.pass).toBe(true);
  });

  it('fails when word count exceeds maximum', () => {
    const result = wordCountLte(longerText, { check: 'word-count-lte', description: 'not too long', max: 5 });
    expect(result.pass).toBe(false);
  });
});
```

- [ ] **Step 5: Run all check tests to verify they fail**

Run: `npx vitest run tests/checks/`
Expected: FAIL — all modules not found

- [ ] **Step 6: Implement contains-table.ts**

Create `layers/documentation/checks/contains-table.ts`:

```typescript
import type { CheckResult, Criterion } from '../../../src/types.js';

function parseTable(markdown: string): { columns: string[]; rows: string[][] } | null {
  const lines = markdown.split('\n');
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i].trim();
    const separator = lines[i + 1]?.trim();

    // Header row: | col | col |
    if (!line.startsWith('|') || !line.endsWith('|')) continue;
    // Separator row: |---|---|
    if (!separator?.startsWith('|') || !separator.endsWith('|')) continue;
    if (!/\|[\s-:]+\|/.test(separator)) continue;

    const columns = line.split('|').map(c => c.trim()).filter(c => c.length > 0);
    const rows: string[][] = [];

    for (let j = i + 2; j < lines.length; j++) {
      const rowLine = lines[j].trim();
      if (!rowLine.startsWith('|') || !rowLine.endsWith('|')) break;
      const cells = rowLine.split('|').map(c => c.trim()).filter(c => c.length > 0);
      rows.push(cells);
    }

    return { columns, rows };
  }
  return null;
}

export { parseTable };

export function containsTable(markdown: string, criterion: Criterion): CheckResult {
  const table = parseTable(markdown);

  if (!table) {
    return { criterion: criterion.description, pass: false, message: 'No markdown table found' };
  }

  const requiredColumns = criterion.columns as string[] | undefined;
  if (!requiredColumns || requiredColumns.length === 0) {
    return { criterion: criterion.description, pass: true, message: `Table found with columns: ${table.columns.join(', ')}` };
  }

  const actualLower = table.columns.map(c => c.toLowerCase());
  const missing = requiredColumns.filter(c => !actualLower.includes(c.toLowerCase()));

  if (missing.length > 0) {
    return {
      criterion: criterion.description,
      pass: false,
      message: `Missing columns: ${missing.join(', ')}. Found: ${table.columns.join(', ')}`,
    };
  }

  return { criterion: criterion.description, pass: true, message: `Table has required columns: ${requiredColumns.join(', ')}` };
}
```

- [ ] **Step 7: Implement row-count.ts**

Create `layers/documentation/checks/row-count.ts`:

```typescript
import type { CheckResult, Criterion } from '../../../src/types.js';
import { parseTable } from './contains-table.js';

export function rowCountGte(markdown: string, criterion: Criterion): CheckResult {
  const table = parseTable(markdown);
  if (!table) {
    return { criterion: criterion.description, pass: false, message: 'No markdown table found' };
  }

  const min = (criterion.min as number) ?? 0;
  const count = table.rows.length;

  if (count >= min) {
    return { criterion: criterion.description, pass: true, message: `Row count ${count} >= ${min}` };
  }

  return { criterion: criterion.description, pass: false, message: `Row count ${count} < required minimum ${min}` };
}

export function rowCountLte(markdown: string, criterion: Criterion): CheckResult {
  const table = parseTable(markdown);
  if (!table) {
    return { criterion: criterion.description, pass: false, message: 'No markdown table found' };
  }

  const max = (criterion.max as number) ?? Infinity;
  const count = table.rows.length;

  if (count <= max) {
    return { criterion: criterion.description, pass: true, message: `Row count ${count} <= ${max}` };
  }

  return { criterion: criterion.description, pass: false, message: `Row count ${count} > maximum ${max}` };
}
```

- [ ] **Step 8: Implement contains-heading.ts**

Create `layers/documentation/checks/contains-heading.ts`:

```typescript
import type { CheckResult, Criterion } from '../../../src/types.js';

export function containsHeading(markdown: string, criterion: Criterion): CheckResult {
  const headingText = criterion.heading as string | undefined;
  if (!headingText) {
    return { criterion: criterion.description, pass: false, message: 'No heading text specified in criterion' };
  }

  const level = criterion.level as number | undefined;
  const lines = markdown.split('\n');
  const targetLower = headingText.toLowerCase();

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (!match) continue;

    const headingLevel = match[1].length;
    const text = match[2].trim().toLowerCase();

    if (text.includes(targetLower)) {
      if (level !== undefined && headingLevel !== level) continue;
      return {
        criterion: criterion.description,
        pass: true,
        message: `Found heading "${'#'.repeat(headingLevel)} ${match[2].trim()}"`,
      };
    }
  }

  const levelNote = level !== undefined ? ` at level ${level}` : '';
  return {
    criterion: criterion.description,
    pass: false,
    message: `Heading "${headingText}"${levelNote} not found`,
  };
}
```

- [ ] **Step 9: Implement word-count.ts**

Create `layers/documentation/checks/word-count.ts`:

```typescript
import type { CheckResult, Criterion } from '../../../src/types.js';

function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/^#{1,6}\s+/gm, '')       // headings
    .replace(/\*\*(.+?)\*\*/g, '$1')   // bold
    .replace(/\*(.+?)\*/g, '$1')       // italic
    .replace(/__(.+?)__/g, '$1')       // bold alt
    .replace(/_(.+?)_/g, '$1')         // italic alt
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // links
    .replace(/!\[.*?\]\(.+?\)/g, '')   // images
    .replace(/`{1,3}[^`]*`{1,3}/g, '') // inline/block code
    .replace(/^\|.*\|$/gm, '')         // table rows
    .replace(/^[-*+]\s+/gm, '')        // list markers
    .replace(/^\d+\.\s+/gm, '')        // ordered list markers
    .replace(/^>\s+/gm, '');           // blockquotes
}

function countWords(text: string): number {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  return words.length;
}

export function wordCountGte(markdown: string, criterion: Criterion): CheckResult {
  const stripped = stripMarkdown(markdown);
  const count = countWords(stripped);
  const min = (criterion.min as number) ?? 0;

  if (count >= min) {
    return { criterion: criterion.description, pass: true, message: `Word count ${count} >= ${min}` };
  }

  return { criterion: criterion.description, pass: false, message: `Word count ${count} < required minimum ${min}` };
}

export function wordCountLte(markdown: string, criterion: Criterion): CheckResult {
  const stripped = stripMarkdown(markdown);
  const count = countWords(stripped);
  const max = (criterion.max as number) ?? Infinity;

  if (count <= max) {
    return { criterion: criterion.description, pass: true, message: `Word count ${count} <= ${max}` };
  }

  return { criterion: criterion.description, pass: false, message: `Word count ${count} > maximum ${max}` };
}
```

- [ ] **Step 10: Create checks index**

Create `layers/documentation/checks/index.ts`:

```typescript
import type { CheckFn } from '../../../src/types.js';
import { containsTable } from './contains-table.js';
import { rowCountGte, rowCountLte } from './row-count.js';
import { containsHeading } from './contains-heading.js';
import { wordCountGte, wordCountLte } from './word-count.js';

export function getDocumentationChecks(): Map<string, CheckFn> {
  return new Map([
    ['contains-table', containsTable],
    ['row-count-gte', rowCountGte],
    ['row-count-lte', rowCountLte],
    ['contains-heading', containsHeading],
    ['word-count-gte', wordCountGte],
    ['word-count-lte', wordCountLte],
  ]);
}
```

- [ ] **Step 11: Run all check tests to verify they pass**

Run: `npx vitest run tests/checks/`
Expected: All tests pass (18 tests across 4 files)

- [ ] **Step 12: Commit**

```bash
git add layers/documentation/checks/ tests/checks/
git commit -m "feat: documentation layer structural checks"
```

---

## Task 5: Start (Claude Spawning)

**Files:**
- Create: `src/start.ts`
- Create: `tests/start.test.ts`

- [ ] **Step 1: Write start tests**

Create `tests/start.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { start } from '../src/start.js';
import * as childProcess from 'child_process';

vi.mock('child_process', () => ({
  execFile: vi.fn(),
}));

const mockExecFile = vi.mocked(childProcess.execFile);

function mockSuccess(stdout: string) {
  mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
    if (typeof _opts === 'function') {
      // callback is third arg
      _opts(null, stdout, '');
    } else if (callback) {
      callback(null, stdout, '');
    }
    return {} as any;
  });
}

function mockError(message: string) {
  mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
    const err = new Error(message);
    if (typeof _opts === 'function') {
      _opts(err, '', message);
    } else if (callback) {
      callback(err, '', message);
    }
    return {} as any;
  });
}

describe('start', () => {
  it('spawns claude with prompt and returns stdout', async () => {
    mockSuccess('Generated content here');
    const result = await start({ prompt: 'Write something' });
    expect(result).toBe('Generated content here');

    const call = mockExecFile.mock.calls[0];
    expect(call[0]).toBe('claude');
    expect(call[1]).toContain('-p');
    expect(call[1]).toContain('Write something');
  });

  it('includes model flag when specified', async () => {
    mockSuccess('output');
    await start({ prompt: 'test', model: 'haiku' });

    const args = mockExecFile.mock.calls[0][1] as string[];
    expect(args).toContain('--model');
    expect(args).toContain('haiku');
  });

  it('includes output format flag when specified', async () => {
    mockSuccess('{"pass": true}');
    await start({ prompt: 'test', outputFormat: 'json' });

    const args = mockExecFile.mock.calls[0][1] as string[];
    expect(args).toContain('--output-format');
    expect(args).toContain('json');
  });

  it('throws on claude error', async () => {
    mockError('Claude crashed');
    await expect(start({ prompt: 'test' })).rejects.toThrow('Claude crashed');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/start.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement start.ts**

Create `src/start.ts`:

```typescript
import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';

const execFile = promisify(execFileCb);

export interface StartOptions {
  prompt: string;
  model?: 'opus' | 'sonnet' | 'haiku';
  outputFormat?: 'text' | 'json';
  timeout?: number;
}

export async function start(options: StartOptions): Promise<string> {
  const args = ['-p', options.prompt];

  if (options.model) {
    args.push('--model', options.model);
  }

  if (options.outputFormat) {
    args.push('--output-format', options.outputFormat);
  }

  const result = await execFile('claude', args, {
    timeout: options.timeout ?? 120_000,
    maxBuffer: 10 * 1024 * 1024,
  });

  return result.stdout;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/start.test.ts`
Expected: All 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/start.ts tests/start.test.ts
git commit -m "feat: claude spawning via claude -p"
```

---

## Task 6: Stack (Data Gathering)

**Files:**
- Create: `src/stack.ts`
- Create: `tests/stack.test.ts`
- Create: `tests/fixtures/sample-source.txt`
- Create: `tests/fixtures/large-source.txt`

- [ ] **Step 1: Create test fixtures**

Create `tests/fixtures/sample-source.txt`:

```
Line 1: Project overview
Line 2: Architecture details
Line 3: Implementation notes
```

Create `tests/fixtures/large-source.txt` — a file with 201+ lines:

```typescript
// In the test file, generate this programmatically
```

- [ ] **Step 2: Write stack tests**

Create `tests/stack.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { stack } from '../src/stack.js';
import path from 'path';
import fs from 'fs/promises';

// Mock the start module for gather agent spawning
vi.mock('../src/start.js', () => ({
  start: vi.fn().mockResolvedValue('Extracted: key data points'),
}));

const fixturesDir = path.join(import.meta.dirname, 'fixtures');

describe('stack', () => {
  it('reads a small file directly', async () => {
    const results = await stack(
      [{ type: 'analysis', source: path.join(fixturesDir, 'sample-source.txt'), instruction: 'Read it' }],
      fixturesDir,
    );
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('analysis');
    expect(results[0].data).toContain('Project overview');
  });

  it('resolves glob patterns', async () => {
    const results = await stack(
      [{ type: 'analysis', source: path.join(fixturesDir, '*.json'), instruction: 'Read' }],
      fixturesDir,
    );
    expect(results.length).toBeGreaterThan(0);
    results.forEach(r => expect(r.source).toMatch(/\.json$/));
  });

  it('returns empty array for no stack sources', async () => {
    const results = await stack([], fixturesDir);
    expect(results).toEqual([]);
  });

  it('returns empty array for undefined stack sources', async () => {
    const results = await stack(undefined, fixturesDir);
    expect(results).toEqual([]);
  });

  it('spawns gather agent for large files', async () => {
    // Create a large file temporarily
    const largePath = path.join(fixturesDir, 'large-source.txt');
    const lines = Array.from({ length: 250 }, (_, i) => `Line ${i + 1}: data`).join('\n');
    await fs.writeFile(largePath, lines);

    const { start: mockStart } = await import('../src/start.js');

    const results = await stack(
      [{ type: 'analysis', source: largePath, instruction: 'Extract key info' }],
      fixturesDir,
    );

    expect(results).toHaveLength(1);
    expect(mockStart).toHaveBeenCalled();

    // Clean up
    await fs.unlink(largePath);
  });

  it('warns and skips unsupported stack types', async () => {
    const results = await stack(
      [{ type: 'ado-search', query: 'test' }],
      fixturesDir,
    );
    expect(results).toHaveLength(1);
    expect(results[0].data).toContain('not supported');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/stack.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implement stack.ts**

Create `src/stack.ts`:

```typescript
import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import { start } from './start.js';
import type { StackSource, StackResult } from './types.js';

const LARGE_FILE_THRESHOLD = 200;

async function resolveSource(source: string, baseDir: string): Promise<string[]> {
  // Check if source contains glob characters
  if (/[*?[\]{}]/.test(source)) {
    const absolutePattern = path.isAbsolute(source) ? source : path.join(baseDir, source);
    const matches = await glob(absolutePattern, { nodir: true });
    return matches;
  }

  // Single file
  const absolutePath = path.isAbsolute(source) ? source : path.join(baseDir, source);
  return [absolutePath];
}

async function readAndStack(filePath: string, instruction?: string): Promise<StackResult> {
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split('\n');

  if (lines.length <= LARGE_FILE_THRESHOLD) {
    return { type: 'analysis', source: filePath, data: content };
  }

  // Large file: spawn gather agent
  const extracted = await start({
    prompt: `Read this file and ${instruction ?? 'extract the key information'}. Return ONLY the extracted data.\n\n${content}`,
    model: 'haiku',
  });

  return { type: 'analysis', source: filePath, data: extracted };
}

export async function stack(
  sources: StackSource[] | undefined,
  baseDir: string,
): Promise<StackResult[]> {
  if (!sources || sources.length === 0) return [];

  const results: StackResult[] = [];

  for (const source of sources) {
    if (source.type !== 'analysis') {
      results.push({
        type: source.type,
        source: String(source.query ?? source.source ?? 'unknown'),
        data: `Stack type "${source.type}" not supported in MVP. Skipping.`,
      });
      continue;
    }

    if (!source.source) {
      results.push({
        type: 'analysis',
        source: 'unknown',
        data: 'No source path specified',
      });
      continue;
    }

    const files = await resolveSource(source.source, baseDir);
    for (const filePath of files) {
      const result = await readAndStack(filePath, source.instruction);
      results.push(result);
    }
  }

  return results;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/stack.test.ts`
Expected: All 6 tests pass

- [ ] **Step 6: Commit**

```bash
git add src/stack.ts tests/stack.test.ts tests/fixtures/sample-source.txt
git commit -m "feat: stack pipeline with glob resolution and gather agents"
```

---

## Task 7: Check Registry

**Files:**
- Create: `src/checks.ts`
- Create: `tests/checks.test.ts`

- [ ] **Step 1: Write check registry tests**

Create `tests/checks.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { CheckRegistry } from '../src/checks.js';
import type { CheckFn } from '../src/types.js';

describe('CheckRegistry', () => {
  it('registers and retrieves checks', () => {
    const registry = new CheckRegistry();
    const mockCheck: CheckFn = (md, c) => ({ criterion: c.description, pass: true, message: 'ok' });

    registry.register('my-check', mockCheck);
    expect(registry.has('my-check')).toBe(true);
    expect(registry.get('my-check')).toBe(mockCheck);
  });

  it('registers multiple checks from a Map', () => {
    const registry = new CheckRegistry();
    const checks = new Map<string, CheckFn>([
      ['check-a', (md, c) => ({ criterion: c.description, pass: true, message: 'a' })],
      ['check-b', (md, c) => ({ criterion: c.description, pass: false, message: 'b' })],
    ]);

    registry.registerAll(checks);
    expect(registry.has('check-a')).toBe(true);
    expect(registry.has('check-b')).toBe(true);
  });

  it('runs structural checks and collects results', () => {
    const registry = new CheckRegistry();
    registry.register('always-pass', (md, c) => ({ criterion: c.description, pass: true, message: 'ok' }));
    registry.register('always-fail', (md, c) => ({ criterion: c.description, pass: false, message: 'nope' }));

    const criteria = [
      { check: 'always-pass', description: 'should pass' },
      { check: 'always-fail', description: 'should fail' },
      { check: 'custom', description: 'skipped by registry' },
    ];

    const results = registry.runChecks('some markdown', criteria);
    expect(results).toHaveLength(2); // custom is skipped
    expect(results[0].pass).toBe(true);
    expect(results[1].pass).toBe(false);
  });

  it('skips custom criteria (handled by Hades)', () => {
    const registry = new CheckRegistry();
    const criteria = [
      { check: 'custom', description: 'LLM evaluates this' },
    ];

    const results = registry.runChecks('markdown', criteria);
    expect(results).toHaveLength(0);
  });

  it('fails for unknown non-custom check types', () => {
    const registry = new CheckRegistry();
    const criteria = [
      { check: 'nonexistent-check', description: 'should error' },
    ];

    const results = registry.runChecks('markdown', criteria);
    expect(results).toHaveLength(1);
    expect(results[0].pass).toBe(false);
    expect(results[0].message).toContain('Unknown check');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/checks.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement checks.ts**

Create `src/checks.ts`:

```typescript
import type { CheckFn, CheckResult, Criterion } from './types.js';

export class CheckRegistry {
  private checks = new Map<string, CheckFn>();

  register(name: string, fn: CheckFn): void {
    this.checks.set(name, fn);
  }

  registerAll(checks: Map<string, CheckFn>): void {
    for (const [name, fn] of checks) {
      this.checks.set(name, fn);
    }
  }

  has(name: string): boolean {
    return this.checks.has(name);
  }

  get(name: string): CheckFn | undefined {
    return this.checks.get(name);
  }

  runChecks(markdown: string, criteria: Criterion[]): CheckResult[] {
    const results: CheckResult[] = [];

    for (const criterion of criteria) {
      // Custom criteria are handled by Hades (LLM evaluator), not structural checks
      if (criterion.check === 'custom') continue;

      const checkFn = this.checks.get(criterion.check);
      if (!checkFn) {
        results.push({
          criterion: criterion.description,
          pass: false,
          message: `Unknown check type: "${criterion.check}"`,
        });
        continue;
      }

      results.push(checkFn(markdown, criterion));
    }

    return results;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/checks.test.ts`
Expected: All 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/checks.ts tests/checks.test.ts
git commit -m "feat: check registry for structural verification"
```

---

## Task 8: Lessons System

**Files:**
- Create: `src/lessons.ts`
- Create: `tests/lessons.test.ts`
- Create: `lessons/global.json`
- Create: `lessons/documentation.json`

- [ ] **Step 1: Create empty lesson stores**

Create `lessons/global.json`:

```json
[]
```

Create `lessons/documentation.json`:

```json
[]
```

- [ ] **Step 2: Write lessons tests**

Create `tests/lessons.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { loadLessons, filterLessons, formatLessonsForPrompt } from '../src/lessons.js';
import type { Lesson } from '../src/types.js';

const sampleLessons: Lesson[] = [
  {
    id: 'L1',
    text: 'Always check row counts against source data',
    source: 'auto',
    layer: 'documentation',
    created: '2026-04-01',
    lastUsed: '2026-04-10',
    useCount: 5,
    relevance: ['row-count', 'criteria'],
  },
  {
    id: 'L2',
    text: 'Tables need complete column coverage',
    source: 'user',
    layer: 'documentation',
    created: '2026-04-05',
    lastUsed: '2026-04-08',
    useCount: 2,
    relevance: ['contains-table', 'columns'],
  },
  {
    id: 'L3',
    text: 'Keep prompts under 4000 tokens',
    source: 'auto',
    created: '2026-03-01',
    lastUsed: '2026-03-15',
    useCount: 1,
    relevance: ['prompt', 'tokens'],
  },
];

describe('filterLessons', () => {
  it('filters by relevance tags', () => {
    const filtered = filterLessons(sampleLessons, ['row-count']);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('L1');
  });

  it('returns all lessons when no tags specified', () => {
    const filtered = filterLessons(sampleLessons, []);
    expect(filtered).toHaveLength(3);
  });

  it('sorts by useCount descending', () => {
    const filtered = filterLessons(sampleLessons, []);
    expect(filtered[0].useCount).toBeGreaterThanOrEqual(filtered[1].useCount);
  });
});

describe('formatLessonsForPrompt', () => {
  it('formats lessons as numbered list', () => {
    const text = formatLessonsForPrompt(sampleLessons.slice(0, 2));
    expect(text).toContain('1.');
    expect(text).toContain('Always check row counts');
    expect(text).toContain('2.');
    expect(text).toContain('Tables need complete');
  });

  it('respects token budget by limiting count', () => {
    const manyLessons: Lesson[] = Array.from({ length: 100 }, (_, i) => ({
      id: `L${i}`,
      text: `Lesson number ${i} with enough text to take up space in the prompt budget`,
      source: 'auto' as const,
      created: '2026-01-01',
      lastUsed: '2026-01-01',
      useCount: 1,
      relevance: [],
    }));

    const text = formatLessonsForPrompt(manyLessons, 500); // ~500 char budget
    // Should be truncated
    expect(text.length).toBeLessThan(700); // some overhead allowed
  });

  it('returns empty string for no lessons', () => {
    expect(formatLessonsForPrompt([])).toBe('');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/lessons.test.ts`
Expected: FAIL

- [ ] **Step 4: Implement lessons.ts**

Create `src/lessons.ts`:

```typescript
import fs from 'fs/promises';
import path from 'path';
import type { Lesson } from './types.js';

const DEFAULT_BUDGET_CHARS = 2000;

export async function loadLessons(lessonsDir: string, layerName?: string): Promise<Lesson[]> {
  const lessons: Lesson[] = [];

  // Load global lessons
  const globalPath = path.join(lessonsDir, 'global.json');
  try {
    const content = await fs.readFile(globalPath, 'utf-8');
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) lessons.push(...parsed);
  } catch {
    // No global lessons file — that's fine
  }

  // Load layer-specific lessons
  if (layerName) {
    const layerPath = path.join(lessonsDir, `${layerName}.json`);
    try {
      const content = await fs.readFile(layerPath, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) lessons.push(...parsed);
    } catch {
      // No layer lessons file — that's fine
    }
  }

  return lessons;
}

export function filterLessons(lessons: Lesson[], relevanceTags: string[]): Lesson[] {
  let filtered: Lesson[];

  if (relevanceTags.length === 0) {
    filtered = [...lessons];
  } else {
    const tagSet = new Set(relevanceTags.map(t => t.toLowerCase()));
    filtered = lessons.filter(lesson =>
      lesson.relevance.some(r => tagSet.has(r.toLowerCase()))
    );

    // If no tag matches, return all (better to have all lessons than none)
    if (filtered.length === 0) {
      filtered = [...lessons];
    }
  }

  // Sort by useCount descending, then by lastUsed descending
  filtered.sort((a, b) => {
    if (b.useCount !== a.useCount) return b.useCount - a.useCount;
    return b.lastUsed.localeCompare(a.lastUsed);
  });

  return filtered;
}

export function formatLessonsForPrompt(lessons: Lesson[], budgetChars: number = DEFAULT_BUDGET_CHARS): string {
  if (lessons.length === 0) return '';

  const lines: string[] = [];
  let totalChars = 0;

  for (let i = 0; i < lessons.length; i++) {
    const line = `${i + 1}. ${lessons[i].text}`;
    if (totalChars + line.length > budgetChars && lines.length > 0) break;
    lines.push(line);
    totalChars += line.length + 1; // +1 for newline
  }

  return lines.join('\n');
}

export async function saveLessons(lessonsDir: string, fileName: string, lessons: Lesson[]): Promise<void> {
  const filePath = path.join(lessonsDir, fileName);
  await fs.writeFile(filePath, JSON.stringify(lessons, null, 2), 'utf-8');
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/lessons.test.ts`
Expected: All 6 tests pass

- [ ] **Step 6: Commit**

```bash
git add src/lessons.ts tests/lessons.test.ts lessons/global.json lessons/documentation.json
git commit -m "feat: lessons system with filtering and budget"
```

---

## Task 9: Prompt Builder

**Files:**
- Create: `src/prompt-builder.ts`
- Create: `tests/prompt-builder.test.ts`

- [ ] **Step 1: Write prompt builder tests**

Create `tests/prompt-builder.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildProducerPrompt, buildEvaluatorPrompt } from '../src/prompt-builder.js';
import type { Boulder, StackResult, Criterion } from '../src/types.js';

const boulder: Boulder = {
  name: 'Entity Inventory',
  description: 'Complete list of entities with migration status',
  criteria: [{ check: 'custom', description: 'looks good' }],
};

const stackResults: StackResult[] = [
  { type: 'analysis', source: 'schema.json', data: '{"entities": ["alm_meetings", "alm_notes"]}' },
];

describe('buildProducerPrompt', () => {
  it('includes template content', () => {
    const prompt = buildProducerPrompt('You are a producer.', boulder, stackResults);
    expect(prompt).toContain('You are a producer.');
  });

  it('includes boulder description', () => {
    const prompt = buildProducerPrompt('Template', boulder, stackResults);
    expect(prompt).toContain('Complete list of entities');
  });

  it('includes stacked data', () => {
    const prompt = buildProducerPrompt('Template', boulder, stackResults);
    expect(prompt).toContain('alm_meetings');
  });

  it('does NOT include criteria', () => {
    const prompt = buildProducerPrompt('Template', boulder, stackResults);
    expect(prompt).not.toContain('looks good');
  });

  it('includes climb feedback when retrying', () => {
    const feedback = 'FAIL: row-count-gte — Row count 2 < required minimum 10';
    const prompt = buildProducerPrompt('Template', boulder, stackResults, feedback);
    expect(prompt).toContain('Previous Attempt Failed');
    expect(prompt).toContain('row-count-gte');
  });

  it('includes lessons when provided', () => {
    const lessons = '1. Always check row counts\n2. Use tables for structured data';
    const prompt = buildProducerPrompt('Template', boulder, stackResults, undefined, lessons);
    expect(prompt).toContain('Always check row counts');
  });
});

describe('buildEvaluatorPrompt', () => {
  it('includes template content', () => {
    const criteria: Criterion[] = [{ check: 'custom', description: 'Content is accurate' }];
    const prompt = buildEvaluatorPrompt('You are an evaluator.', 'Some markdown', criteria, stackResults);
    expect(prompt).toContain('You are an evaluator.');
  });

  it('includes the produced output', () => {
    const criteria: Criterion[] = [{ check: 'custom', description: 'ok' }];
    const prompt = buildEvaluatorPrompt('Template', 'The produced markdown content', criteria, stackResults);
    expect(prompt).toContain('The produced markdown content');
  });

  it('includes criteria', () => {
    const criteria: Criterion[] = [{ check: 'custom', description: 'Every entity has a valid status' }];
    const prompt = buildEvaluatorPrompt('Template', 'markdown', criteria, stackResults);
    expect(prompt).toContain('Every entity has a valid status');
  });

  it('does NOT include boulder description', () => {
    const criteria: Criterion[] = [{ check: 'custom', description: 'ok' }];
    const prompt = buildEvaluatorPrompt('Template', 'markdown', criteria, stackResults);
    // Evaluator should not see the goal/description
    expect(prompt).not.toContain('Complete list of entities');
  });

  it('includes stacked data for cross-reference', () => {
    const criteria: Criterion[] = [{ check: 'custom', description: 'ok' }];
    const prompt = buildEvaluatorPrompt('Template', 'markdown', criteria, stackResults);
    expect(prompt).toContain('alm_meetings');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/prompt-builder.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement prompt-builder.ts**

Create `src/prompt-builder.ts`:

```typescript
import type { Boulder, StackResult, Criterion } from './types.js';

export function buildProducerPrompt(
  template: string,
  boulder: Boulder,
  stackResults: StackResult[],
  climbFeedback?: string,
  lessons?: string,
): string {
  let prompt = template;

  if (lessons) {
    prompt += `\n\n--- Lessons Learned ---\n${lessons}`;
  }

  prompt += `\n\n--- Boulder Description ---\n${boulder.description}`;

  prompt += `\n\n--- Stacked Data ---\n${JSON.stringify(stackResults, null, 2)}`;

  if (climbFeedback) {
    prompt += `\n\n--- Previous Attempt Failed ---\n${climbFeedback}`;
    prompt += `\nFix the specific issues identified above. Do not start from scratch.`;
  }

  prompt += `\n\n--- Output ---\nProduce the content as described. Output ONLY the content, no commentary.`;

  return prompt;
}

export function buildEvaluatorPrompt(
  template: string,
  output: string,
  criteria: Criterion[],
  stackResults: StackResult[],
  lessons?: string,
): string {
  let prompt = template;

  if (lessons) {
    prompt += `\n\n--- Lessons Learned ---\n${lessons}`;
  }

  prompt += `\n\n--- Content to Evaluate ---\n${output}`;

  prompt += `\n\n--- Criteria ---\n${criteria.map((c, i) => `${i + 1}. ${c.description}`).join('\n')}`;

  prompt += `\n\n--- Source Data (for cross-reference) ---\n${JSON.stringify(stackResults, null, 2)}`;

  prompt += `\n\n--- Output ---\nReturn a JSON array of results. For each criterion:\n`;
  prompt += `{"criterion": "description", "pass": true/false, "evidence": "quoted text", "reason": "explanation"}\n`;
  prompt += `Be adversarial. Find failures, don't confirm success. Evidence is mandatory for passes.`;

  return prompt;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/prompt-builder.test.ts`
Expected: All 10 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/prompt-builder.ts tests/prompt-builder.test.ts
git commit -m "feat: prompt builder with producer/evaluator isolation"
```

---

## Task 10: Report Generation

**Files:**
- Create: `src/report.ts`
- Create: `tests/report.test.ts`

- [ ] **Step 1: Write report tests**

Create `tests/report.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildReport, writeReport } from '../src/report.js';
import type { BoulderOutput } from '../src/types.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('buildReport', () => {
  it('summarizes boulder outcomes', () => {
    const outputs: BoulderOutput[] = [
      { name: 'B1', content: 'ok', attempts: 1, status: 'passed' },
      { name: 'B2', content: 'ok', attempts: 3, status: 'passed' },
      { name: 'B3', content: 'partial', attempts: 3, status: 'flagged', failures: [{ criterion: 'c', pass: false, message: 'bad' }] },
    ];

    const report = buildReport('Test Run', outputs);
    expect(report.title).toBe('Test Run');
    expect(report.totalBoulders).toBe(3);
    expect(report.passedClean).toBe(1);
    expect(report.passedAfterClimb).toBe(1);
    expect(report.flagged).toBe(1);
  });
});

describe('writeReport', () => {
  it('writes report to disk', async () => {
    const outputs: BoulderOutput[] = [
      { name: 'B1', content: 'ok', attempts: 1, status: 'passed' },
    ];
    const report = buildReport('Test', outputs);
    const outPath = path.join(os.tmpdir(), `sisyphus-test-report-${Date.now()}.json`);

    await writeReport(report, outPath);
    const content = await fs.readFile(outPath, 'utf-8');
    const parsed = JSON.parse(content);

    expect(parsed.title).toBe('Test');
    expect(parsed.totalBoulders).toBe(1);

    await fs.unlink(outPath);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/report.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement report.ts**

Create `src/report.ts`:

```typescript
import fs from 'fs/promises';
import path from 'path';
import type { BoulderOutput, RunReport } from './types.js';

export function buildReport(title: string, outputs: BoulderOutput[]): RunReport {
  return {
    title,
    startedAt: '', // set by engine at run start
    completedAt: new Date().toISOString(),
    boulders: outputs,
    totalBoulders: outputs.length,
    passedClean: outputs.filter(o => o.status === 'passed' && o.attempts === 1).length,
    passedAfterClimb: outputs.filter(o => o.status === 'passed' && o.attempts > 1).length,
    flagged: outputs.filter(o => o.status === 'flagged').length,
  };
}

export async function writeReport(report: RunReport, outputPath: string): Promise<void> {
  const dir = path.dirname(outputPath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2), 'utf-8');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/report.test.ts`
Expected: All 2 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/report.ts tests/report.test.ts
git commit -m "feat: run report generation"
```

---

## Task 11: Documentation Layer (index.ts + assembler)

**Files:**
- Create: `layers/documentation/index.ts`
- Create: `layers/documentation/assembler.ts`
- Create: `layers/documentation/prompts/sisyphus.md`
- Create: `layers/documentation/prompts/hades.md`
- Create: `tests/documentation-layer.test.ts`

- [ ] **Step 1: Write documentation layer tests**

Create `tests/documentation-layer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { DocumentationLayer } from '../layers/documentation/index.js';
import type { Boulder, StackResult } from '../src/types.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const layer = new DocumentationLayer();

describe('DocumentationLayer', () => {
  it('has name "documentation"', () => {
    expect(layer.name).toBe('documentation');
  });

  it('validates a valid spec', () => {
    const result = layer.validateSpec({
      title: 'T',
      layer: 'documentation',
      output: 'o.md',
      boulders: [{ name: 'B', description: 'd', criteria: [{ check: 'contains-table', description: 'ok' }] }],
    });
    expect(result.valid).toBe(true);
  });

  it('registers all structural checks', () => {
    const checks = layer.getChecks();
    expect(checks.has('contains-table')).toBe(true);
    expect(checks.has('row-count-gte')).toBe(true);
    expect(checks.has('row-count-lte')).toBe(true);
    expect(checks.has('contains-heading')).toBe(true);
    expect(checks.has('word-count-gte')).toBe(true);
    expect(checks.has('word-count-lte')).toBe(true);
  });

  it('builds producer prompt without criteria', () => {
    const boulder: Boulder = {
      name: 'Test',
      description: 'Write a test section',
      criteria: [{ check: 'custom', description: 'SECRET CRITERION' }],
    };
    const stack: StackResult[] = [{ type: 'analysis', source: 'f.json', data: '{}' }];

    const prompt = layer.buildProducerPrompt(boulder, stack);
    expect(prompt).toContain('Write a test section');
    expect(prompt).not.toContain('SECRET CRITERION');
  });

  it('builds evaluator prompt with criteria but without description', () => {
    const criteria = [{ check: 'custom', description: 'Content must be accurate' }];
    const stack: StackResult[] = [{ type: 'analysis', source: 'f.json', data: '{}' }];

    const prompt = layer.buildEvaluatorPrompt('some markdown', criteria, stack);
    expect(prompt).toContain('Content must be accurate');
    expect(prompt).toContain('some markdown');
  });

  it('assembles boulder outputs into a document', async () => {
    const outputs = [
      { name: 'Intro', content: '# Introduction\n\nHello world.', attempts: 1, status: 'passed' as const },
      { name: 'Details', content: '# Details\n\nMore info.', attempts: 1, status: 'passed' as const },
    ];
    const outPath = path.join(os.tmpdir(), `sisyphus-test-doc-${Date.now()}.md`);

    await layer.assemble(outputs, outPath);

    const content = await fs.readFile(outPath, 'utf-8');
    expect(content).toContain('# Introduction');
    expect(content).toContain('# Details');
    expect(content).toContain('Hello world.');
    expect(content).toContain('More info.');

    await fs.unlink(outPath);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/documentation-layer.test.ts`
Expected: FAIL

- [ ] **Step 3: Create producer prompt template**

Create `layers/documentation/prompts/sisyphus.md`:

```markdown
# Sisyphus — Document Producer

You are Sisyphus, a document section producer. Your job is to write clear, accurate, well-structured markdown content from the data provided.

## Guidelines

- **Accuracy over polish** — trace every claim back to the stacked data. Do not invent information.
- **Structure for scannability** — use tables, headings, and bullet lists. Walls of text fail evaluation.
- **Synthesis, not regurgitation** — cross-reference sources, identify patterns, surface insights.
- **If retrying** — fix the specific issues in the feedback. Do not start over from scratch unless the feedback indicates a fundamental structural problem.

## Anti-Patterns

- Do NOT evaluate your own output — that is Hades's job.
- Do NOT pad content to meet unstated thresholds.
- Do NOT reference criteria you were not given.
- Do NOT add meta-commentary ("this section may need review").

## Output

Write the section content as markdown. Output ONLY the markdown content — no preamble, no commentary, no explanations.
```

- [ ] **Step 4: Create evaluator prompt template**

Create `layers/documentation/prompts/hades.md`:

```markdown
# Hades — Document Evaluator

You are Hades, an adversarial evaluator. Your job is to check produced content against specific criteria and source data. You render verdicts — pass or fail — with evidence.

## Stance

You are a judge, not a helper. Find failures, don't confirm success. A pass requires evidence. A fail requires specificity.

## Process

For each criterion:

1. Read the criterion description carefully
2. Search the content for evidence that it is met
3. Cross-reference against source data where applicable
4. Render a verdict with evidence

## Output Format

Return a JSON array. For each criterion:

```json
{
  "criterion": "the criterion description",
  "pass": true or false,
  "evidence": "exact quoted text from the content that supports your verdict",
  "reason": "specific explanation of why this passes or fails"
}
```

## Anti-Patterns

- Do NOT be lenient — you are checking, not helping
- Do NOT pass with caveats — it either passes or it fails
- Do NOT interpret intent — check only the specific criteria given
- Do NOT suggest improvements — just judge what is there
- Do NOT skip any criterion
- Do NOT batch failures vaguely — be specific about what is missing

## Evidence Rules

- For a **pass**: quote the specific text or data that satisfies the criterion
- For a **fail**: state exactly what is missing, wrong, or incomplete
- Evidence is MANDATORY for passes. A pass without evidence is a fail.
```

- [ ] **Step 5: Implement assembler.ts**

Create `layers/documentation/assembler.ts`:

```typescript
import fs from 'fs/promises';
import path from 'path';
import type { BoulderOutput } from '../../src/types.js';

export async function assembleDocument(outputs: BoulderOutput[], outputPath: string): Promise<void> {
  const sections = outputs
    .filter(o => o.status === 'passed')
    .map(o => o.content);

  const document = sections.join('\n\n---\n\n');

  const dir = path.dirname(outputPath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(outputPath, document, 'utf-8');
}
```

- [ ] **Step 6: Implement documentation layer index.ts**

Create `layers/documentation/index.ts`:

```typescript
import { readFileSync } from 'fs';
import path from 'path';
import type { Spec, Boulder, StackResult, Criterion, BoulderOutput, Layer, ValidationResult, CheckFn } from '../../src/types.js';
import { getDocumentationChecks } from './checks/index.js';
import { assembleDocument } from './assembler.js';
import { buildProducerPrompt as coreBuildProducer, buildEvaluatorPrompt as coreBuildEvaluator } from '../../src/prompt-builder.js';

const promptsDir = path.join(import.meta.dirname, 'prompts');

function loadTemplate(name: string): string {
  return readFileSync(path.join(promptsDir, name), 'utf-8');
}

export class DocumentationLayer implements Layer {
  name = 'documentation';

  private producerTemplate: string;
  private evaluatorTemplate: string;

  constructor() {
    this.producerTemplate = loadTemplate('sisyphus.md');
    this.evaluatorTemplate = loadTemplate('hades.md');
  }

  validateSpec(spec: Spec): ValidationResult {
    const errors: string[] = [];

    for (const boulder of spec.boulders) {
      if (boulder.criteria.length === 0) {
        errors.push(`Boulder "${boulder.name}" has no criteria`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  getChecks(): Map<string, CheckFn> {
    return getDocumentationChecks();
  }

  buildProducerPrompt(boulder: Boulder, stackResults: StackResult[], feedback?: string, lessons?: string): string {
    return coreBuildProducer(this.producerTemplate, boulder, stackResults, feedback, lessons);
  }

  buildEvaluatorPrompt(output: string, criteria: Criterion[], stackResults: StackResult[], lessons?: string): string {
    return coreBuildEvaluator(this.evaluatorTemplate, output, criteria, stackResults, lessons);
  }

  async assemble(outputs: BoulderOutput[], outputPath: string): Promise<void> {
    await assembleDocument(outputs, outputPath);
  }
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run tests/documentation-layer.test.ts`
Expected: All 6 tests pass

- [ ] **Step 8: Commit**

```bash
git add layers/documentation/ tests/documentation-layer.test.ts
git commit -m "feat: documentation layer with checks, prompts, and assembler"
```

---

## Task 12: Engine (Boulder Loop)

**Files:**
- Create: `src/engine.ts`
- Create: `tests/engine.test.ts`

- [ ] **Step 1: Write engine tests**

Create `tests/engine.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runSpec } from '../src/engine.js';
import * as startModule from '../src/start.js';
import * as stackModule from '../src/stack.js';

// Mock start (claude spawning) — always return reasonable output
vi.mock('../src/start.js', () => ({
  start: vi.fn(),
}));

// Mock stack — return simple data
vi.mock('../src/stack.js', () => ({
  stack: vi.fn().mockResolvedValue([
    { type: 'analysis', source: 'test.json', data: '{"items": ["a", "b", "c"]}' },
  ]),
}));

const mockStart = vi.mocked(startModule.start);

describe('runSpec', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs a simple spec with one boulder that passes all checks', async () => {
    // Producer returns markdown with a table
    mockStart.mockResolvedValueOnce(
      '# Results\n\n| Name | Status |\n|------|--------|\n| a | done |\n| b | done |\n| c | done |'
    );

    const result = await runSpec({
      title: 'Test',
      layer: 'documentation',
      output: '/tmp/sisyphus-test-output.md',
      boulders: [{
        name: 'Results',
        description: 'List items',
        stack: [{ type: 'analysis', source: 'test.json', instruction: 'read' }],
        criteria: [
          { check: 'contains-table', description: 'has table', columns: ['Name', 'Status'] },
          { check: 'row-count-gte', description: 'at least 3 rows', min: 3 },
        ],
      }],
    });

    expect(result.totalBoulders).toBe(1);
    expect(result.passedClean).toBe(1);
    expect(result.flagged).toBe(0);
  });

  it('retries when structural checks fail', async () => {
    // First attempt: too few rows
    mockStart.mockResolvedValueOnce(
      '| Name |\n|------|\n| a |'
    );
    // Second attempt: enough rows
    mockStart.mockResolvedValueOnce(
      '| Name |\n|------|\n| a |\n| b |\n| c |'
    );

    const result = await runSpec({
      title: 'Retry Test',
      layer: 'documentation',
      output: '/tmp/sisyphus-test-retry.md',
      maxRetries: 3,
      boulders: [{
        name: 'Items',
        description: 'List items',
        criteria: [
          { check: 'row-count-gte', description: '3+ rows', min: 3 },
        ],
      }],
    });

    expect(result.passedAfterClimb).toBe(1);
    expect(result.passedClean).toBe(0);
    // Producer should have been called twice
    expect(mockStart).toHaveBeenCalledTimes(2);
  });

  it('flags boulders that fail after max retries', async () => {
    // Always return bad output
    mockStart.mockResolvedValue('No table here at all.');

    const result = await runSpec({
      title: 'Flag Test',
      layer: 'documentation',
      output: '/tmp/sisyphus-test-flag.md',
      maxRetries: 2,
      boulders: [{
        name: 'Bad',
        description: 'Will fail',
        criteria: [
          { check: 'contains-table', description: 'needs table' },
        ],
      }],
    });

    expect(result.flagged).toBe(1);
    expect(result.passedClean).toBe(0);
    // 1 initial + 2 retries = 3 calls
    expect(mockStart).toHaveBeenCalledTimes(3);
  });

  it('spawns Hades for custom criteria', async () => {
    // Producer output
    mockStart.mockResolvedValueOnce('# Report\n\nAll items are valid.');
    // Hades evaluation
    mockStart.mockResolvedValueOnce(JSON.stringify([
      { criterion: 'Content is accurate', pass: true, evidence: 'All items are valid', reason: 'Matches source' },
    ]));

    const result = await runSpec({
      title: 'Custom Criteria Test',
      layer: 'documentation',
      output: '/tmp/sisyphus-test-custom.md',
      boulders: [{
        name: 'Report',
        description: 'Write report',
        criteria: [
          { check: 'custom', description: 'Content is accurate' },
        ],
      }],
    });

    expect(result.passedClean).toBe(1);
    // 1 producer + 1 hades = 2 start calls
    expect(mockStart).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement engine.ts**

Create `src/engine.ts`:

```typescript
import path from 'path';
import type { Spec, BoulderOutput, RunReport, CheckResult, Layer } from './types.js';
import { stack } from './stack.js';
import { start } from './start.js';
import { CheckRegistry } from './checks.js';
import { loadLessons, filterLessons, formatLessonsForPrompt } from './lessons.js';
import { buildReport } from './report.js';

// Layer discovery
async function loadLayer(layerName: string): Promise<Layer> {
  const layerPath = path.join(import.meta.dirname, '..', 'layers', layerName, 'index.js');
  const mod = await import(layerPath);
  const LayerClass = mod.DocumentationLayer ?? mod.default;
  return new LayerClass();
}

export async function runSpec(spec: Spec, options?: { baseDir?: string; lessonsDir?: string; verbose?: boolean }): Promise<RunReport> {
  const baseDir = options?.baseDir ?? process.cwd();
  const lessonsDir = options?.lessonsDir ?? path.join(import.meta.dirname, '..', 'lessons');
  const startedAt = new Date().toISOString();

  // Load layer
  const layer = await loadLayer(spec.layer);

  // Validate with layer
  const validation = layer.validateSpec(spec);
  if (!validation.valid) {
    throw new Error(`Layer validation failed:\n${validation.errors.join('\n')}`);
  }

  // Set up check registry
  const registry = new CheckRegistry();
  registry.registerAll(layer.getChecks());

  // Load lessons
  let lessons: string = '';
  try {
    const allLessons = await loadLessons(lessonsDir, spec.layer);
    if (allLessons.length > 0) {
      const sorted = filterLessons(allLessons, []);
      lessons = formatLessonsForPrompt(sorted);
    }
  } catch {
    // No lessons — continue without
  }

  const maxRetries = spec.maxRetries ?? 3;
  const outputs: BoulderOutput[] = [];

  // Boulder loop
  for (const boulder of spec.boulders) {
    const boulderMaxRetries = boulder.maxRetries ?? maxRetries;
    let lastOutput = '';
    let lastFailures: CheckResult[] = [];
    let climbFeedback: string | undefined;
    let passed = false;

    // Stack data (once per boulder)
    const stackResults = await stack(boulder.stack, baseDir);

    for (let attempt = 0; attempt <= boulderMaxRetries; attempt++) {
      // Start Sisyphus (producer)
      const producerPrompt = layer.buildProducerPrompt(boulder, stackResults, climbFeedback, lessons || undefined);
      lastOutput = await start({
        prompt: producerPrompt,
        model: 'sonnet',
      });

      // Descend: structural checks
      const structuralCriteria = boulder.criteria.filter(c => c.check !== 'custom');
      const structuralResults = registry.runChecks(lastOutput, structuralCriteria);

      // Descend: Hades (custom criteria)
      const customCriteria = boulder.criteria.filter(c => c.check === 'custom');
      let customResults: CheckResult[] = [];

      if (customCriteria.length > 0) {
        const evaluatorPrompt = layer.buildEvaluatorPrompt(lastOutput, customCriteria, stackResults, lessons || undefined);
        const evalRaw = await start({
          prompt: evaluatorPrompt,
          model: 'sonnet',
          outputFormat: 'json',
        });

        try {
          const evalParsed = JSON.parse(evalRaw);
          if (Array.isArray(evalParsed)) {
            customResults = evalParsed.map((r: any) => ({
              criterion: r.criterion ?? 'unknown',
              pass: Boolean(r.pass),
              message: r.reason ?? r.message ?? '',
            }));
          }
        } catch {
          customResults = [{
            criterion: 'Hades evaluation',
            pass: false,
            message: `Failed to parse Hades response: ${evalRaw.slice(0, 200)}`,
          }];
        }
      }

      const allResults = [...structuralResults, ...customResults];
      const failures = allResults.filter(r => !r.pass);

      if (failures.length === 0) {
        outputs.push({
          name: boulder.name,
          content: lastOutput,
          attempts: attempt + 1,
          status: 'passed',
        });
        passed = true;
        break;
      }

      // Prepare climb feedback
      lastFailures = failures;
      climbFeedback = failures.map(f => `FAIL: ${f.criterion} — ${f.message}`).join('\n');
    }

    if (!passed) {
      outputs.push({
        name: boulder.name,
        content: lastOutput,
        attempts: boulderMaxRetries + 1,
        status: 'flagged',
        failures: lastFailures,
      });
    }
  }

  // Assemble
  await layer.assemble(outputs, spec.output);

  // Build report
  const report = buildReport(spec.title, outputs);
  report.startedAt = startedAt;
  report.completedAt = new Date().toISOString();

  return report;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/engine.test.ts`
Expected: All 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/engine.ts tests/engine.test.ts
git commit -m "feat: boulder loop engine with stack/start/descend/climb"
```

---

## Task 13: CLI

**Files:**
- Create: `bin/sisyphus.ts`

- [ ] **Step 1: Implement CLI**

Create `bin/sisyphus.ts`:

```typescript
#!/usr/bin/env node

import { Command } from 'commander';
import path from 'path';
import { loadSpec, validateSpec } from '../src/spec.js';
import { runSpec } from '../src/engine.js';
import { writeReport } from '../src/report.js';

const program = new Command();

program
  .name('sisyphus')
  .description('Spec-driven artifact engine with adversarial evaluation')
  .version('0.1.0');

program
  .command('validate <spec-file>')
  .description('Validate a spec file against the schema without running')
  .action(async (specFile: string) => {
    try {
      const spec = await loadSpec(specFile);
      console.log(`✓ Spec "${spec.title}" is valid`);
      console.log(`  Layer: ${spec.layer}`);
      console.log(`  Boulders: ${spec.boulders.length}`);
      console.log(`  Output: ${spec.output}`);
    } catch (err: any) {
      console.error(`✗ Validation failed:\n${err.message}`);
      process.exit(1);
    }
  });

program
  .command('run <spec-file>')
  .description('Execute a spec — stack, produce, evaluate, climb')
  .option('--dry-run', 'Parse spec and show plan without executing')
  .option('--section <name>', 'Run only a specific boulder')
  .option('--model <model>', 'Override model for producer/evaluator')
  .option('--verbose', 'Show full prompts and responses')
  .option('--output <path>', 'Override output path from spec')
  .action(async (specFile: string, opts: any) => {
    try {
      const spec = await loadSpec(specFile);

      if (opts.output) {
        spec.output = opts.output;
      }

      if (opts.section) {
        spec.boulders = spec.boulders.filter(b => b.name === opts.section);
        if (spec.boulders.length === 0) {
          console.error(`No boulder named "${opts.section}" found in spec`);
          process.exit(1);
        }
      }

      if (opts.dryRun) {
        console.log(`Spec: ${spec.title}`);
        console.log(`Layer: ${spec.layer}`);
        console.log(`Output: ${spec.output}`);
        console.log(`Max retries: ${spec.maxRetries ?? 3}`);
        console.log(`\nBoulders:`);
        for (const b of spec.boulders) {
          console.log(`  - ${b.name}: ${b.criteria.length} criteria, ${b.stack?.length ?? 0} stack sources`);
        }
        return;
      }

      console.log(`Starting: ${spec.title}`);
      console.log(`Layer: ${spec.layer} | Boulders: ${spec.boulders.length}\n`);

      const report = await runSpec(spec, {
        baseDir: path.dirname(path.resolve(specFile)),
        verbose: opts.verbose,
      });

      // Write report
      const reportPath = spec.output.replace(/\.[^.]+$/, '') + '-report.json';
      await writeReport(report, reportPath);

      // Summary
      console.log(`\n--- Run Complete ---`);
      console.log(`Passed clean:       ${report.passedClean}`);
      console.log(`Passed after climb: ${report.passedAfterClimb}`);
      console.log(`Flagged:            ${report.flagged}`);
      console.log(`\nArtifact: ${spec.output}`);
      console.log(`Report:   ${reportPath}`);

      if (report.flagged > 0) {
        console.log(`\nFlagged boulders:`);
        report.boulders
          .filter(b => b.status === 'flagged')
          .forEach(b => {
            console.log(`  - ${b.name}: ${b.failures?.map(f => f.message).join('; ')}`);
          });
        process.exit(1);
      }
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program.parse();
```

- [ ] **Step 2: Build and verify CLI shows help**

Run: `npx tsc && node dist/bin/sisyphus.js --help`
Expected: Shows usage with `validate` and `run` commands

- [ ] **Step 3: Test validate command with fixture**

Run: `node dist/bin/sisyphus.js validate tests/fixtures/valid-spec.json`
Expected: Output shows "Spec "Test Spec" is valid"

- [ ] **Step 4: Test validate with invalid spec**

Run: `node dist/bin/sisyphus.js validate tests/fixtures/invalid-spec-no-layer.json`
Expected: Exit code 1, shows validation error about missing layer

- [ ] **Step 5: Test dry-run**

Run: `node dist/bin/sisyphus.js run tests/fixtures/valid-spec.json --dry-run`
Expected: Shows spec plan without executing

- [ ] **Step 6: Commit**

```bash
git add bin/sisyphus.ts
git commit -m "feat: CLI with run and validate commands"
```

---

## Task 14: Update Example Specs

**Files:**
- Modify: `examples/migration-status.json`
- Modify: `examples/entity-mapping.json`
- Remove: `examples/deploy-and-test.json` (task-loop mode, not in MVP)

- [ ] **Step 1: Update migration-status.json to new vocabulary**

Replace `examples/migration-status.json`:

```json
{
  "title": "ALM Entity Migration Status Report",
  "description": "Comprehensive status of all alm_ entity migrations from legacy SQL through staging to Dataverse",
  "layer": "documentation",
  "output": "output/reports/alm-migration-status.md",
  "maxRetries": 3,
  "boulders": [
    {
      "name": "Entity Inventory",
      "description": "Complete list of all alm_ prefixed entities with their current migration status, linked ADO work items, and notes on blockers or dependencies",
      "stack": [
        {
          "type": "analysis",
          "source": "dataverse-schema/_index.json",
          "instruction": "Extract all entities with logicalName starting with 'alm_'. Return array of {logicalName, entitySetName, primaryId, attributeCount}"
        },
        {
          "type": "analysis",
          "source": "work-repo/pipeline/*.json",
          "instruction": "List all pipeline names that reference alm_ entities in their SQL queries or parameters"
        }
      ],
      "criteria": [
        {
          "check": "contains-table",
          "columns": ["Entity", "Status", "Pipeline", "ADO Item", "Notes"],
          "description": "Table with entity name, migration status, associated pipeline, linked ADO item, and notes"
        },
        {
          "check": "row-count-gte",
          "min": 1,
          "description": "At least one row per entity found in schema index"
        },
        {
          "check": "custom",
          "description": "Each entity has a status value from: Complete, In Progress, Not Started, Blocked, N/A"
        },
        {
          "check": "custom",
          "description": "Entities with status 'Blocked' must have a note explaining the blocker"
        }
      ]
    },
    {
      "name": "Pipeline Coverage",
      "description": "Summary of which pipelines handle which entities, run frequency, and recent success/failure rates",
      "stack": [
        {
          "type": "analysis",
          "source": "work-repo/pipeline/*.json",
          "instruction": "For each pipeline, extract: name, entities referenced in SQL, any ForEach loops or parameterized entity lists"
        }
      ],
      "criteria": [
        {
          "check": "contains-table",
          "columns": ["Pipeline", "Entities", "Last Run", "Status"],
          "description": "Table mapping pipelines to entities with recent run info"
        },
        {
          "check": "custom",
          "description": "Every entity from the Entity Inventory section is covered by at least one pipeline, or explicitly marked as 'No pipeline' with explanation"
        }
      ]
    },
    {
      "name": "Open Issues",
      "description": "Active bugs and blockers from ADO related to the migration",
      "stack": [
        {
          "type": "analysis",
          "source": "errors/",
          "instruction": "List recent error files with timestamps and brief descriptions of the failures"
        }
      ],
      "criteria": [
        {
          "check": "contains-table",
          "columns": ["ID", "Title", "Entity", "Severity", "Assigned To"],
          "description": "Table of active bugs with entity association"
        },
        {
          "check": "custom",
          "description": "Each bug is linked to a specific entity from the Entity Inventory, or marked as 'cross-cutting' with explanation"
        }
      ]
    }
  ]
}
```

Note: Removed ADO search and task gather sources (not in MVP). Kept analysis sources only.

- [ ] **Step 2: Update entity-mapping.json to new vocabulary**

Replace `examples/entity-mapping.json`:

```json
{
  "title": "Entity Schema Mapping",
  "description": "Detailed column-level mapping from source SQL staging tables to Dataverse entity attributes",
  "layer": "documentation",
  "output": "output/reports/entity-mapping.md",
  "maxRetries": 3,
  "boulders": [
    {
      "name": "Entity List",
      "description": "Identify all entities to map by cross-referencing staging tables with Dataverse schema",
      "stack": [
        {
          "type": "analysis",
          "source": "dataverse-schema/_index.json",
          "instruction": "Extract all entities with alm_ prefix: {logicalName, entitySetName, attributes (as array)}"
        },
        {
          "type": "analysis",
          "source": "work-repo/SQL DB/sql-almstagingdb-dev-usgovva-01/dbo/Tables/*.sql",
          "instruction": "List all staging table names that contain 'alm' in their name"
        }
      ],
      "criteria": [
        {
          "check": "contains-table",
          "columns": ["DV Entity", "Staging Table", "SP", "Attribute Count", "Column Count"],
          "description": "Summary table linking DV entities to their staging tables and transform SPs"
        },
        {
          "check": "custom",
          "description": "Every staging table with 'alm' in the name is matched to a DV entity, or marked as 'orphan' with explanation"
        }
      ]
    }
  ]
}
```

Note: Removed the `foreach` boulder (not in MVP). Kept the first boulder only.

- [ ] **Step 3: Remove deploy-and-test.json**

Run: `rm examples/deploy-and-test.json`

Task-loop mode is not in MVP scope.

- [ ] **Step 4: Verify updated specs validate**

Run: `node dist/bin/sisyphus.js validate examples/migration-status.json`
Expected: Valid

Run: `node dist/bin/sisyphus.js validate examples/entity-mapping.json`
Expected: Valid

- [ ] **Step 5: Commit**

```bash
git add examples/migration-status.json examples/entity-mapping.json
git rm examples/deploy-and-test.json
git commit -m "chore: update example specs to new vocabulary, remove task-loop"
```

---

## Task 15: Remove Empty Directories + Final Cleanup

**Files:**
- Remove: `skills/` (empty directory left from cleanup agent)
- Modify: `CLAUDE.md` (verify up to date)

- [ ] **Step 1: Remove empty skills directory**

Run: `rm -rf skills/`

- [ ] **Step 2: Verify all tests pass**

Run: `npx vitest run`
Expected: All tests pass across all test files

- [ ] **Step 3: Verify build succeeds**

Run: `npx tsc`
Expected: No errors, `dist/` directory created

- [ ] **Step 4: Verify CLI works end-to-end**

Run: `node dist/bin/sisyphus.js validate tests/fixtures/valid-spec.json`
Expected: Valid

Run: `node dist/bin/sisyphus.js run tests/fixtures/valid-spec.json --dry-run`
Expected: Shows plan

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: final cleanup and verify all tests pass"
```
