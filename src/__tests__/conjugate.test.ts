import { conjugate, VerbData, Tense } from '../utils/conjugate';

// Helper to extract just the forms from conjugation results
function forms(infinitive: string, verb: VerbData, tense: Tense): string[] {
  return conjugate(infinitive, verb, tense).map(r => r.form);
}

// ============ REGULAR VERBS ============

describe('Regular -ar verb: hablar', () => {
  const verb: VerbData = { type: 'ar', regular: true, translation: 'to speak' };

  test('present tense', () => {
    expect(forms('hablar', verb, 'present')).toEqual([
      'hablo', 'hablas', 'habla', 'hablamos', 'habláis', 'hablan',
    ]);
  });

  test('preterite tense', () => {
    expect(forms('hablar', verb, 'preterite')).toEqual([
      'hablé', 'hablaste', 'habló', 'hablamos', 'hablasteis', 'hablaron',
    ]);
  });

  test('imperfect tense', () => {
    expect(forms('hablar', verb, 'imperfect')).toEqual([
      'hablaba', 'hablabas', 'hablaba', 'hablábamos', 'hablabais', 'hablaban',
    ]);
  });

  test('future tense', () => {
    expect(forms('hablar', verb, 'future')).toEqual([
      'hablaré', 'hablarás', 'hablará', 'hablaremos', 'hablaréis', 'hablarán',
    ]);
  });

  test('conditional tense', () => {
    expect(forms('hablar', verb, 'conditional')).toEqual([
      'hablaría', 'hablarías', 'hablaría', 'hablaríamos', 'hablaríais', 'hablarían',
    ]);
  });

  test('subjunctive present', () => {
    expect(forms('hablar', verb, 'subjunctive_present')).toEqual([
      'hable', 'hables', 'hable', 'hablemos', 'habléis', 'hablen',
    ]);
  });

  test('subjunctive imperfect', () => {
    expect(forms('hablar', verb, 'subjunctive_imperfect')).toEqual([
      'hablara', 'hablaras', 'hablara', 'habláramos', 'hablarais', 'hablaran',
    ]);
  });

  test('imperative affirmative', () => {
    const results = conjugate('hablar', verb, 'imperative_affirmative');
    expect(results[0].disabled).toBe(true);
    expect(results[1].form).toBe('habla');
    expect(results[2].form).toBe('hable');
    expect(results[4].form).toBe('hablad');
  });

  test('imperative negative', () => {
    const results = conjugate('hablar', verb, 'imperative_negative');
    expect(results[0].disabled).toBe(true);
    expect(results[1].form).toBe('no hables');
    expect(results[2].form).toBe('no hable');
  });

  test('gerund and participle', () => {
    expect(forms('hablar', verb, 'gerund_participle')).toEqual([
      'hablando', 'hablado',
    ]);
  });
});

describe('Regular -er verb: comer', () => {
  const verb: VerbData = { type: 'er', regular: true, translation: 'to eat' };

  test('present tense', () => {
    expect(forms('comer', verb, 'present')).toEqual([
      'como', 'comes', 'come', 'comemos', 'coméis', 'comen',
    ]);
  });

  test('preterite tense', () => {
    expect(forms('comer', verb, 'preterite')).toEqual([
      'comí', 'comiste', 'comió', 'comimos', 'comisteis', 'comieron',
    ]);
  });

  test('gerund and participle', () => {
    expect(forms('comer', verb, 'gerund_participle')).toEqual([
      'comiendo', 'comido',
    ]);
  });
});

describe('Regular -ir verb: vivir', () => {
  const verb: VerbData = { type: 'ir', regular: true, translation: 'to live' };

  test('present tense', () => {
    expect(forms('vivir', verb, 'present')).toEqual([
      'vivo', 'vives', 'vive', 'vivimos', 'vivís', 'viven',
    ]);
  });

  test('preterite tense', () => {
    expect(forms('vivir', verb, 'preterite')).toEqual([
      'viví', 'viviste', 'vivió', 'vivimos', 'vivisteis', 'vivieron',
    ]);
  });

  test('gerund and participle', () => {
    expect(forms('vivir', verb, 'gerund_participle')).toEqual([
      'viviendo', 'vivido',
    ]);
  });
});

