import { applyPromptResult, buildPromptKey, getStoredWeight } from '../store/spacedRepStore';

describe('spaced repetition prompt weighting', () => {
  test('uses legacy verb weight as fallback until a prompt has its own history', () => {
    const weights = { dormir: 1.5 };

    expect(getStoredWeight(weights, 'dormir', 'preterite', 2)).toBe(1.5);
  });

  test('records exact prompt history and keeps legacy verb weight as sibling fallback', () => {
    const nextWeights = applyPromptResult({ dormir: 1.5 }, 'dormir', 'preterite', 2, false);

    // The legacy verb-level weight must survive so the verb's other ~90
    // prompts keep their difficulty signal until individually practiced.
    expect(nextWeights.dormir).toBe(1.5);
    expect(nextWeights[buildPromptKey('dormir', 'preterite', 2)]).toBe(2.25);
    expect(getStoredWeight(nextWeights, 'dormir', 'present', 0)).toBe(1.5);
  });

  test('prefers exact prompt weight over legacy verb weight', () => {
    const promptKey = buildPromptKey('dormir', 'preterite', 2);
    const weights = { dormir: 3, [promptKey]: 1.2 };

    expect(getStoredWeight(weights, 'dormir', 'preterite', 2)).toBe(1.2);
    expect(getStoredWeight(weights, 'dormir', 'present', 2)).toBe(3);
  });
});
