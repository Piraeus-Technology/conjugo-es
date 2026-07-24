import { allTenses, type Tense } from '../utils/conjugate';

// This is a compile-time regression guard: it fails typecheck on the old
// Record<string, ...> definition because the @ts-expect-error is then unused.
// @ts-expect-error arbitrary strings are not valid tenses
const invalidTense: Tense = 'preterito_totally_made_up';

describe('tense types', () => {
  test('retain the supported literal tense values at runtime', () => {
    expect(allTenses).toContain('preterite');
    expect(allTenses).not.toContain(invalidTense);
  });
});
