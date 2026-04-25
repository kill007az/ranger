import { GoogleGenerativeAI } from '@google/generative-ai';
import { getGeminiKey, getStartDate } from './storage';
import {
  upsertDailyLogEntry,
  updateDailyLogEntryByDate,
  queryWeekEntries,
  queryRecentEntries,
  getEntryByDate,
} from './notion';
import { getCurrentWeek, getDayType, getWeekForDate, isBeforeStart, todayISO } from './weekTracker';
import { AGENT_TOOLS } from '../constants/tools';

const BASE_SYSTEM = `You are Ranger, a focused assistant for a 6-month MAANG interview prep plan.
You help log daily progress, answer questions about the prep roadmap, and track adherence.
Be concise and direct.

PLAN STRUCTURE (24 weeks):
- W1–4: Arrays, Strings, Sliding Window, Recursion
- W5–8: Binary Search, Stacks, Trees, Trie
- W9–12: Graphs, Heaps, Intervals
- W13–16: Dynamic Programming
- W17–20: Mixed Practice + Mocks + System Design
- W21–24: Mock-Heavy + Applications

DAILY SCHEDULE (Mon–Fri):
- Gym (1h15), DSA Deep Work (1h30), System Design is OPTIONAL.

SATURDAY: DSA Deep Work (2h), AI Course (2h), Assignments (2–3h), System Design (optional, 1h). No gym block.

SUNDAY: Completely OFF. Rest day. Never nag the user to log on Sunday. If they ask what to do on Sunday, tell them to rest.

ADHERENCE SCORING:
- Weekday: (Gym + DSA) / 2 × 100. System Design is tracked but NOT scored.
- Saturday: (DSA + AI Course + Assignments) / 3 × 100. System Design tracked but not scored.
- Sunday: 0 (rest).

FALLBACK RULE (streak preservation): solve at least 1 DSA problem to maintain streak. Gym is optional on bad days. Sunday is exempt from streak (rest day doesn't break it).

TOOL USE:
- When user asks to log, call log_daily. It is idempotent — safe to call even if already logged today; it updates in place.
- When user asks for stats/progress, call get_weekly_stats or get_streak.
- When user asks about "last week", "this week", "week N", what problems they worked on, or any week-level question — call get_weekly_stats (not get_today_log).
- get_today_log is only for fetching a single specific day's entry.
- If the user mentions a past date for backfilling, pass the date parameter to log_daily.
- Always confirm what was logged and show the adherence score.`;

export interface ChatMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

function buildSystemInstruction(startDate: string | null): string {
  const today = todayISO();
  const dow = new Date(today).toLocaleDateString('en-US', { weekday: 'long' });
  const dayType = getDayType(today);
  const ctx: string[] = [BASE_SYSTEM, ''];
  ctx.push(`CURRENT CONTEXT:`);
  ctx.push(`- Today: ${today} (${dow})`);
  ctx.push(`- Day type: ${dayType}`);
  if (startDate) {
    const week = getCurrentWeek(startDate);
    ctx.push(`- Prep start date: ${startDate}`);
    ctx.push(`- Current week: ${week} of 24`);
    if (isBeforeStart(startDate, today)) {
      ctx.push(`- NOTE: today is BEFORE the prep start date. Logging is disabled until ${startDate}.`);
    }
  } else {
    ctx.push(`- Prep start date: NOT SET. Tell the user to set it in Settings.`);
  }
  return ctx.join('\n');
}

export async function runAgent(
  userMessage: string,
  history: ChatMessage[] = []
): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_API_KEY ?? (await getGeminiKey());
  if (!apiKey) throw new Error('Gemini API key not configured. Check your .env or Settings.');

  const modelName = process.env.EXPO_PUBLIC_GEMINI_MODEL ?? 'gemini-2.0-flash';
  const startDate = await getStartDate();

  console.log('\n[Ranger] ═══════════════════════════════');
  console.log(`[Ranger] USER: "${userMessage}"`);
  console.log(`[Ranger] model: ${modelName} | startDate: ${startDate} | historyLen: ${history.length}`);

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: buildSystemInstruction(startDate),
    tools: AGENT_TOOLS,
  });

  const chat = model.startChat({ history });
  let response = await chat.sendMessage(userMessage);

  let iterations = 0;
  while (iterations++ < 5) {
    const calls = response.response.functionCalls();
    if (!calls || calls.length === 0) break;
    console.log(`[Ranger] [iter ${iterations}] tool calls: ${calls.map((c) => c.name).join(', ')}`);
    const results = await Promise.all(calls.map(async (c) => {
      console.log(`[Ranger]   → ${c.name}(${JSON.stringify(c.args)})`);
      try {
        const result = await executeToolCall(c, startDate);
        console.log(`[Ranger]   ← ${c.name}: ${JSON.stringify(result)}`);
        return result;
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        console.error(`[Ranger]   ✗ ${c.name} ERROR: ${msg}`);
        return { error: msg, do_not_retry: true };
      }
    }));
    response = await chat.sendMessage(
      results.map((result, i) => ({
        functionResponse: { name: calls[i].name, response: { result } },
      }))
    );
  }

  const finalText = response.response.text();
  console.log(`[Ranger] REPLY: "${finalText.slice(0, 300)}${finalText.length > 300 ? '…' : ''}"`);
  console.log('[Ranger] ═══════════════════════════════\n');
  return finalText;
}

