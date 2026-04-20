export type DayType = 'weekday' | 'saturday' | 'sunday';

export function getCurrentWeek(startDateStr: string): number {
  const start = new Date(startDateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  return Math.min(Math.max(Math.ceil((diffDays + 1) / 7), 1), 24);
}

export function getWeekForDate(startDateStr: string, dateStr: string): number {
  const start = new Date(startDateStr);
  const target = new Date(dateStr);
  const diffDays = Math.floor((target.getTime() - start.getTime()) / 86_400_000);
  return Math.min(Math.max(Math.ceil((diffDays + 1) / 7), 1), 24);
}

export function getWeekDates(startDateStr: string, week: number): { start: string; end: string } {
  const start = new Date(startDateStr);
  start.setDate(start.getDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

export function getDayType(dateStr: string): DayType {
  const d = new Date(dateStr);
  const dow = d.getDay();
  if (dow === 0) return 'sunday';
  if (dow === 6) return 'saturday';
  return 'weekday';
}

export function isBeforeStart(startDateStr: string, dateStr: string): boolean {
  return new Date(dateStr) < new Date(startDateStr);
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}
