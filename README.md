# Ranger — MAANG Prep Assistant

A standalone Android app (Expo SDK 52) that acts as a conversational agent for a 6-month MAANG interview preparation system. Logs daily adherence to a Notion database (with day-aware scoring), answers questions about the prep roadmap, tracks weekly progress and streak — all via the Gemini API. No backend server. Runs entirely on the phone.

---

## Stack

| Layer | Technology |
|---|---|
| App framework | Expo SDK 52 + expo-router v4 (file-based routing) |
| Language | TypeScript (strict) |
| LLM | Google Gemini (`@google/generative-ai`) via free tier |
| Notion integration | Notion REST API v1 via `fetch` (no SDK — RN incompatible) |
| Date picker | `@react-native-community/datetimepicker` |
| Secure storage | `expo-secure-store` (Android Keystore backed) |
| Build | EAS Build (cloud APK, free tier) |
| Environment | conda env `ranger` with Node.js 22 |

---

## Project Structure

```
ranger/
├── app/
│   ├── _layout.tsx          # Root Stack navigator, status bar
│   ├── index.tsx            # Entry point — redirects to /setup or /(tabs)
│   ├── setup.tsx            # First-launch screen: API keys + prep start date (date picker)
│   └── (tabs)/
│       ├── _layout.tsx      # Tab bar (Chat / Log Day / Settings)
│       ├── index.tsx        # Chat screen — conversational agent UI with header stats
│       ├── log.tsx          # Daily log screen — day-aware toggles + per-activity notes
│       └── settings.tsx     # Settings — edit start date, rotate API keys, clear data
├── lib/
│   ├── agent.ts             # Gemini agent + tool-call loop (context-aware system prompt)
│   ├── notion.ts            # Notion REST API helpers (upsert, query, update)
│   ├── storage.ts           # expo-secure-store read/write helpers
│   └── weekTracker.ts       # Week calculator + day-type detector
├── constants/
│   └── tools.ts             # Gemini function declarations (log_daily, update_daily_log, get_streak, etc.)
├── .claude/
│   └── commands/            # Claude Code slash commands for this project
│       ├── add-tool.md      # /add-tool  — scaffold a new agent tool
│       ├── update-notion.md # /update-notion — edit Notion via MCP
│       └── build-apk.md     # /build-apk — EAS build walkthrough
├── .env                     # Gemini API key + model (EXPO_PUBLIC_ prefix required)
├── app.json                 # Expo config (package name, plugins)
├── eas.json                 # EAS build profiles (preview = APK, production = AAB)
├── babel.config.js
├── tsconfig.json
└── package.json
```

---

## First-Time Setup

