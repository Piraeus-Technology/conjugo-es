import { buildCalendarWeeks, buildDayKey, computeStreak } from '../utils/activityCalendar';
import { dateToDayKey } from '../utils/dayKey';

function daysAgoKey(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return dateToDayKey(d);
}

describe('dateToDayKey', () => {
  test('formats local dates as zero-padded YYYY-MM-DD', () => {
    expect(dateToDayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(dateToDayKey(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});

describe('buildCalendarWeeks', () => {
  test('June 2026 starts on a Monday and fills six columns of padding at the end', () => {
    const weeks = buildCalendarWeeks(2026, 5); // June 2026: the 1st is a Monday
    expect(weeks[0][0]).toBe(1);
    expect(weeks.every(w => w.length === 7)).toBe(true);
    const days = weeks.flat().filter((d): d is number => d !== null);
    expect(days).toHaveLength(30);
    expect(days[0]).toBe(1);
    expect(days[days.length - 1]).toBe(30);
  });

  test('February 2026 starts on a Sunday (offset 6)', () => {
    const weeks = buildCalendarWeeks(2026, 1); // Feb 1 2026 is a Sunday
    expect(weeks[0].slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(weeks[0][6]).toBe(1);
    expect(weeks.flat().filter(d => d !== null)).toHaveLength(28);
  });
});

describe('buildDayKey', () => {
  test('pads month and day', () => {
    expect(buildDayKey(2026, 0, 5)).toBe('2026-01-05');
    expect(buildDayKey(2026, 10, 25)).toBe('2026-11-25');
  });
});

describe('computeStreak', () => {
  test('counts consecutive days ending today', () => {
    const active = new Set([daysAgoKey(0), daysAgoKey(1), daysAgoKey(2)]);
    expect(computeStreak((key) => active.has(key))).toBe(3);
  });

  test('keeps the streak alive when today has no activity yet', () => {
    const active = new Set([daysAgoKey(1), daysAgoKey(2)]);
    expect(computeStreak((key) => active.has(key))).toBe(2);
  });

  test('returns zero when the last activity was two days ago', () => {
    const active = new Set([daysAgoKey(2), daysAgoKey(3)]);
    expect(computeStreak((key) => active.has(key))).toBe(0);
  });

  test('stops at the first gap', () => {
    const active = new Set([daysAgoKey(0), daysAgoKey(1), daysAgoKey(3)]);
    expect(computeStreak((key) => active.has(key))).toBe(2);
  });
});
