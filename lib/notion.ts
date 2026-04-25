import { Platform } from 'react-native';
import { getNotionKey } from './storage';

const BASE = Platform.OS === 'web' ? 'http://localhost:3001/notion' : 'https://api.notion.com/v1';
const VERSION = '2022-06-28';

export const DAILY_LOG_DB_ID = '28842f0050534b4a8925edad850dd4b5';

async function req(path: string, method: string, body?: object): Promise<any> {
  const key = await getNotionKey();
  if (!key) throw new Error('Notion API key not configured');
  console.log(`[Notion] ${method} ${path}`, body ? JSON.stringify(body).slice(0, 200) : '');
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Notion-Version': VERSION,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`[Notion] ${res.status} error on ${method} ${path}:`, err);
    throw new Error(`Notion API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  console.log(`[Notion] ${res.status} OK — ${data.results?.length ?? 'no'} results`);
  return data;
}

export interface DailyLogEntry {
  day: string;
  date: string;
  week: number;
  gym?: boolean;
  gymNotes?: string;
  dsa?: boolean;
  dsaCount?: number;
  dsaNotes?: string;
  systemDesign?: boolean;
  sdNotes?: string;
  mockInterview?: boolean;
  aiCourse?: boolean;
  aiCourseNotes?: string;
  assignments?: boolean;
  assignmentsNotes?: string;
  notes?: string;
}

function buildProperties(entry: Partial<DailyLogEntry> & { day?: string; date?: string; week?: number }) {
  const p: Record<string, any> = {};
  if (entry.day !== undefined) p.Day = { title: [{ text: { content: entry.day } }] };
  if (entry.date !== undefined) p.Date = { date: { start: entry.date } };
  if (entry.week !== undefined) p.Week = { number: entry.week };
  if (entry.gym !== undefined) p.Gym = { checkbox: entry.gym };
  if (entry.gymNotes !== undefined) p['Gym Notes'] = { rich_text: [{ text: { content: entry.gymNotes } }] };
  if (entry.dsa !== undefined) p['DSA Completed'] = { checkbox: entry.dsa };
  if (entry.dsaCount !== undefined) p['DSA Count'] = { number: entry.dsaCount };
  if (entry.dsaNotes !== undefined) p['DSA Notes'] = { rich_text: [{ text: { content: entry.dsaNotes } }] };
  if (entry.systemDesign !== undefined) p['System Design'] = { checkbox: entry.systemDesign };
  if (entry.sdNotes !== undefined) p['SD Notes'] = { rich_text: [{ text: { content: entry.sdNotes } }] };
  if (entry.mockInterview !== undefined) p['Mock Interview'] = { checkbox: entry.mockInterview };
  if (entry.aiCourse !== undefined) p['AI Course'] = { checkbox: entry.aiCourse };
  if (entry.aiCourseNotes !== undefined) p['AI Course Notes'] = { rich_text: [{ text: { content: entry.aiCourseNotes } }] };
  if (entry.assignments !== undefined) p.Assignments = { checkbox: entry.assignments };
  if (entry.assignmentsNotes !== undefined) p['Assignments Notes'] = { rich_text: [{ text: { content: entry.assignmentsNotes } }] };
  if (entry.notes !== undefined) p.Notes = { rich_text: [{ text: { content: entry.notes } }] };
  return p;
}

async function findEntryByDate(date: string): Promise<any | null> {
  const result = await req(`/databases/${DAILY_LOG_DB_ID}/query`, 'POST', {
    filter: { property: 'Date', date: { equals: date } },
    page_size: 1,
  });
  return result.results?.[0] ?? null;
}

export async function upsertDailyLogEntry(entry: DailyLogEntry) {
  const existing = await findEntryByDate(entry.date);
  const properties = buildProperties(entry);
  if (existing) {
    return req(`/pages/${existing.id}`, 'PATCH', { properties });
  }
  return req('/pages', 'POST', {
    parent: { database_id: DAILY_LOG_DB_ID },
    properties,
  });
}

export async function updateDailyLogEntryByDate(date: string, updates: Partial<DailyLogEntry>) {
  const existing = await findEntryByDate(date);
  if (!existing) throw new Error(`No log entry exists for ${date}. Use upsertDailyLogEntry to create one.`);
  const properties = buildProperties(updates);
  return req(`/pages/${existing.id}`, 'PATCH', { properties });
}

export async function getEntryByDate(date: string) {
  return findEntryByDate(date);
}

export async function queryWeekEntries(week: number) {
  return req(`/databases/${DAILY_LOG_DB_ID}/query`, 'POST', {
    filter: {
      property: 'Week',
      number: { equals: week },
    },
    sorts: [{ property: 'Date', direction: 'ascending' }],
  });
}

export async function queryRecentEntries(days: number) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  return req(`/databases/${DAILY_LOG_DB_ID}/query`, 'POST', {
    filter: {
      property: 'Date',
      date: { on_or_after: since.toISOString().split('T')[0] },
    },
    sorts: [{ property: 'Date', direction: 'descending' }],
  });
}

export async function queryTodayEntry(date: string) {
  return req(`/databases/${DAILY_LOG_DB_ID}/query`, 'POST', {
    filter: {
      property: 'Date',
      date: { equals: date },
    },
  });
}

export const createDailyLogEntry = upsertDailyLogEntry;