// ============ STEM-CHANGING VERBS ============

describe('Stem change e→ie: pensar', () => {
  const verb: VerbData = {
    type: 'ar', regular: false, translation: 'to think',
    pattern: { stemChange: { present: 'e_ie' } },
  };

  test('present tense - boot pattern', () => {
    expect(forms('pensar', verb, 'present')).toEqual([
      'pienso', 'piensas', 'piensa', 'pensamos', 'pensáis', 'piensan',
    ]);
  });

  test('preterite - no stem change', () => {
    expect(forms('pensar', verb, 'preterite')).toEqual([
      'pensé', 'pensaste', 'pensó', 'pensamos', 'pensasteis', 'pensaron',
    ]);
  });
});

describe('Stem change o→ue: encontrar', () => {
  const verb: VerbData = {
    type: 'ar', regular: false, translation: 'to find',
    pattern: { stemChange: { present: 'o_ue' } },
  };

  test('present tense - boot pattern', () => {
    expect(forms('encontrar', verb, 'present')).toEqual([
      'encuentro', 'encuentras', 'encuentra', 'encontramos', 'encontráis', 'encuentran',
    ]);
  });
});

describe('Stem change e→i: pedir (-ir)', () => {
  const verb: VerbData = {
    type: 'ir', regular: false, translation: 'to ask for',
    pattern: { stemChange: { present: 'e_i', preterite: 'e_i' } },
  };

  test('present tense - boot pattern', () => {
    expect(forms('pedir', verb, 'present')).toEqual([
      'pido', 'pides', 'pide', 'pedimos', 'pedís', 'piden',
    ]);
  });

  test('preterite - 3rd person stem change', () => {
    const result = forms('pedir', verb, 'preterite');
    expect(result[0]).toBe('pedí');
    expect(result[2]).toBe('pidió'); // 3rd person changes
    expect(result[5]).toBe('pidieron'); // 3rd plural changes
  });

  test('subjunctive present - boot + nosotros/vosotros change', () => {
    const result = forms('pedir', verb, 'subjunctive_present');
    expect(result[0]).toBe('pida'); // boot change e→i
    expect(result[3]).toBe('pidamos'); // nosotros also changes for -ir
  });
});

// ============ YO-GO VERBS ============

describe('Yo-go verb: tener', () => {
  const verb: VerbData = {
    type: 'er', regular: false, translation: 'to have',
    pattern: {
      stemChange: { present: 'e_ie' },
      yoGo: true,
      irregularPreteriteStem: 'tuv',
      irregularFutureStem: 'tendr',
    },
  };

  test('present tense - yo gets -go, others get stem change', () => {
    const result = forms('tener', verb, 'present');
    expect(result[0]).toBe('tengo');
    expect(result[1]).toBe('tienes');
    expect(result[3]).toBe('tenemos'); // no stem change
  });

  test('preterite - irregular stem', () => {
    expect(forms('tener', verb, 'preterite')).toEqual([
      'tuve', 'tuviste', 'tuvo', 'tuvimos', 'tuvisteis', 'tuvieron',
    ]);
  });

  test('future - irregular stem', () => {
    expect(forms('tener', verb, 'future')).toEqual([
      'tendré', 'tendrás', 'tendrá', 'tendremos', 'tendréis', 'tendrán',
    ]);
  });

  test('conditional - irregular stem', () => {
    expect(forms('tener', verb, 'conditional')).toEqual([
      'tendría', 'tendrías', 'tendría', 'tendríamos', 'tendríais', 'tendrían',
    ]);
  });

  test('subjunctive imperfect - based on irregular preterite', () => {
    expect(forms('tener', verb, 'subjunctive_imperfect')).toEqual([
      'tuviera', 'tuvieras', 'tuviera', 'tuviéramos', 'tuvierais', 'tuvieran',
    ]);
  });
});

