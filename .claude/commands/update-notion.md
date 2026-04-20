---
description: Update the Notion MAANG Prep System dashboard directly via MCP
---

Use the Notion MCP tools to update the MAANG Prep System page.

Key IDs:
- Main page: `34888ab3-488e-8106-8f22-e37ee58b0d9d`  (https://www.notion.so/34888ab3488e81068f22e37ee58b0d9d)
- Daily Log database: `28842f0050534b4a8925edad850dd4b5`  (https://www.notion.so/28842f0050534b4a8925edad850dd4b5)
- Daily Log data source: `collection://72fbd185-6e3d-455b-9667-b886025c882c`

Workflow:
1. Use `notion-fetch` on the page URL to read current content before editing
2. Use `notion-update-page` to modify content — always fetch first to avoid overwriting sections
3. Use `notion-create-pages` with `parent.page_id = 34888ab3...` to add sub-pages
4. Use `notion-create-database` with `parent.page_id = 34888ab3...` to add new tracking databases

When updating the Weekly Tracker table, fetch the page first to locate the exact block, then use `notion-update-page` with the correct page ID and updated content.
