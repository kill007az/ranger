---
description: Update the Daily Log database schema or data via Notion MCP
---

Use the Notion MCP tools to modify the Daily Log database schema, create entries, or fetch data.

## Daily Log IDs

- **Database ID**: `28842f0050534b4a8925edad850dd4b5`
- **Data Source ID**: `collection://72fbd185-6e3d-455b-9667-b886025c882c`

## Common Workflows

### Add a new property (column)

Use `notion-update-data-source` with an `ADD COLUMN` statement:

```
data_source_id: collection://72fbd185-6e3d-455b-9667-b886025c882c
statements: ADD COLUMN "Property Name" PROPERTY_TYPE
```

Types: `TITLE`, `RICH_TEXT`, `NUMBER`, `CHECKBOX`, `DATE`, `SELECT('opt1':color, 'opt2':color)`, `MULTI_SELECT(...)`, `FORMULA('expression')`, etc.

Example:
```
statements: ADD COLUMN "Goals" RICH_TEXT; ADD COLUMN "Difficulty" SELECT('Easy':green, 'Hard':red)
```

### Modify a formula

Use `ALTER COLUMN` with `SET`:

```
statements: ALTER COLUMN "Score %" SET FORMULA('new formula expression')
```

Example (updating the score to exclude a field):
```
statements: ALTER COLUMN "Score %" SET FORMULA('round((toNumber(prop("Gym")) + toNumber(prop("DSA Completed"))) / 2 * 100)')
```

### Rename a property

Use `RENAME COLUMN`:

```
statements: RENAME COLUMN "Old Name" TO "New Name"
```

### Delete a property

Use `DROP COLUMN`:

```
statements: DROP COLUMN "Property To Remove"
```

### Query or create entries

Use `notion-query-data-sources` or `notion-create-pages` with `parent.data_source_id`.

Example (create an entry):
```
parent: { data_source_id: "collection://72fbd185-6e3d-455b-9667-b886025c882c" }
pages: [{ properties: { "Day": "2026-04-20", "Gym": "__YES__", ... } }]
```

## Current Schema

Current Daily Log properties (as of last update):
- `Day` (title), `Date`, `Gym`, `Gym Notes`, `DSA Completed`, `DSA Count`, `DSA Notes`, `System Design`, `SD Notes`, `Mock Interview`, `AI Course`, `AI Course Notes`, `Assignments`, `Assignments Notes`, `Week`, `Score %` (formula), `Notes`

Use `/update-notion` skill for general Notion edits outside the Daily Log.