// ============ YO-ZCO VERBS ============

describe('Yo-zco verb: conocer', () => {
  const verb: VerbData = {
    type: 'er', regular: false, translation: 'to know',
    pattern: { yoZco: true },
  };

  test('present tense - yo gets -zco', () => {
    const result = forms('conocer', verb, 'present');
    expect(result[0]).toBe('conozco');
    expect(result[1]).toBe('conoces');
  });

  test('subjunctive present - all forms based on zc stem', () => {
    expect(forms('conocer', verb, 'subjunctive_present')).toEqual([
      'conozca', 'conozcas', 'conozca', 'conozcamos', 'conozcáis', 'conozcan',
    ]);
  });
});

// ============ SPELLING CHANGES ============

describe('Spelling change car→qué: buscar', () => {
  const verb: VerbData = {
    type: 'ar', regular: false, translation: 'to search',
    pattern: { spellingChange: 'car_qué' },
  };

  test('preterite - yo form spelling change', () => {
    const result = forms('buscar', verb, 'preterite');
    expect(result[0]).toBe('busqué');
    expect(result[1]).toBe('buscaste'); // others normal
  });
});

describe('Spelling change uir→uy: construir', () => {
  const verb: VerbData = {
    type: 'ir', regular: false, translation: 'to build',
    pattern: { spellingChange: 'uir_uy' },
  };

  test('present tense - y insertion in boot positions', () => {
    const result = forms('construir', verb, 'present');
    expect(result[0]).toBe('construyo');
    expect(result[1]).toBe('construyes');
    expect(result[3]).toBe('construimos'); // no y insertion
  });

  test('preterite - y insertion in 3rd person', () => {
    const result = forms('construir', verb, 'preterite');
    expect(result[2]).toBe('construyó');
    expect(result[5]).toBe('construyeron');
    expect(result[0]).toBe('construí'); // yo normal
  });
});

// ============ FULLY IRREGULAR VERBS (OVERRIDES) ============

describe('Fully irregular verb: ser', () => {
  const verb: VerbData = {
    type: 'er', regular: false, translation: 'to be (permanent)',
    overrides: {
      present: ['soy', 'eres', 'es', 'somos', 'sois', 'son'],
      preterite: ['fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron'],
      imperfect: ['era', 'eras', 'era', 'éramos', 'erais', 'eran'],
    },
  };

  test('present tense uses overrides', () => {
    expect(forms('ser', verb, 'present')).toEqual([
      'soy', 'eres', 'es', 'somos', 'sois', 'son',
    ]);
  });

  test('preterite uses overrides', () => {
    expect(forms('ser', verb, 'preterite')).toEqual([
      'fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron',
    ]);
  });
});

// ============ COMPOUND TENSES ============

describe('Compound tenses', () => {
  const verb: VerbData = { type: 'ar', regular: true, translation: 'to speak' };

  test('present perfect', () => {
    expect(forms('hablar', verb, 'present_perfect')).toEqual([
      'he hablado', 'has hablado', 'ha hablado',
      'hemos hablado', 'habéis hablado', 'han hablado',
    ]);
  });

  test('past perfect', () => {
    expect(forms('hablar', verb, 'past_perfect')).toEqual([
      'había hablado', 'habías hablado', 'había hablado',
      'habíamos hablado', 'habíais hablado', 'habían hablado',
    ]);
  });

  test('future perfect', () => {
    const result = forms('hablar', verb, 'future_perfect');
    expect(result[0]).toBe('habré hablado');
  });

  test('conditional perfect', () => {
    const result = forms('hablar', verb, 'conditional_perfect');
    expect(result[0]).toBe('habría hablado');
  });
});

