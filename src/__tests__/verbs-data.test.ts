import { conjugate, VerbData, allTenses, Tense } from '../utils/conjugate';
import verbs from '../data/verbs.json';

const verbEntries = Object.entries(verbs as Record<string, VerbData>);

describe('Verb database integrity', () => {
  test('has at least 1000 verbs', () => {
    expect(verbEntries.length).toBeGreaterThanOrEqual(1000);
  });

  test('all verbs have required fields', () => {
    for (const [infinitive, data] of verbEntries) {
      expect(data.type).toMatch(/^(ar|er|ir)$/);
      expect(typeof data.regular).toBe('boolean');
      expect(typeof data.translation).toBe('string');
      expect(data.translation.length).toBeGreaterThan(0);
      expect(infinitive.length).toBeGreaterThan(1);
    }
  });

  test('all verb infinitives end in -ar, -er, or -ir', () => {
    for (const [infinitive, data] of verbEntries) {
      const ending = infinitive.slice(-2);
      // Some verbs like "oír" end in -ír
      const normalizedEnding = ending.replace('í', 'i');
      expect(['ar', 'er', 'ir']).toContain(normalizedEnding);
    }
  });

  test('all verbs conjugate without errors across all tenses', () => {
    for (const [infinitive, data] of verbEntries) {
      for (const tense of allTenses) {
        expect(() => conjugate(infinitive, data, tense)).not.toThrow();
        const results = conjugate(infinitive, data, tense);
        if (tense === 'gerund_participle') {
          expect(results).toHaveLength(2);
        } else {
          expect(results).toHaveLength(6);
        }
        // No empty forms
        for (const r of results) {
          expect(r.form.length).toBeGreaterThan(0);
          expect(typeof r.pronoun).toBe('string');
        }
      }
    }
  });

  test('override verbs have correct number of forms per tense', () => {
    for (const [infinitive, data] of verbEntries) {
      if (data.overrides) {
        for (const [tense, forms] of Object.entries(data.overrides)) {
          expect(forms).toHaveLength(6);
        }
      }
    }
  });
});

describe('Common verb conjugation spot checks', () => {
  function forms(infinitive: string, tense: Tense): string[] {
    const data = (verbs as Record<string, VerbData>)[infinitive];
    return conjugate(infinitive, data, tense).map(r => r.form);
  }

  test('ser - present', () => {
    expect(forms('ser', 'present')).toEqual(['soy', 'eres', 'es', 'somos', 'sois', 'son']);
  });

  test('estar - present', () => {
    expect(forms('estar', 'present')).toEqual(['estoy', 'estás', 'está', 'estamos', 'estáis', 'están']);
  });

  test('ir - present', () => {
    expect(forms('ir', 'present')).toEqual(['voy', 'vas', 'va', 'vamos', 'vais', 'van']);
  });

  test('haber - present', () => {
    expect(forms('haber', 'present')).toEqual(['he', 'has', 'ha', 'hemos', 'habéis', 'han']);
  });

  test('hacer - gerund & participle', () => {
    const result = forms('hacer', 'gerund_participle');
    expect(result[0]).toBe('haciendo');
    expect(result[1]).toBe('hecho');
  });

  test('decir - gerund & participle', () => {
    const result = forms('decir', 'gerund_participle');
    expect(result[0]).toBe('diciendo');
    expect(result[1]).toBe('dicho');
  });
});
