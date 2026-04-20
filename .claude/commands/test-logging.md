---
description: Test daily logging flow end-to-end
---

Quick checklist to verify logging works correctly.

## Setup Phase
1. Run `conda activate ranger && npx expo start`
2. Scan QR code with Expo Go on phone
3. On first launch, Setup screen appears
4. Enter:
   - **Notion API key**: `secret_...` from notion.so/my-integrations (required)
   - **Start date**: pick a date in the past (e.g., 2026-04-01) so you're not before the prep start
   - **Gemini key**: leave blank (reads from `.env`)
5. Tap **START** → should redirect to tabs

## Chat Tab Tests
- [ ] Header shows "WEEK X", "ADHERENCE Y%", "STREAK Zd"
- [ ] Ask "What week am I on?" → should show current week number
- [ ] Ask "Show this week's stats" → should show days logged, DSA count, average score
- [ ] Ask "Get my streak" → should show consecutive days with ≥1 DSA (Sunday excluded)

## Log Day Tab Tests (Weekday)
- [ ] Toggle shows correct day type (e.g., "MONDAY" or "SATURDAY")
- [ ] Gym row only appears on weekdays, not Saturday
- [ ] Toggle Gym and DSA, enter "3" for DSA count, add notes
- [ ] Score preview shows "(2/2) - weekday formula (Gym + DSA) / 2"
- [ ] Submit → success screen shows score (100% if both toggled)
- [ ] Verify entry appears in Notion Daily Log with correct date, toggles, notes, score

## Log Day Tab Tests (Saturday)
- [ ] Wait until Saturday (or fake it by changing device date)
- [ ] Gym row should NOT appear; AI Course and Assignments rows should appear instead
- [ ] Toggle DSA, AI Course, Assignments; enter DSA count
- [ ] Score preview shows "(2/3) - Saturday formula"
- [ ] Submit → success screen shows score (67% if 2 of 3 toggled)

## Log Day Tab Tests (Sunday)
- [ ] On Sunday, rest day banner appears: "SUNDAY — REST DAY"
- [ ] Attempt to submit without confirming → shows confirmation alert
- [ ] Tap "Log anyway" → allows submit, score shows "0% · Rest day"

## Log Day Tab Tests (Date Guard)
- [ ] In Settings, change start date to tomorrow
- [ ] Go back to Log Day → shows "LOGGING LOCKED · Today is 2026-04-20. Your prep starts 2026-04-21."
- [ ] Change start date back to past → lock screen disappears

## Settings Tab Tests
- [ ] Start date shows as YYYY-MM-DD
- [ ] Tap EDIT → date picker appears
- [ ] Change date, tap SAVE → asks "are you sure?"
- [ ] Confirm → date updates, shows in Log Day tab
- [ ] Test Notion key rotation (enter dummy key, tap UPDATE)
- [ ] Test Gemini key override (enter dummy key, tap SAVE)
- [ ] Tap CLEAR ALL DATA → asks "are you sure?"
- [ ] Confirm → redirects to /setup (all keys cleared)

## End-to-End Log-via-Chat Test
- [ ] In Chat, say "log today: gym done, 4 dsa problems, sd done, had a mock"
- [ ] Agent calls `log_daily` tool
- [ ] Success response shows "logged for today, score X%, week Y"
- [ ] Verify in Notion: new row appears with all toggles and DSA count = 4

## Edit Entry Test
- [ ] In Chat, say "I actually solved 5 DSA problems today"
- [ ] Agent calls `update_daily_log` tool with `dsa_count: 5`
- [ ] Success response shows "updated DSA count to 5"
- [ ] Verify in Notion: existing row's DSA Count updates to 5

## Backfill Test (Optional)
- [ ] In Chat, say "log yesterday: gym done, 2 dsa"
- [ ] Agent calls `log_daily` with `date: 2026-04-19`
- [ ] Success response shows "logged for 2026-04-19"
- [ ] Verify in Notion: row for yesterday appears

## Formula Validation
- [ ] Open Daily Log in Notion
- [ ] Check Score % column: weekday entries show (Gym + DSA) / 2 × 100
- [ ] Check Saturday entry: shows (DSA + AI + Assignments) / 3 × 100
- [ ] Check Sunday entry: shows 0

If any step fails, check `.env` for API key, verify Notion integration permissions, and run `npx tsc --noEmit` to catch type errors in agent.ts or tools.ts.
