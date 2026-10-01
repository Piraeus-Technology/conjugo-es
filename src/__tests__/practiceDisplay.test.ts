import verbs from '../data/verbs.json';
import { type VerbData, imperativeTenses } from '../utils/conjugate';
import { getSnapshotRows } from '../utils/conjugationSnapshot';
import { buildDailyVerbOrder, getVerbOfTheDayIndex } from '../utils/verbOfTheDay';

const dataset = verbs as Record<string, VerbData>;

test('nonfinite snapshots show both the gerund and participle', () => {
  expect(getSnapshotRows('hablar', dataset.hablar, 'gerund_participle').map(row => row.form))
    .toEqual(['hablando', 'hablado']);
});

test.each(imperativeTenses)('%s snapshots include tú and omit disabled yo', tense => {
  const rows = getSnapshotRows('hablar', dataset.hablar, tense);
  expect(rows.map(row => row.pronoun)).toEqual(['tú', 'usted', 'nosotros']);
  expect(rows[0].form).toBe(tense === 'imperative_affirmative' ? 'habla' : 'no hables');
});

test('present snapshots keep yo, third-person singular and nosotros', () => {
  expect(getSnapshotRows('hablar', dataset.hablar, 'present').map(row => row.form))
    .toEqual(['hablo', 'habla', 'hablamos']);
});

test.each([5, 6, 7, 10, 367, 1009, 1010, 1011, 1012, Object.keys(dataset).length])(
  'daily order is a full cycle without alphabetic neighbours for %i verbs', count => {
    const order = buildDailyVerbOrder(count);
    expect([...order].sort((a, b) => a - b)).toEqual(Array.from({ length: count }, (_, index) => index));
    expect(order.every((index, position) => Math.abs(index - order[(position + 1) % count]) > 1)).toBe(true);
    const dates = Array.from({ length: count }, (_, index) => new Date(2026, 0, 1 + index));
    expect(new Set(dates.map(date => getVerbOfTheDayIndex(count, date))).size).toBe(count);
  },
);

test('the daily verb is fixed for the entire local day and survives count changes', () => {
  const early = new Date(2026, 9, 1, 0, 0);
  const late = new Date(2026, 9, 1, 23, 59);
  const index = getVerbOfTheDayIndex(1011, early);
  getVerbOfTheDayIndex(1010, early);
  expect(getVerbOfTheDayIndex(1011, late)).toBe(index);
  expect(getVerbOfTheDayIndex(1011, new Date(1969, 11, 31))).toBeGreaterThanOrEqual(0);
});
