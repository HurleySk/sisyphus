---
name: structural-checks
description: Deterministic check implementations for evaluating document sections against structural criteria
---

# Structural Checks

These checks are **deterministic** — they parse markdown and return pass/fail with no LLM judgment involved. They form Pass 1 of the evaluator pipeline.

## Check Implementations

### `contains-table`

Verifies that a markdown table exists with the specified columns.

**Parameters:**
- `columns` (optional): Array of required column header names. If omitted, checks that any table exists.

**Algorithm:**
1. Find all lines matching the pattern `| col1 | col2 | ... |`
2. Identify table headers (line followed by a separator line like `|---|---|`)
3. Extract column names by splitting on `|` and trimming whitespace
4. If `columns` specified: check that every required column name appears in at least one table's headers (case-insensitive)
5. Pass if all required columns found; fail with list of missing columns

**Failure message format:**
- "No markdown table found in section"
- "Table missing required columns: Status, Notes (found: Entity, Source, Target)"

### `row-count-gte`

Verifies that a markdown table has at least N data rows.

**Parameters:**
- `min`: Minimum row count
- `source` (optional): Reference to a gather result for dynamic threshold (e.g., `gather[0]` — uses the item count from that gather result)

**Algorithm:**
1. Find the first markdown table (header + separator + data rows)
2. Count data rows (lines after the separator that match the `|...|` pattern)
3. If `source` specified: resolve the dynamic threshold from gathered data
4. Pass if row count >= min; fail with actual count

**Failure message format:**
- "Table has 10 rows, expected at least 47"

### `row-count-lte`

Verifies that a markdown table has at most N data rows.

**Parameters:**
- `max`: Maximum row count

**Algorithm:** Same as `row-count-gte` but checks `<=`.

**Failure message format:**
- "Table has 150 rows, expected at most 100"

### `contains-heading`

Verifies that a markdown heading exists with the specified text.

**Parameters:**
- `heading`: Required heading text (substring match, case-insensitive)
- `level` (optional): Required heading level (1-6). If omitted, any level matches.

**Algorithm:**
1. Find all lines starting with `#` characters
2. Parse heading level (count `#` characters) and text
3. Check if any heading matches the required text (case-insensitive substring)
4. If `level` specified: also check that the heading level matches
5. Pass if match found; fail with list of headings found

**Failure message format:**
- "No heading containing 'Column Mapping' found. Headings present: Entity Inventory, Migration Status, Summary"
- "Heading 'Column Mapping' found at level 3, expected level 2"

### `word-count-gte`

Verifies that the section contains at least N words.

**Parameters:**
- `min`: Minimum word count

**Algorithm:**
1. Strip markdown syntax (headers, table pipes, links, emphasis markers)
2. Split on whitespace, count non-empty tokens
3. Pass if count >= min; fail with actual count

**Failure message format:**
- "Section has 45 words, expected at least 100"

### `word-count-lte`

Verifies that the section has at most N words.

**Parameters:**
- `max`: Maximum word count

**Algorithm:** Same as `word-count-gte` but checks `<=`.

**Failure message format:**
- "Section has 500 words, expected at most 300"

## Implementation Notes

These checks run as the evaluator agent's first pass. The evaluator should implement them by:

1. Parsing the section markdown text
2. Applying the algorithm described above
3. Returning a structured result per criterion:

```json
{
  "criterion": "contains-table",
  "pass": false,
  "message": "Table missing required columns: Status (found: Entity, Source, Target)",
  "details": {
    "found_columns": ["Entity", "Source", "Target"],
    "missing_columns": ["Status"]
  }
}
```

Structural checks are **not negotiable** — they either pass or fail. The evaluator must not apply judgment or interpretation. A missing column is a missing column, regardless of how good the rest of the document is.

## Adding New Checks

New structural checks should:
1. Be deterministic (same input → same output, always)
2. Have a clear algorithm description
3. Produce specific failure messages that tell the producer exactly what to fix
4. Be added to the `check` enum in `lib/spec-schema.json`
