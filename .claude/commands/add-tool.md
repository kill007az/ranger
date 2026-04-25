---
description: Add a new tool/capability to the Ranger Gemini agent
---

Add a new tool to the Ranger agent. Ask the user what the tool should do if not already specified, then make all three changes:

## 1. [`constants/tools.ts`](../../constants/tools.ts) — Add tool declaration

Add a new entry inside the `functionDeclarations` array with:
- `name` (snake_case)
- `description` (clear, one sentence — the model reads this to decide when to call it)
- `parameters` with property definitions and `required` array
- Use `as any` casts to satisfy SDK types

Example:
```typescript
{
  name: 'get_plan_summary',
  description: 'Fetch a high-level summary of the 6-month MAANG prep plan',
  parameters: {
    type: 'object' as any,
    properties: {
      month: { type: 'number' as any, description: 'Month 1–6 (optional, defaults to current)' },
    },
  },
},
```

## 2. [`lib/agent.ts`](../../lib/agent.ts) — Add handler in `executeToolCall`

Add a `case 'tool_name':` block inside the `switch (call.name)` statement. The case must:
- Read `startDate` from the `startDate` parameter passed to `executeToolCall`
- Call the appropriate `lib/notion.ts` helper if Notion data is needed
- Handle errors gracefully (return `{ error: 'message' }`)
- Return a plain object with the result (the model reads this as the tool response)

Example:
```typescript
case 'get_plan_summary': {
  const month = call.args.month ?? Math.ceil(getCurrentWeek(startDate) / 4);
  if (month < 1 || month > 6) return { error: 'Month must be 1–6' };
  return { month, summary: 'W' + ((month - 1) * 4 + 1) + '–' + (month * 4) + '...' };
}
```

## 3. [`lib/notion.ts`](../../lib/notion.ts) — Add Notion helper (if needed)

If the tool needs to query Notion, add a typed helper function using the internal `req()` function.

**Key IDs for reference:**
- Daily Log database: `28842f0050534b4a8925edad850dd4b5`
- MAANG Prep System page: `34888ab3-488e-8106-8f22-e37ee58b0d9d`

Example (if you need to query the page content):
```typescript
export async function getPageContent() {
  return req('/pages/34888ab3-488e-8106-8f22-e37ee58b0d9d', 'GET');
}
```

## 4. Update `list_tools` in `lib/agent.ts`

Add a one-line entry in the `list_tools` case so it stays accurate:
```typescript
{ name: 'your_tool_name', description: 'One-line description.' },
```

## 5. Verify

Run `npx tsc --noEmit` after all changes to confirm no type errors.

---

**Note:** Not all tools need Notion. `get_roadmap` and `list_tools` are pure in-memory tools with no Notion calls — skip step 3 for tools that don't touch the database.
