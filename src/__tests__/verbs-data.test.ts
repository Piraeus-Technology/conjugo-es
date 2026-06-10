import * as fs from 'fs';
import * as path from 'path';
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

  test('no duplicate top-level keys in the raw JSON', () => {
    // JSON.parse silently keeps the last duplicate, so the parsed object
    // can't reveal duplicates — scan the raw text instead.
    const raw = fs.readFileSync(path.join(__dirname, '../data/verbs.json'), 'utf8');
    const keys = [...raw.matchAll(/^  "([^"]+)": \{/gm)].map(m => m[1]);
    const dupes = keys.filter((key, i) => keys.indexOf(key) !== i);
    expect(dupes).toEqual([]);
    expect(keys.length).toBe(verbEntries.length);
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

  // Regressions from the 2026-06 codebase review — all forms verified against RAE.
  describe('review regressions', () => {
    test('caer/traer - yo-go inserts -ig- after vowel stems (NOT cago/trago)', () => {
      expect(forms('caer', 'present')).toEqual(['caigo', 'caes', 'cae', 'caemos', 'caéis', 'caen']);
      expect(forms('caer', 'subjunctive_present')).toEqual(['caiga', 'caigas', 'caiga', 'caigamos', 'caigáis', 'caigan']);
      expect(forms('traer', 'present')[0]).toBe('traigo');
    });

    test('j-stem irregular preterites take -eron (trajeron, condujeron, bendijeron)', () => {
      expect(forms('traer', 'preterite')).toEqual(['traje', 'trajiste', 'trajo', 'trajimos', 'trajisteis', 'trajeron']);
      expect(forms('conducir', 'preterite')[5]).toBe('condujeron');
      expect(forms('bendecir', 'preterite')[5]).toBe('bendijeron');
    });

    test('shortened tú imperatives: ten, pon, ven, sal + accented compounds', () => {
      expect(forms('tener', 'imperative_affirmative')[1]).toBe('ten');
      expect(forms('poner', 'imperative_affirmative')[1]).toBe('pon');
      expect(forms('venir', 'imperative_affirmative')[1]).toBe('ven');
      expect(forms('salir', 'imperative_affirmative')[1]).toBe('sal');
      expect(forms('mantener', 'imperative_affirmative')[1]).toBe('mantén');
      expect(forms('proponer', 'imperative_affirmative')[1]).toBe('propón');
      expect(forms('prevenir', 'imperative_affirmative')[1]).toBe('prevén');
    });

    test('decir-compound tú imperatives do NOT shorten (bendice, predice)', () => {
      expect(forms('bendecir', 'imperative_affirmative')[1]).toBe('bendice');
      expect(forms('predecir', 'imperative_affirmative')[1]).toBe('predice');
    });

    test('vowel-stem participles carry the accent (caído, leído, oído, traído, reído)', () => {
      expect(forms('caer', 'gerund_participle')[1]).toBe('caído');
      expect(forms('leer', 'gerund_participle')[1]).toBe('leído');
      expect(forms('oír', 'gerund_participle')[1]).toBe('oído');
      expect(forms('reír', 'gerund_participle')[1]).toBe('reído');
      expect(forms('traer', 'present_perfect')[0]).toBe('he traído');
    });

    test('-guir gerunds keep the orthographic u (distinguiendo, persiguiendo)', () => {
      expect(forms('distinguir', 'gerund_participle')[0]).toBe('distinguiendo');
      expect(forms('perseguir', 'gerund_participle')[0]).toBe('persiguiendo');
      expect(forms('proseguir', 'gerund_participle')[0]).toBe('prosiguiendo');
    });

    test('-ir stem-raising gerunds (divirtiendo, previniendo, tiñendo)', () => {
      expect(forms('divertir', 'gerund_participle')[0]).toBe('divirtiendo');
      expect(forms('hervir', 'gerund_participle')[0]).toBe('hirviendo');
      expect(forms('despedir', 'gerund_participle')[0]).toBe('despidiendo');
      expect(forms('prevenir', 'gerund_participle')[0]).toBe('previniendo');
      expect(forms('teñir', 'gerund_participle')[0]).toBe('tiñendo');
      expect(forms('gruñir', 'gerund_participle')[0]).toBe('gruñendo');
    });

    test('adquirir i→ie stem change (adquiero, adquiera)', () => {
      expect(forms('adquirir', 'present')).toEqual(['adquiero', 'adquieres', 'adquiere', 'adquirimos', 'adquirís', 'adquieren']);
      expect(forms('adquirir', 'subjunctive_present')[0]).toBe('adquiera');
      expect(forms('adquirir', 'preterite')[2]).toBe('adquirió');
    });

    test('componer is irregular like poner (compongo, compuse, compondré, compón)', () => {
      expect(forms('componer', 'present')[0]).toBe('compongo');
      expect(forms('componer', 'preterite')[0]).toBe('compuse');
      expect(forms('componer', 'future')[0]).toBe('compondré');
      expect(forms('componer', 'imperative_affirmative')[1]).toBe('compón');
    });

    test('tatuar stresses the u like actuar (tatúo, tatúe)', () => {
      expect(forms('tatuar', 'present')).toEqual(['tatúo', 'tatúas', 'tatúa', 'tatuamos', 'tatuáis', 'tatúan']);
      expect(forms('tatuar', 'subjunctive_present')[0]).toBe('tatúe');
    });

    test('averiguar tú imperative uses the indicative, not the subjunctive', () => {
      expect(forms('averiguar', 'imperative_affirmative')[1]).toBe('averigua');
      expect(forms('apaciguar', 'imperative_affirmative')[1]).toBe('apacigua');
    });

    test('disabled yo imperative rows render — instead of garbage forms', () => {
      expect(forms('hablar', 'imperative_affirmative')[0]).toBe('—');
      expect(forms('tener', 'imperative_affirmative')[0]).toBe('—');
      expect(forms('hablar', 'imperative_negative')[0]).toBe('—');
    });
  });
});
