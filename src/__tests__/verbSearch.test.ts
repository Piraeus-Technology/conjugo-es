import {
  __searchConjugationsForTests,
  getExactConjugationMatches,
  normalizeSearchText,
  searchConjugations,
} from '../utils/verbSearch';

describe('conjugation search', () => {
  test('scans in bounded chunks without retaining the full conjugation matrix', async () => {
    let chunkStarted = performance.now();
    let longestChunkMs = 0;
    let yieldCount = 0;

    const started = performance.now();
    const stats = await __searchConjugationsForTests('hablamos', async () => {
      longestChunkMs = Math.max(longestChunkMs, performance.now() - chunkStarted);
      yieldCount += 1;
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      chunkStarted = performance.now();
    });
    const totalMs = performance.now() - started;

    expect(yieldCount).toBeGreaterThan(50);
    expect(longestChunkMs).toBeLessThan(75);
    expect(totalMs).toBeLessThan(5000);
    expect(stats.evaluatedFormCount).toBeGreaterThan(50_000);
    expect(stats.retainedMatchCount).toBeLessThan(stats.evaluatedFormCount / 10);
    expect(stats.yieldCount).toBe(yieldCount);
  });

  test('retains exact and fuzzy conjugation results', async () => {
    const exact = await getExactConjugationMatches(normalizeSearchText('hablo'));
    expect(exact).toEqual(expect.arrayContaining([
      expect.objectContaining({
        infinitive: 'hablar',
        tense: 'present',
        pronoun: 'yo',
        form: 'hablo',
      }),
    ]));

    const fuzzy = await searchConjugations('hablamos');
    expect(fuzzy.map((result) => result.item)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        infinitive: 'hablar',
        form: 'hablamos',
      }),
    ]));
  });
});
