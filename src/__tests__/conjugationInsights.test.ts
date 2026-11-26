import verbs from '../data/verbs.json';
import {
  getFamilyKey,
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
      const notes = getRuleNotes(infinitive, verb);
      const explainsIrregularity = notes.some(note => !note.startsWith('Used as '));
      return explainsIrregularity === !verb.regular ? [] : [infinitive];
    });
    expect(issues).toEqual([]);
  });
});