### 1. Prerequisites
- [Expo Go](https://expo.dev/go) installed on your Android phone
- conda installed on your PC
- A [Google AI Studio](https://aistudio.google.com) account (free Gemini API key)
- A Notion account with the MAANG Prep System page created

### 2. Notion Integration
1. Go to [notion.so/my-integrations](https://notion.so/my-integrations) → **New integration**
2. Name it (e.g. "Ranger"), select your workspace → Submit
3. Copy the `secret_...` token
4. Open the **6 Month MAANG Prep System** page in Notion
5. Click **•••** (top-right) → **Connections** → add your integration
6. This grants access to the page **and** the Daily Log database (child page)

### 3. Environment
```bash
# Clone / navigate to project
cd "e:/Personal Projects/ranger"

# Activate the conda env
conda activate ranger

# Install dependencies (already done, but run if node_modules is missing)
npm install
```

### 4. Configure `.env`
The `.env` at the project root must have:
```env
EXPO_PUBLIC_GOOGLE_API_KEY=your_gemini_key_here
EXPO_PUBLIC_GEMINI_MODEL=gemini-3.1-flash-lite-preview
```
> The `EXPO_PUBLIC_` prefix is required — Expo only inlines variables with this prefix into the client bundle.

---

## Running (Development)

```bash
conda activate ranger
cd "e:/Personal Projects/ranger"
npx expo start
```

1. A QR code appears in the terminal
2. Open **Expo Go** on your phone
3. Scan the QR code
4. On first launch, the **Setup screen** appears — enter:
   - Your Notion `secret_...` token
   - Your prep start date (via date picker) — used to calculate current week + lock logging before start date
   - Gemini key field is optional (reads from `.env` if not set)

---

## Building a Standalone APK

No server or PC needed after installation.

```bash
conda activate ranger
cd "e:/Personal Projects/ranger"

# First time only
npm install -g eas-cli
eas login
eas build:configure    # adds projectId to app.json

# Build (~5–10 min, uses EAS cloud)
eas build --platform android --profile preview
```

Download the `.apk` from the EAS dashboard URL it prints, then side-load it on your phone (Settings → Security → allow unknown apps).

---

## Architecture

### Agent Flow

```
User message
     │
     ▼
runAgent() in lib/agent.ts
     │
     ├── Builds system prompt with:
     │   ├── today's date + day-of-week
     │   ├── current week (1–24) + weeks remaining
     │   ├── prep start date (gates backfill)
     │   ├── 24-week roadmap by month/topic
     │   ├── daily schedule (weekday / Saturday / Sunday)
     │   ├── scoring rules (day-aware, SD unweighted)
     │   └── streak rule (≥1 DSA problem, Sunday exempt)
     │
     ├── Resolves API key: process.env.EXPO_PUBLIC_GOOGLE_API_KEY ?? SecureStore
     ├── Resolves model:   process.env.EXPO_PUBLIC_GEMINI_MODEL ?? 'gemini-2.0-flash'
     │
     ▼
Gemini model.startChat({ history, tools: AGENT_TOOLS })
     │
     ▼
chat.sendMessage(userMessage)
     │
     ▼
┌─── response.functionCalls() present? ──── No ──→ return response.text()
│                                                         │
│    Yes                                                  ▼
│     │                                           displayed in chat UI
│     ▼
│  executeToolCall() for each call
│  ├── log_daily        → upsertDailyLogEntry() → Notion POST /pages (idempotent)
│  ├── update_daily_log → updateDailyLogEntryByDate() → Notion PATCH /pages
│  ├── get_today_log    → getEntryByDate() → Notion POST /databases/{id}/query
│  ├── get_week_number  → getCurrentWeek(startDate)
│  ├── get_weekly_stats → queryWeekEntries(week) → Notion POST /databases/{id}/query
│  └── get_streak       → queryRecentEntries(60) → Notion query + streak calc
│     │
│     ▼
└── chat.sendMessage(functionResponses) ──→ loop
```

### Key Design Decisions
- **No LangGraph** — the tool-call loop is ~30 lines. LangGraph.js requires Node.js internals that don't run in React Native.
- **No Notion SDK** — `@notionhq/client` uses Node.js streams; all calls use `fetch` directly instead.
- **Env vars take priority over SecureStore** — allows bundling the key at build time for personal use while keeping the setup screen functional for fresh installs without a `.env`.
- **Notion API key never in `.env`** — Notion token stays in SecureStore only (entered via setup screen), since it's more sensitive than an AI API key.
- **Day-aware scoring** — weekday = (Gym + DSA) / 2, Saturday = (DSA + AI + Assignments) / 3, Sunday = 0 (rest). System Design tracked but never weighted. Formula checks `formatDate(prop("Date"), "dddd")` in Notion.
- **Idempotent logging** — `log_daily` queries by date first; if a row exists, it updates in place rather than duplicating.
- **Streak rule from plan** — ≥1 DSA problem per day maintains streak. Sundays skip (rest day exempt, don't break streak).

---

## Notion Schema

### MAANG Prep System Page
- **Page ID:** `34888ab3-488e-8106-8f22-e37ee58b0d9d`
- **URL:** https://www.notion.so/34888ab3488e81068f22e37ee58b0d9d
- Contains: Daily Schedule, Fallback System, Weekly Tracker, Saturday Structure, Sunday Rule, 6-Month Roadmap, Progress Dashboard

### Daily Log Database
- **Database ID:** `28842f0050534b4a8925edad850dd4b5`
- **Data Source ID:** `collection://72fbd185-6e3d-455b-9667-b886025c882c`

| Property | Type | Notes |
|---|---|---|
| Day | title | Date string e.g. `2026-04-20` |
| Date | date | ISO date (key for queries) |
| **Weekday fields** | | |
| Gym | checkbox | |
| Gym Notes | rich_text | Optional notes on the gym session |
| DSA Completed | checkbox | |
| DSA Count | number | Problems solved today (feeds weekly total) |
| DSA Notes | rich_text | Optional notes on the DSA session |
| **Saturday-only fields** | | |
| AI Course | checkbox | Saturday only |
| AI Course Notes | rich_text | |
| Assignments | checkbox | Saturday only |
| Assignments Notes | rich_text | |
| **Always tracked** | | |
| System Design | checkbox | Optional, unweighted in score |
| SD Notes | rich_text | |
| Mock Interview | checkbox | Tracked for Dashboard |
| **Auto-calculated** | | |
| Week | number | 1–24, auto-calculated by agent from start date |
| Score % | formula | Weekday: `(Gym + DSA) / 2 × 100`; Sat: `(DSA + AI + Assignments) / 3 × 100`; Sun: `0` |
| Notes | rich_text | Overall daily reflection |

---

## Agent Tools Reference

Defined in [`constants/tools.ts`](constants/tools.ts), executed in [`lib/agent.ts`](lib/agent.ts).

| Tool | Description | Parameters |
|---|---|---|
| `log_daily` | Create or update a daily log entry (idempotent by date). On weekdays: Gym + DSA + SD. On Saturday: DSA + AI Course + Assignments + SD. On Sunday: rest day (warns user). | `date?: YYYY-MM-DD` (defaults to today), `gym?: bool`, `gym_notes?: str`, `dsa?: bool`, `dsa_count?: num`, `dsa_notes?: str`, `system_design?: bool`, `sd_notes?: str`, `mock_interview?: bool`, `ai_course?: bool`, `ai_course_notes?: str`, `assignments?: bool`, `assignments_notes?: str`, `notes?: str` |
| `update_daily_log` | Partial update to an existing entry for a given date. Only provided fields are modified. | `date: YYYY-MM-DD` (required), any of the above |
| `get_today_log` | Fetch the existing log entry for a date (defaults to today). Returns null if none exists. | `date?: YYYY-MM-DD` |
| `get_week_number` | Get the current week (1–24) based on stored start date. | none |
| `get_weekly_stats` | Get adherence statistics for a week: days logged, DSA count, mocks, average score, etc. | `week?: number` (defaults to current) |
| `get_streak` | Calculate current streak. Rule: ≥1 DSA problem per day (Sundays skipped, rest exempt). | none |

### Adding a New Tool
Use the `/add-tool` Claude Code skill — it guides all three required file changes.

---

## Features

### Daily Logging (Log Day tab)
- **Day-aware UI**: Weekday layout (Gym + DSA + SD) vs. Saturday layout (DSA + AI + Assignments + SD) vs. Sunday rest warning
- **Per-activity notes**: Each activity (Gym, DSA, AI Course, etc.) has its own notes field
- **DSA problem counter**: Track the number of problems solved each day
- **Mock Interview toggle**: Log whether a mock interview was done
- **System Design tracking**: Optional, unweighted in score
- **Date-locked logging**: Can't log before prep start date; start date is locked after setup
- **Auto-populate**: If logging today again, previous entry loads into form
- **Sunday rest reminder**: Confirms with user if they try to log on Sunday
- **Live score preview**: Shows real-time (Gym + DSA) / 2 or appropriate Saturday/Sunday formula

### Chat Agent
- **Context-aware**: System prompt injects today's date, current week, start date, day type
- **Tool-powered**: Call agent tools to log, fetch stats, calculate streak
- **Chat history**: Maintains conversation history for multi-turn queries
- **Quick actions**: Preset chips for common queries ("What week am I on?", "Show this week's stats", etc.)
- **Live stats header**: Shows current week, this week's adherence %, and current streak
- **Backfill support**: "log yesterday" or "log April 15th" by passing `date` parameter to `log_daily`

### Settings Tab
- **Edit start date** (with confirmation; locked once saved)
- **Rotate Notion API key** (without re-entering Gemini key)
- **Override Gemini key** (if `.env` key needs updating)
- **Clear all local data** (wipes keys and start date; Notion logs preserved)

### Notion Integration
- **Idempotent logging**: Submit same day multiple times → updates in place, no duplicates
- **Day-aware scoring**: Formula branches on day-of-week (weekday vs. Sat vs. Sun)
- **Weekly rollup**: `get_weekly_stats` queries all entries for a week, calculates average score and total problems
- **Streak tracking**: `get_streak` scans last 60 days, counts consecutive days with ≥1 DSA, skips Sundays

---

## Environment Variables

| Variable | Required | Source | Description |
|---|---|---|---|
| `EXPO_PUBLIC_GOOGLE_API_KEY` | No | `.env` | Gemini API key from aistudio.google.com. Can be left blank; reads from SecureStore if not in `.env`. |
| `EXPO_PUBLIC_GEMINI_MODEL` | No | `.env` | Model name (default: `gemini-2.0-flash`). Used at build time if present, otherwise falls back to default. |
| Notion API key | Yes | SecureStore (setup screen) | `secret_...` from notion.so/my-integrations. Never in `.env`. |
| Start date | Yes | SecureStore (setup screen) | Prep start date (YYYY-MM-DD) for week calculation and date-gating. Locked after setup. |

---

## Claude Code Skills

Project-level slash commands in [`.claude/commands/`](.claude/commands/):

| Command | Description |
|---|---|
| `/add-tool` | Scaffold a new Gemini agent tool across all three required files (tools.ts, agent.ts, notion.ts) |
| `/update-notion` | Update the Notion dashboard directly via MCP (includes all key page/DB IDs) |
| `/build-apk` | Step-by-step EAS APK build and installation guide |

---

## Development Notes

### Testing the App Locally
1. Run `conda activate ranger && npx expo start`
2. Scan QR code with Expo Go
3. On first launch, setup screen appears
4. Enter Notion API key (required), start date (via date picker), optional Gemini key
5. Tap "START" → redirects to tabs
6. Chat tab: ask "What week am I on?" to verify agent context
7. Log Day tab: toggle activities and submit to test Notion write
8. Settings tab: verify date picker and key rotation work

### Rebuilding After Changes
- `lib/agent.ts` changes → no rebuild needed (hot reload)
- `constants/tools.ts` changes → no rebuild needed
- `.env` changes → full rebuild (`eas build`) if building APK; hot reload otherwise
- Package changes → `npm install`, then rebuild
- Type errors → run `npx tsc --noEmit` to verify

### Common Issues
- **"Cannot log before start date"** — expected behavior if today < startDate in setup. Use Settings tab to verify or change start date.
- **"Notion API key not configured"** — ensure Notion integration is connected to the Prep System page (step 5 of setup above)
- **Score formula errors in Notion** — open Daily Log DB and check the Score % property. If the formula doesn't render, manually update it to the day-branched version shown in the schema table above.

---

## Key IDs (for reference)

- **MAANG Prep System page**: `34888ab3-488e-8106-8f22-e37ee58b0d9d`
- **Daily Log database**: `28842f0050534b4a8925edad850dd4b5`
- **Daily Log data source (collection)**: `collection://72fbd185-6e3d-455b-9667-b886025c882c`

Use these IDs with the `/update-notion` skill to modify the Notion dashboard directly.