// ============ IRREGULAR PARTICIPLES ============

describe('Irregular participles', () => {
  test('hacer → hecho', () => {
    const verb: VerbData = {
      type: 'er', regular: false, translation: 'to do',
      pattern: { irregularFutureStem: 'har' },
    };
    const result = forms('hacer', verb, 'gerund_participle');
    expect(result[1]).toBe('hecho');
  });

  test('escribir → escrito', () => {
    const verb: VerbData = { type: 'ir', regular: false, translation: 'to write' };
    const result = forms('escribir', verb, 'gerund_participle');
    expect(result[1]).toBe('escrito');
  });

  test('abrir → abierto', () => {
    const verb: VerbData = { type: 'ir', regular: false, translation: 'to open' };
    const result = forms('abrir', verb, 'gerund_participle');
    expect(result[1]).toBe('abierto');
  });

  test('compound verb: descubrir → descubierto', () => {
    const verb: VerbData = { type: 'ir', regular: false, translation: 'to discover' };
    const result = forms('descubrir', verb, 'gerund_participle');
    expect(result[1]).toBe('descubierto');
  });

  test('compound tense uses irregular participle', () => {
    const verb: VerbData = {
      type: 'er', regular: false, translation: 'to do',
      pattern: { irregularFutureStem: 'har' },
    };
    const result = forms('hacer', verb, 'present_perfect');
    expect(result[0]).toBe('he hecho');
  });
});

// ============ IRREGULAR GERUNDS ============

describe('Irregular gerunds', () => {
  test('decir → diciendo', () => {
    const verb: VerbData = { type: 'ir', regular: false, translation: 'to say' };
    const result = forms('decir', verb, 'gerund_participle');
    expect(result[0]).toBe('diciendo');
  });

  test('dormir → durmiendo', () => {
    const verb: VerbData = { type: 'ir', regular: false, translation: 'to sleep' };
    const result = forms('dormir', verb, 'gerund_participle');
    expect(result[0]).toBe('durmiendo');
  });

  test('ir → yendo', () => {
    const verb: VerbData = { type: 'ir', regular: false, translation: 'to go' };
    const result = forms('ir', verb, 'gerund_participle');
    expect(result[0]).toBe('yendo');
  });

  test('construir → construyendo', () => {
    const verb: VerbData = { type: 'ir', regular: false, translation: 'to build' };
    const result = forms('construir', verb, 'gerund_participle');
    expect(result[0]).toBe('construyendo');
  });
});

// ============ CONJUGATION RESULT STRUCTURE ============

describe('ConjugationResult structure', () => {
  const verb: VerbData = { type: 'ar', regular: true, translation: 'to speak' };

  test('returns 6 results for simple tenses', () => {
    const result = conjugate('hablar', verb, 'present');
    expect(result).toHaveLength(6);
  });

  test('returns 2 results for gerund_participle', () => {
    const result = conjugate('hablar', verb, 'gerund_participle');
    expect(result).toHaveLength(2);
    expect(result[0].pronoun).toBe('Gerund');
    expect(result[1].pronoun).toBe('Past Participle');
  });

  test('returns 6 results for compound tenses', () => {
    const result = conjugate('hablar', verb, 'present_perfect');
    expect(result).toHaveLength(6);
  });

  test('pronouns are correct', () => {
    const result = conjugate('hablar', verb, 'present');
    expect(result.map(r => r.pronoun)).toEqual([
      'yo', 'tú', 'él/ella/Ud.', 'nosotros', 'vosotros', 'ellos/ellas/Uds.',
    ]);
  });

  test('imperative yo is disabled', () => {
    const result = conjugate('hablar', verb, 'imperative_affirmative');
    expect(result[0].disabled).toBe(true);
    expect(result[1].disabled).toBeFalsy();
  });
});