function calcScoreForDate(date: string, props: {
  gym?: boolean;
  dsa?: boolean;
  aiCourse?: boolean;
  assignments?: boolean;
}): number {
  const type = getDayType(date);
  if (type === 'sunday') return 0;
  if (type === 'saturday') {
    const completed = [props.dsa, props.aiCourse, props.assignments].filter(Boolean).length;
    return Math.round((completed / 3) * 100);
  }
  const completed = [props.gym, props.dsa].filter(Boolean).length;
  return Math.round((completed / 2) * 100);
}

async function executeToolCall(
  call: { name: string; args: Record<string, any> },
  startDate: string | null
): Promise<object> {
  const effectiveStart = startDate ?? todayISO();

  switch (call.name) {
    case 'log_daily': {
      const date = (call.args.date as string) ?? todayISO();
      if (startDate && isBeforeStart(startDate, date)) {
        return { success: false, error: `Cannot log — ${date} is before the prep start date (${startDate}).` };
      }
      const dayType = getDayType(date);
      const week = getWeekForDate(effectiveStart, date);
      const entry = {
        day: date,
        date,
        week,
        gym: dayType === 'weekday' ? !!call.args.gym : false,
        gymNotes: call.args.gym_notes ?? '',
        dsa: !!call.args.dsa,
        dsaCount: call.args.dsa_count ?? 0,
        dsaNotes: call.args.dsa_notes ?? '',
        systemDesign: !!call.args.system_design,
        sdNotes: call.args.sd_notes ?? '',
        mockInterview: !!call.args.mock_interview,
        aiCourse: dayType === 'saturday' ? !!call.args.ai_course : false,
        aiCourseNotes: call.args.ai_course_notes ?? '',
        assignments: dayType === 'saturday' ? !!call.args.assignments : false,
        assignmentsNotes: call.args.assignments_notes ?? '',
        notes: call.args.notes ?? '',
      };
      await upsertDailyLogEntry(entry);
      const score = calcScoreForDate(date, entry);
      return {
        success: true,
        date,
        day_type: dayType,
        week,
        score_pct: score,
        dsa_count: entry.dsaCount,
        mock_interview: entry.mockInterview,
      };
    }

    case 'update_daily_log': {
      const date = call.args.date as string;
      if (!date) return { error: 'date is required' };
      const updates: Record<string, any> = {};
      const map: Record<string, string> = {
        gym: 'gym', gym_notes: 'gymNotes',
        dsa: 'dsa', dsa_count: 'dsaCount', dsa_notes: 'dsaNotes',
        system_design: 'systemDesign', sd_notes: 'sdNotes',
        mock_interview: 'mockInterview',
        ai_course: 'aiCourse', ai_course_notes: 'aiCourseNotes',
        assignments: 'assignments', assignments_notes: 'assignmentsNotes',
        notes: 'notes',
      };
      for (const [from, to] of Object.entries(map)) {
        if (call.args[from] !== undefined) updates[to] = call.args[from];
      }
      await updateDailyLogEntryByDate(date, updates);
      return { success: true, date, updated_fields: Object.keys(updates) };
    }

    case 'get_today_log': {
      const date = (call.args.date as string) ?? todayISO();
      const page = await getEntryByDate(date);
      if (!page) return { date, exists: false };
      const p = page.properties ?? {};
      return {
        date,
        exists: true,
        gym: p.Gym?.checkbox ?? false,
        gym_notes: p['Gym Notes']?.rich_text?.[0]?.plain_text ?? '',
        dsa: p['DSA Completed']?.checkbox ?? false,
        dsa_count: p['DSA Count']?.number ?? 0,
        dsa_notes: p['DSA Notes']?.rich_text?.[0]?.plain_text ?? '',
        system_design: p['System Design']?.checkbox ?? false,
        sd_notes: p['SD Notes']?.rich_text?.[0]?.plain_text ?? '',
        mock_interview: p['Mock Interview']?.checkbox ?? false,
        ai_course: p['AI Course']?.checkbox ?? false,
        ai_course_notes: p['AI Course Notes']?.rich_text?.[0]?.plain_text ?? '',
        assignments: p.Assignments?.checkbox ?? false,
        assignments_notes: p['Assignments Notes']?.rich_text?.[0]?.plain_text ?? '',
        score_pct: p['Score %']?.formula?.number ?? 0,
        notes: p.Notes?.rich_text?.[0]?.plain_text ?? '',
      };
    }

    case 'get_week_number': {
      const week = getCurrentWeek(effectiveStart);
      return { current_week: week, total_weeks: 24, weeks_remaining: 24 - week };
    }

    case 'get_weekly_stats': {
      const week = call.args.week ?? getCurrentWeek(effectiveStart);
      const data = await queryWeekEntries(week);
      const pages = (data.results ?? []) as any[];
      const dsaDays = pages.filter((p) => p.properties?.['DSA Completed']?.checkbox).length;
      const gymDays = pages.filter((p) => p.properties?.Gym?.checkbox).length;
      const sdDays = pages.filter((p) => p.properties?.['System Design']?.checkbox).length;
      const mocks = pages.filter((p) => p.properties?.['Mock Interview']?.checkbox).length;
      const totalProblems = pages.reduce((s, p) => s + (p.properties?.['DSA Count']?.number ?? 0), 0);
      const avgScore = pages.length > 0
        ? Math.round(
            pages.reduce((s, p) => s + (p.properties?.['Score %']?.formula?.number ?? 0), 0) / pages.length
          )
        : 0;
      const entries = pages.map((p) => ({
        date: p.properties?.Date?.date?.start ?? '',
        gym_notes: p.properties?.['Gym Notes']?.rich_text?.[0]?.plain_text ?? '',
        dsa_notes: p.properties?.['DSA Notes']?.rich_text?.[0]?.plain_text ?? '',
        sd_notes: p.properties?.['SD Notes']?.rich_text?.[0]?.plain_text ?? '',
        ai_course_notes: p.properties?.['AI Course Notes']?.rich_text?.[0]?.plain_text ?? '',
        assignments_notes: p.properties?.['Assignments Notes']?.rich_text?.[0]?.plain_text ?? '',
        notes: p.properties?.Notes?.rich_text?.[0]?.plain_text ?? '',
      })).filter((e) => Object.values(e).some((v, i) => i > 0 && v !== ''));
      return {
        week,
        days_logged: pages.length,
        gym_days: gymDays,
        dsa_days: dsaDays,
        system_design_days: sdDays,
        mock_interviews: mocks,
        total_problems_solved: totalProblems,
        avg_score_pct: avgScore,
        daily_notes: entries,
      };
    }

    case 'get_streak': {
      const data = await queryRecentEntries(60);
      const pages = (data.results ?? []) as any[];
      const byDate = new Map<string, any>();
      for (const p of pages) {
        const d = p.properties?.Date?.date?.start;
        if (d) byDate.set(d, p);
      }
      let streak = 0;
      const cursor = new Date();
      for (let i = 0; i < 60; i++) {
        const iso = cursor.toISOString().split('T')[0];
        const type = getDayType(iso);
        if (type === 'sunday') {
          cursor.setDate(cursor.getDate() - 1);
          continue;
        }
        const page = byDate.get(iso);
        const count = page?.properties?.['DSA Count']?.number ?? 0;
        const dsaDone = page?.properties?.['DSA Completed']?.checkbox ?? false;
        if (count >= 1 || dsaDone) {
          streak++;
          cursor.setDate(cursor.getDate() - 1);
        } else {
          break;
        }
      }
      return { streak_days: streak, rule: 'DSA ≥ 1 problem per day; Sundays skipped (rest day exempt).' };
    }

    case 'get_roadmap': {
      const week = call.args.week as number | undefined;
      const roadmap: Record<number, { topic: string; problem_types: string; goal: string }> = {
        1:  { topic: 'Arrays + Hashmaps',              problem_types: 'Two Sum patterns, frequency maps, prefix sums',                        goal: '10–12 problems · master hashmap patterns' },
        2:  { topic: 'Strings',                        problem_types: 'Anagrams, palindromes, substring search',                              goal: '10–12 problems · 2 timed sessions' },
        3:  { topic: 'Sliding Window + Two Pointers',  problem_types: 'Fixed window, variable window, two pointer patterns',                  goal: '10–12 problems · identify all pattern types' },
        4:  { topic: 'Recursion + Backtracking Intro', problem_types: 'Subsets, permutations, combinations',                                  goal: '10–12 problems · week review' },
        5:  { topic: 'Binary Search',                  problem_types: 'Classic, rotated arrays, search space reduction',                      goal: '10–12 problems · recognize search space' },
        6:  { topic: 'Stacks + Monotonic Stack',       problem_types: 'Next greater element, min stack, daily temperatures',                  goal: '10–12 problems · master monotonic pattern' },
        7:  { topic: 'Trees I',                        problem_types: 'Traversals, BST operations, LCA',                                      goal: '10–12 problems · all traversal types fluent' },
        8:  { topic: 'Trees II + Trie',                problem_types: 'Path sum, serialize/deserialize, prefix tree',                         goal: '10–12 problems · 1 mock interview' },
        9:  { topic: 'Graphs I',                       problem_types: 'BFS/DFS, connected components, number of islands',                     goal: '10–12 problems · both traversals fluent' },
        10: { topic: 'Graphs II',                      problem_types: 'Topological sort, cycle detection, union-find',                        goal: '10–12 problems · 1 mock interview' },
        11: { topic: 'Heaps + Priority Queue',         problem_types: 'Top K elements, merge K lists, median stream',                         goal: '10–12 problems · master heap patterns' },
        12: { topic: 'Intervals',                      problem_types: 'Merge intervals, insert interval, meeting rooms',                      goal: '10–12 problems · 1 system design session' },
        13: { topic: 'DP I — 1D',                      problem_types: 'Climbing stairs, coin change, house robber, decode ways',              goal: '10–12 problems · identify recurrence' },
        14: { topic: 'DP II — 2D',                     problem_types: 'Grid paths, LCS, edit distance, unique paths',                         goal: '10–12 problems · 2D state transitions' },
        15: { topic: 'DP III — Knapsack + Partitions', problem_types: '0/1 knapsack, partition equal subset, palindrome partitioning',        goal: '10–12 problems · 1 mock interview' },
        16: { topic: 'DP IV — Advanced + Review',      problem_types: 'Burst balloons, regex matching, longest increasing subsequence',       goal: '10–12 problems · full DP review' },
        17: { topic: 'Mixed Practice',                 problem_types: 'Random Blind 75 / NeetCode 150 problems',                              goal: '15 problems · identify weak spots' },
        18: { topic: 'Mock Interviews',                problem_types: 'Timed pairs under interview conditions',                                goal: '2 full mocks · track performance' },
        19: { topic: 'System Design I',                problem_types: 'URL shortener, rate limiter, key-value store',                         goal: '2 system design sessions · 10 problems' },
        20: { topic: 'System Design II',               problem_types: 'Distributed systems, scalability, DB design',                          goal: '2 system design sessions · 2 mocks' },
        21: { topic: 'Weak Area Drilling',             problem_types: 'Re-do hardest problems from weakest topics',                           goal: '15 targeted problems · 2 mocks' },
        22: { topic: 'Mock-Heavy + Behavioral',        problem_types: 'Full mocks + STAR stories, behavioral prep',                           goal: '3 mocks · finalize behavioral answers' },
        23: { topic: 'Company-Specific Prep',          problem_types: 'LeetCode company tags, recent interview reports',                      goal: '15 targeted problems · 2 mocks · apps out' },
        24: { topic: 'Final Polish',                   problem_types: 'Light practice, system design review, stay sharp',                     goal: '2 mocks · full review · applications active' },
      };
      if (week !== undefined) {
        const entry = roadmap[week];
        return entry ? { week, ...entry } : { error: `No roadmap entry for week ${week}` };
      }
      return { roadmap: Object.entries(roadmap).map(([w, v]) => ({ week: Number(w), ...v })) };
    }

    case 'list_tools':
      return {
        tools: [
          { name: 'log_daily', description: 'Create or update a daily log entry in Notion.' },
          { name: 'update_daily_log', description: 'Update specific fields of an existing log entry by date.' },
          { name: 'get_today_log', description: 'Fetch the full log entry for a given date (defaults to today).' },
          { name: 'get_week_number', description: 'Get the current week number (1–24) in the prep plan.' },
          { name: 'get_weekly_stats', description: 'Get adherence stats + daily notes for a given week.' },
          { name: 'get_streak', description: 'Calculate the current DSA streak (Sundays exempt).' },
          { name: 'get_roadmap', description: 'Fetch topic, problem types, and goal for any week (1–24).' },
          { name: 'list_tools', description: 'List all available tools.' },
        ],
      };

    default:
      return { error: `Unknown tool: ${call.name}` };
  }
}
