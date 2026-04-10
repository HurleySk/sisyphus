---
name: ado-search
description: Backend for gathering data from Azure DevOps work items via the ado-search CLI
---

# ADO Search Backend

Gathers data from ADO work items stored in `ado-export/` and indexed by `ado-search`.

## Prerequisites

- `ado-search` Python package installed (`pip install ado-search`)
- `ado-export/` directory populated via `ado-search sync`

## Gather Spec

```json
{
  "type": "ado-search",
  "query": "migration entity alm_meetings",
  "filters": {
    "type": "Bug",
    "state": "Active",
    "area": "ALM\\Data Migration",
    "assigned-to": "user@example.com",
    "tag": "sprint-42"
  }
}
```

**Fields:**
- `query`: Full-text search query
- `filters` (optional): Key-value filters passed as CLI flags

## Execution

1. Build the search command:
   ```
   ado-search search "<query>" --data-dir ./ado-export --format json [--type X] [--state Y] ...
   ```
2. Run via Bash, parse JSON output
3. For each result, optionally fetch full content:
   ```
   ado-search show <id> --data-dir ./ado-export
   ```

## Return Format

```json
{
  "type": "ado-search",
  "query": "migration entity alm_meetings",
  "itemCount": 5,
  "data": [
    {
      "id": 72999,
      "title": "Migrate alm_meetings entity",
      "type": "User Story",
      "state": "Active",
      "area": "ALM\\Data Migration",
      "tags": ["sprint-42"],
      "snippet": "First 200 chars of content..."
    }
  ]
}
```

## When to Fetch Full Content

- **Search results** give titles, states, and snippets — enough for inventory and status tracking
- **Full content** (`ado-search show`) is needed when the spec requires extracting acceptance criteria, implementation details, or linking specific requirements to code changes
- Fetch full content only when the section's criteria require it — avoid unnecessary context bloat

## Filters Reference

| Filter | CLI Flag | Values |
|--------|----------|--------|
| type | `--type` | Bug, User Story, Task, Feature, Epic |
| state | `--state` | Active, Closed, Resolved, New |
| area | `--area` | Area path (e.g., `ALM\\Data Migration`) |
| assigned-to | `--assigned-to` | Email address |
| tag | `--tag` | Tag name |
