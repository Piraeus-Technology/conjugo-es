import verbs from '../data/verbs.json';
import {
  getFamilyKey,
  getInflectionNotes,
  getOverrideExample,
  getRuleNotes,
} from '../utils/conjugationInsights';
import { allTenses, conjugate, getBareVerbData, type VerbData } from '../utils/conjugate';

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
      'atreverse',
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
      if (explainsIrregularity === verb.regular) return [infinitive];
      if (!verb.regular) return [];
      const unmarked = { ...getBareVerbData(verb), pattern: undefined, overrides: undefined };
      const hasIrregularForm = allTenses.some(tense => {
        const regular = conjugate(infinitive, unmarked, tense);
        return conjugate(infinitive, verb, tense).some((row, index) => !row.disabled && row.form !== regular[index].form);
      });
      return hasIrregularForm ? [infinitive] : [];
    });
    expect(issues).toEqual([]);
    expect(getRuleNotes('competer', verbData.competer)).toContain('This use has no imperative forms.');
    expect(getInflectionNotes('competer', verbData.competer)).toEqual([]);
    expect(getInflectionNotes('acontecer', verbData.acontecer)).toEqual([
      'In the present subjunctive, the stem changes from -c- to -zc-, as in acontezca.',
    ]);
  });

  test('every override note shows a changed form and names the change', () => {
    const overridden = Object.entries(verbData).filter(([, verb]) => {
      const base = getBareVerbData(verb);
      return base.overrides || base.pattern?.fullOverrides;
    });
    for (const [infinitive, verb] of overridden) {
      const example = getOverrideExample(infinitive, verb)!;
      expect(example.form).not.toBe(example.regularForm);
      expect(example.form).toBe(conjugate(infinitive, verb, example.tense)[example.personIndex].form);
      expect(getRuleNotes(infinitive, verb)).toContain(`Change in ${example.difference}: ${example.form}.`);
    }
    expect(getOverrideExample('averiguar', verbData.averiguar)).toMatchObject({ form: 'averigüé', difference: 'spelling' });
    expect(getOverrideExample('confiar', verbData.confiar)).toMatchObject({ form: 'confío', difference: 'accent' });
  });
});
