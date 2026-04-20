import type { Tool } from '@google/generative-ai';

export const AGENT_TOOLS: Tool[] = [
  {
    functionDeclarations: [
      {
        name: 'log_daily',
        description:
          "Create or update a daily log entry in Notion. On weekdays tracks Gym + DSA + System Design. On Saturdays tracks DSA + AI Course + Assignments + System Design. Sundays are rest days — only log if user insists. Idempotent: logging the same date twice updates the existing row instead of creating a duplicate.",
        parameters: {
          type: 'object' as any,
          properties: {
            date: {
              type: 'string' as any,
              description: 'YYYY-MM-DD. Defaults to today if omitted. Use for backfilling past days.',
            },
            gym: { type: 'boolean' as any, description: 'Weekday only. Whether gym was completed.' },
            gym_notes: { type: 'string' as any, description: 'Optional notes about the gym session.' },
            dsa: { type: 'boolean' as any, description: 'Whether DSA practice was completed.' },
            dsa_count: { type: 'number' as any, description: 'Number of DSA problems solved today.' },
            dsa_notes: { type: 'string' as any, description: 'Optional notes about the DSA session.' },
            system_design: { type: 'boolean' as any, description: 'Whether system design work was done (optional / unweighted).' },
            sd_notes: { type: 'string' as any, description: 'Optional notes about the system design session.' },
            mock_interview: { type: 'boolean' as any, description: 'Whether a mock interview was done today.' },
            ai_course: { type: 'boolean' as any, description: 'Saturday only. Whether the AI course block was done.' },
            ai_course_notes: { type: 'string' as any, description: 'Optional notes about the AI course.' },
            assignments: { type: 'boolean' as any, description: 'Saturday only. Whether assignments block was done.' },
            assignments_notes: { type: 'string' as any, description: 'Optional notes about the assignments.' },
            notes: { type: 'string' as any, description: 'Overall daily reflection.' },
          },
        },
      },
      {
        name: 'update_daily_log',
        description:
          'Update specific fields of an existing daily log entry for a given date. Only provided fields are modified.',
        parameters: {
          type: 'object' as any,
          properties: {
            date: { type: 'string' as any, description: 'YYYY-MM-DD of the entry to update.' },
            gym: { type: 'boolean' as any },
            gym_notes: { type: 'string' as any },
            dsa: { type: 'boolean' as any },
            dsa_count: { type: 'number' as any },
            dsa_notes: { type: 'string' as any },
            system_design: { type: 'boolean' as any },
            sd_notes: { type: 'string' as any },
            mock_interview: { type: 'boolean' as any },
            ai_course: { type: 'boolean' as any },
            ai_course_notes: { type: 'string' as any },
            assignments: { type: 'boolean' as any },
            assignments_notes: { type: 'string' as any },
            notes: { type: 'string' as any },
          },
          required: ['date'],
        },
      },
      {
        name: 'get_today_log',
        description: "Fetch the existing log entry for a given date (defaults to today). Returns null if none exists.",
        parameters: {
          type: 'object' as any,
          properties: {
            date: { type: 'string' as any, description: 'YYYY-MM-DD. Defaults to today.' },
          },
        },
      },
      {
        name: 'get_week_number',
        description: 'Get the current week number (1–24) in the 6-month MAANG prep plan.',
        parameters: {
          type: 'object' as any,
          properties: {},
        },
      },
      {
        name: 'get_weekly_stats',
        description: 'Get adherence statistics for a specific week: days logged, DSA problem count, mocks, average score.',
        parameters: {
          type: 'object' as any,
          properties: {
            week: {
              type: 'number' as any,
              description: 'Week number to fetch stats for (defaults to current week).',
            },
          },
        },
      },
      {
        name: 'get_streak',
        description:
          "Calculate the user's current streak. Streak rule from the plan's Fallback System: a day counts if DSA ≥ 1 problem was solved, ignoring Sundays (Sunday is an official rest day — does not break the streak).",
        parameters: {
          type: 'object' as any,
          properties: {},
        },
      },
    ],
  },
];
