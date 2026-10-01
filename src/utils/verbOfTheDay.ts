let cachedCount = 0;
let cachedOrder: number[] = [];

export function buildDailyVerbOrder(count: number): number[] {
  // Adjacent items inside a parity group cannot be alphabetic neighbours.
  // Preserve endpoints so the two joins (including the cycle wrap) also
  // avoid neighbours for any dataset with at least five entries.
  const evens = Array.from({ length: Math.ceil(count / 2) }, (_, index) => index * 2);
  const odds = Array.from({ length: Math.floor(count / 2) }, (_, index) => index * 2 + 1);
  let state = (0x9e3779b9 ^ count) >>> 0;
  for (const group of [evens, odds]) {
    for (let index = group.length - 2; index > 1; index -= 1) {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      const other = 1 + ((state >>> 0) % index);
      [group[index], group[other]] = [group[other], group[index]];
    }
  }
  return [...evens, ...odds];
}

export function getVerbOfTheDayIndex(count: number, date = new Date()): number {
  if (count < 1) throw new Error('Verb of the Day requires a nonempty dataset');
  if (cachedCount !== count) {
    cachedCount = count;
    cachedOrder = buildDailyVerbOrder(count);
  }
  // Construct the ordinal from LOCAL calendar fields, independent of DST
  // and the time of day, then use a positive modulo for dates before 1970.
  const localDay = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
  return cachedOrder[((localDay % count) + count) % count];
}
