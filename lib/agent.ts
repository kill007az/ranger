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

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: buildSystemInstruction(startDate),
    tools: AGENT_TOOLS,
  });

  const chat = model.startChat({ history });
  let response = await chat.sendMessage(userMessage);

  while (true) {
    const calls = response.response.functionCalls();
    if (!calls || calls.length === 0) break;
    const results = await Promise.all(calls.map((c) => executeToolCall(c, startDate)));
    response = await chat.sendMessage(
      results.map((result, i) => ({
        functionResponse: { name: calls[i].name, response: { result } },
      }))
    );
  }

  return response.response.text();
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
        dsa: p['DSA Completed']?.checkbox ?? false,
        dsa_count: p['DSA Count']?.number ?? 0,
        system_design: p['System Design']?.checkbox ?? false,
        mock_interview: p['Mock Interview']?.checkbox ?? false,
        ai_course: p['AI Course']?.checkbox ?? false,
        assignments: p.Assignments?.checkbox ?? false,
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
      return {
        week,
        days_logged: pages.length,
        gym_days: gymDays,
        dsa_days: dsaDays,
        system_design_days: sdDays,
        mock_interviews: mocks,
        total_problems_solved: totalProblems,
        avg_score_pct: avgScore,
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

    default:
      return { error: `Unknown tool: ${call.name}` };
  }
}
