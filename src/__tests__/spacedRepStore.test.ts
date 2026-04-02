import { applyPromptResult, buildPromptKey, getStoredWeight } from '../store/spacedRepStore';

describe('spaced repetition prompt weighting', () => {
  test('uses legacy verb weight as fallback until a prompt has its own history', () => {
    const weights = { dormir: 1.5 };

    expect(getStoredWeight(weights, 'dormir', 'preterite', 2)).toBe(1.5);
  });

  test('records exact prompt history and drops legacy verb-only weight', () => {
    const nextWeights = applyPromptResult({ dormir: 1.5 }, 'dormir', 'preterite', 2, false);

    expect(nextWeights.dormir).toBeUndefined();
    expect(nextWeights[buildPromptKey('dormir', 'preterite', 2)]).toBe(2.25);
  });

  test('prefers exact prompt weight over legacy verb weight', () => {
    const promptKey = buildPromptKey('dormir', 'preterite', 2);
    const weights = { dormir: 3, [promptKey]: 1.2 };

    expect(getStoredWeight(weights, 'dormir', 'preterite', 2)).toBe(1.2);
    expect(getStoredWeight(weights, 'dormir', 'present', 2)).toBe(3);
  });
});
