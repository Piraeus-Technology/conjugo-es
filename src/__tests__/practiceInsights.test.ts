import { buildPracticeInsights, parsePromptWeights } from '../utils/practiceInsights';

// Weight keys are verb::tense::personIndex, and only weights above 1 count as
// challenging enough to surface.
const key = (verb: string, tense: string, person: number) => `${verb}::${tense}::${person}`;

describe('parsePromptWeights', () => {
  test('keeps every valid person index and drops out-of-range ones', () => {
    const weights = {
      [key('hablar', 'present', 0)]: 2,
      [key('hablar', 'present', 5)]: 2,
      [key('hablar', 'present', 6)]: 2,
      [key('hablar', 'present', -1)]: 2,
      [key('hablar', 'not_a_tense', 1)]: 2,
    };
    expect(parsePromptWeights(weights).map(e => e.personIndex)).toEqual([0, 5]);
  });
});

describe('buildPracticeInsights person labels', () => {
  test('imperative prompts are labelled usted/ustedes, never third person', () => {
    const insights = buildPracticeInsights({
      [key('comer', 'imperative_affirmative', 5)]: 4,
      [key('comer', 'imperative_negative', 2)]: 3,
    });

    const labels = insights.weakForms.map(f => f.label);
    expect(labels).toContain('comer · Imperative (+) · ustedes');
    expect(labels).toContain('comer · Imperative (−) · usted');
    expect(labels.join(' ')).not.toContain('ellos');
    expect(labels.join(' ')).not.toContain('él/ella');
  });

  test('non-imperative prompts keep the third-person labels', () => {
    const insights = buildPracticeInsights({ [key('comer', 'present', 5)]: 4 });
    expect(insights.weakForms[0].label).toBe('comer · Present · ellos/ellas/Uds.');
  });

  test('weakPersons labels all-imperative buckets usted/ustedes', () => {
    const insights = buildPracticeInsights({
      [key('comer', 'imperative_affirmative', 5)]: 4,
      [key('hablar', 'imperative_negative', 5)]: 2,
      [key('comer', 'imperative_negative', 2)]: 3,
    });

    expect(insights.weakPersons).toEqual(expect.arrayContaining([
      { label: 'ustedes', weight: 3, count: 2 },
      { label: 'usted', weight: 3, count: 1 },
    ]));
    expect(insights.weakPersons.map(person => person.label).join(' ')).not.toMatch(/él|ellos/);
  });

  // When imperative and indicative prompts land in the same person bucket, the
  // composite spelling stays true for both readings.
  test('weakPersons aggregates imperative and indicative into one labelled bucket', () => {
    const insights = buildPracticeInsights({
      [key('comer', 'imperative_affirmative', 5)]: 4,
      [key('hablar', 'present', 5)]: 2,
    });

    const bucket = insights.weakPersons.filter(p => p.label === 'ellos/ellas/Uds.');
    expect(bucket).toHaveLength(1);
    expect(bucket[0].count).toBe(2);
  });
});
