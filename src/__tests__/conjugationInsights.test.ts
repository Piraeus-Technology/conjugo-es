import verbs from '../data/verbs.json';
import {
  getFamilyKey,
  getInflectionNotes,
  getOverrideExample,
  getRuleNotes,
} from '../utils/conjugationInsights';
import type { VerbData } from '../utils/conjugate';

const verbData = verbs as Record<string, VerbData>;

describe('conjugation insights', () => {
  test('the ver family does not absorb unrelated -ver suffixes', () => {
    const verKey = getFamilyKey('ver', verbData.ver);

    expect(verKey).toBe('base:ver');
    expect(getFamilyKey('prever', verbData.prever)).toBe(verKey);
    expect(getFamilyKey('entrever', verbData.entrever)).toBe(verKey);

    for (const unrelated of [
      'volver',
      'mover',
      'llover',
      'devolver',
      'resolver',
      'envolver',
      'promover',
      'remover',
      'disolver',
      'conmover',
      'atrever',
    ]) {
      expect(getFamilyKey(unrelated, verbData[unrelated])).not.toBe(verKey);
    }
  });

  test.each([
    'oír',
    'leer',
    'reír',
    'sonreír',
    'caer',
    'traer',
    'creer',
    'poseer',
    'abstraer',
  ])('%s does not label its regular accented participle as irregular', (infinitive) => {
    expect(getRuleNotes(infinitive, verbData[infinitive])).not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^Irregular past participle:/),
      ]),
    );
  });

  test('a genuinely irregular participle is still identified', () => {
    expect(getRuleNotes('hacer', verbData.hacer)).toContain(
      'Irregular past participle: hecho.',
    );
  });

  test('irregular badges have notes and regular badges do not have irregular form notes', () => {
    const issues = Object.entries(verbData).flatMap(([infinitive, verb]) => {
      const explainsIrregularity = getInflectionNotes(infinitive, verb).length > 0;
      return explainsIrregularity === !verb.regular ? [] : [infinitive];
    });
    expect(issues).toEqual([]);
    expect(getRuleNotes('competer', verbData.competer)).toContain('This use has no imperative forms.');
    expect(getInflectionNotes('competer', verbData.competer)).toEqual([]);
  });

  test('every override note shows a changed form and names the change', () => {
    const overridden = Object.entries(verbData).filter(([, verb]) => verb.overrides || verb.pattern?.fullOverrides);
    expect(overridden).toHaveLength(39);
    for (const [infinitive, verb] of overridden) {
      const example = getOverrideExample(infinitive, verb)!;
      expect(example.form).not.toBe(example.regularForm);
      expect(getRuleNotes(infinitive, verb)).toContain(`Change in ${example.difference}: ${example.form}.`);
    }
    expect(getOverrideExample('averiguar', verbData.averiguar)).toMatchObject({ form: 'averigüé', difference: 'spelling' });
    expect(getOverrideExample('confiar', verbData.confiar)).toMatchObject({ form: 'confío', difference: 'accent' });
  });
});
