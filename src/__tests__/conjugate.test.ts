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

describe('Stem change e→ie imperative: defender (-er)', () => {
  const verb: VerbData = {
    type: 'er', regular: false, translation: 'to defend',
    pattern: { stemChange: { present: 'e_ie' } },
  };

  test('imperative negative tú: no defiendas', () => {
    const result = conjugate('defender', verb, 'imperative_negative');
    expect(result[1].form).toBe('no defiendas');
  });

  test('imperative affirmative usted: defienda', () => {
    const result = conjugate('defender', verb, 'imperative_affirmative');
    expect(result[2].form).toBe('defienda');
  });

  test('imperative affirmative tú: defiende', () => {
    const result = conjugate('defender', verb, 'imperative_affirmative');
    expect(result[1].form).toBe('defiende');
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

  test('imperative affirmative - stem change in boot positions', () => {
    const result = conjugate('encontrar', verb, 'imperative_affirmative');
    expect(result[1].form).toBe('encuentra');    // tú
    expect(result[2].form).toBe('encuentre');    // usted
    expect(result[3].form).toBe('encontremos');  // nosotros (no stem change)
    expect(result[5].form).toBe('encuentren');   // ustedes
  });

  test('imperative negative - stem change in boot positions', () => {
    const result = conjugate('encontrar', verb, 'imperative_negative');
    expect(result[1].form).toBe('no encuentres');
    expect(result[2].form).toBe('no encuentre');
    expect(result[3].form).toBe('no encontremos');  // no stem change
    expect(result[5].form).toBe('no encuentren');
  });
});

describe('Stem change o→ue imperative: sonar', () => {
  const verb: VerbData = {
    type: 'ar', regular: false, translation: 'to sound',
    pattern: { stemChange: { present: 'o_ue' } },
  };

  test('imperative usted: suene', () => {
    const result = conjugate('sonar', verb, 'imperative_affirmative');
    expect(result[2].form).toBe('suene');
  });

  test('imperative tú: suena', () => {
    const result = conjugate('sonar', verb, 'imperative_affirmative');
    expect(result[1].form).toBe('suena');
  });

  test('imperative negative tú: no suenes', () => {
    const result = conjugate('sonar', verb, 'imperative_negative');
    expect(result[1].form).toBe('no suenes');
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

describe('Stem change o→u: dormir (-ir)', () => {
  const verb: VerbData = {
    type: 'ir', regular: false, translation: 'to sleep',
    pattern: { stemChange: { present: 'o_ue', preterite: 'o_u' } },
  };

  test('preterite - 3rd person stem change', () => {
    const result = forms('dormir', verb, 'preterite');
    expect(result[2]).toBe('durmió');
    expect(result[5]).toBe('durmieron');
  });
});

describe('Y preterite and derived imperfect subjunctive', () => {
  test('caer preterite uses y in 3rd person', () => {
    const verb: VerbData = {
      type: 'er', regular: false, translation: 'to fall',
      pattern: { yoGo: true },
      overrides: {
        preterite: ['caí', 'caíste', 'cayó', 'caímos', 'caísteis', 'cayeron'],
      },
    };
    const result = forms('caer', verb, 'preterite');
    expect(result[2]).toBe('cayó');
    expect(result[5]).toBe('cayeron');
  });

  test('creer imperfect subjunctive is creyera', () => {
    const verb: VerbData = {
      type: 'er', regular: false, translation: 'to believe',
      overrides: {
        preterite: ['creí', 'creíste', 'creyó', 'creímos', 'creísteis', 'creyeron'],
      },
    };
    expect(forms('creer', verb, 'subjunctive_imperfect')[2]).toBe('creyera');
  });

  test('oír imperfect subjunctive is oyera', () => {
    const verb: VerbData = {
      type: 'ir', regular: false, translation: 'to hear',
      overrides: {
        present: ['oigo', 'oyes', 'oye', 'oímos', 'oís', 'oyen'],
        preterite: ['oí', 'oíste', 'oyó', 'oímos', 'oísteis', 'oyeron'],
        subjunctive_present: ['oiga', 'oigas', 'oiga', 'oigamos', 'oigáis', 'oigan'],
      },
    };
    expect(forms('oír', verb, 'subjunctive_imperfect')[2]).toBe('oyera');
  });

  test('poseer preterite and imperfect subjunctive use y forms', () => {
    const verb: VerbData = {
      type: 'er', regular: false, translation: 'to possess',
      overrides: {
        preterite: ['poseí', 'poseíste', 'poseyó', 'poseímos', 'poseísteis', 'poseyeron'],
      },
    };
    expect(forms('poseer', verb, 'preterite')[2]).toBe('poseyó');
    expect(forms('poseer', verb, 'subjunctive_imperfect')[2]).toBe('poseyera');
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

  test('imperative affirmative - usted/nosotros/ustedes use zc stem', () => {
    const result = conjugate('conocer', verb, 'imperative_affirmative');
    expect(result[2].form).toBe('conozca');      // usted
    expect(result[3].form).toBe('conozcamos');    // nosotros
    expect(result[5].form).toBe('conozcan');      // ustedes
  });

  test('imperative negative - all use zc stem', () => {
    const result = conjugate('conocer', verb, 'imperative_negative');
    expect(result[1].form).toBe('no conozcas');   // tú
    expect(result[2].form).toBe('no conozca');    // usted
    expect(result[3].form).toBe('no conozcamos'); // nosotros
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

describe('Spelling change cer_z: torcer', () => {
  const verb: VerbData = {
    type: 'er', regular: false, translation: 'to twist',
    pattern: { stemChange: { present: 'o_ue' }, spellingChange: 'cer_z' },
  };

  test('present yo: tuerzo', () => {
    expect(forms('torcer', verb, 'present')[0]).toBe('tuerzo');
  });

  test('imperative tú: tuerce (3rd person present with stem change)', () => {
    const result = conjugate('torcer', verb, 'imperative_affirmative');
    expect(result[1].form).toBe('tuerce');
  });

  test('imperative usted: tuerza', () => {
    const result = conjugate('torcer', verb, 'imperative_affirmative');
    expect(result[2].form).toBe('tuerza');
  });

  test('imperative nosotros: torzamos', () => {
    const result = conjugate('torcer', verb, 'imperative_affirmative');
    expect(result[3].form).toBe('torzamos');
  });

  test('subjunctive present', () => {
    const result = forms('torcer', verb, 'subjunctive_present');
    expect(result[0]).toBe('tuerza');
    expect(result[3]).toBe('torzamos');
  });
});

describe('Spelling change ger_j: coger', () => {
  const verb: VerbData = {
    type: 'er', regular: false, translation: 'to take',
    pattern: { spellingChange: 'ger_j' },
  };

  test('present yo: cojo', () => {
    expect(forms('coger', verb, 'present')[0]).toBe('cojo');
  });

  test('imperative usted: coja', () => {
    const result = conjugate('coger', verb, 'imperative_affirmative');
    expect(result[2].form).toBe('coja');
  });

  test('imperative negative tú: no cojas', () => {
    const result = conjugate('coger', verb, 'imperative_negative');
    expect(result[1].form).toBe('no cojas');
  });
});

describe('Spelling change guir_g + stem change: seguir', () => {
  const verb: VerbData = {
    type: 'ir', regular: false, translation: 'to follow',
    pattern: { stemChange: { present: 'e_i', preterite: 'e_i' }, spellingChange: 'guir_g' },
  };

  test('present yo: sigo', () => {
    expect(forms('seguir', verb, 'present')[0]).toBe('sigo');
  });

  test('imperative nosotros: sigamos', () => {
    const result = conjugate('seguir', verb, 'imperative_affirmative');
    expect(result[3].form).toBe('sigamos');
  });

  test('imperative tú: sigue', () => {
    const result = conjugate('seguir', verb, 'imperative_affirmative');
    expect(result[1].form).toBe('sigue');
  });

  test('imperative usted: siga', () => {
    const result = conjugate('seguir', verb, 'imperative_affirmative');
    expect(result[2].form).toBe('siga');
  });

  test('imperative negative nosotros: no sigamos', () => {
    const result = conjugate('seguir', verb, 'imperative_negative');
    expect(result[3].form).toBe('no sigamos');
  });

  test('subjunctive nosotros: sigamos', () => {
    expect(forms('seguir', verb, 'subjunctive_present')[3]).toBe('sigamos');
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

  test('imperative affirmative - tú uses uy+e', () => {
    const result = conjugate('construir', verb, 'imperative_affirmative');
    expect(result[0].disabled).toBe(true); // yo disabled
    expect(result[1].form).toBe('construye'); // tú
    expect(result[2].form).toBe('construya'); // usted
  });

  test('imperative negative - uses uy+a forms', () => {
    const result = conjugate('construir', verb, 'imperative_negative');
    expect(result[1].form).toBe('no construyas');
    expect(result[2].form).toBe('no construya');
  });

  test('subjunctive present - all use uy stem', () => {
    const result = forms('construir', verb, 'subjunctive_present');
    expect(result[0]).toBe('construya');
    expect(result[1]).toBe('construyas');
    expect(result[3]).toBe('construyamos');
  });

  test('subjunctive imperfect - keeps y from preterite stem', () => {
    const result = forms('construir', verb, 'subjunctive_imperfect');
    expect(result).toEqual([
      'construyera', 'construyeras', 'construyera', 'construyéramos', 'construyerais', 'construyeran',
    ]);
  });
});

describe('Spelling change uir→uy: instruir', () => {
  const verb: VerbData = {
    type: 'ir', regular: false, translation: 'to instruct',
    pattern: { spellingChange: 'uir_uy' },
  };

  test('subjunctive imperfect - uses instruyera, not instruiera', () => {
    const result = forms('instruir', verb, 'subjunctive_imperfect');
    expect(result[2]).toBe('instruyera');
  });
});

// ============ VERBS WITH SUBJUNCTIVE OVERRIDES (imperative derived) ============

describe('Imperative from subjunctive overrides: caber', () => {
  const verb: VerbData = {
    type: 'er', regular: false, translation: 'to fit',
    pattern: { irregularPreteriteStem: 'cup', irregularFutureStem: 'cabr' },
    overrides: {
      present: ['quepo', 'cabes', 'cabe', 'cabemos', 'cabéis', 'caben'],
      subjunctive_present: ['quepa', 'quepas', 'quepa', 'quepamos', 'quepáis', 'quepan'],
    },
  };

  test('imperative affirmative uses subjunctive forms', () => {
    const result = conjugate('caber', verb, 'imperative_affirmative');
    expect(result[0].disabled).toBe(true);
    expect(result[1].form).toBe('cabe');       // tú = 3rd person present
    expect(result[2].form).toBe('quepa');      // usted
    expect(result[3].form).toBe('quepamos');   // nosotros
    expect(result[5].form).toBe('quepan');     // ustedes
  });

  test('imperative negative uses subjunctive forms', () => {
    const result = conjugate('caber', verb, 'imperative_negative');
    expect(result[0].disabled).toBe(true);
    expect(result[1].form).toBe('no quepas');
    expect(result[2].form).toBe('no quepa');
    expect(result[3].form).toBe('no quepamos');
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

// ============ COMPOUND VERB PARTICIPLES (envolvisto bug) ============

describe('Compound verb participles - longest base match', () => {
  test('envolver → envuelto (not envolvisto)', () => {
    const verb: VerbData = {
      type: 'er', regular: false, translation: 'to wrap',
      pattern: { stemChange: { present: 'o_ue' } },
    };
    const result = forms('envolver', verb, 'gerund_participle');
    expect(result[1]).toBe('envuelto');
  });

  test('envolver present perfect → he envuelto', () => {
    const verb: VerbData = {
      type: 'er', regular: false, translation: 'to wrap',
      pattern: { stemChange: { present: 'o_ue' } },
    };
    const result = forms('envolver', verb, 'present_perfect');
    expect(result[0]).toBe('he envuelto');
    expect(result[3]).toBe('hemos envuelto');
  });

  test('devolver → devuelto (not devolvisto)', () => {
    const verb: VerbData = {
      type: 'er', regular: false, translation: 'to return',
      pattern: { stemChange: { present: 'o_ue' } },
    };
    expect(forms('devolver', verb, 'gerund_participle')[1]).toBe('devuelto');
  });

  test('revolver → revuelto', () => {
    const verb: VerbData = {
      type: 'er', regular: false, translation: 'to stir',
      pattern: { stemChange: { present: 'o_ue' } },
    };
    expect(forms('revolver', verb, 'gerund_participle')[1]).toBe('revuelto');
  });

  test('componer → compuesto (not componisto)', () => {
    const verb: VerbData = {
      type: 'er', regular: false, translation: 'to compose',
    };
    expect(forms('componer', verb, 'gerund_participle')[1]).toBe('compuesto');
  });

  test('proponer → propuesto', () => {
    const verb: VerbData = {
      type: 'er', regular: false, translation: 'to propose',
    };
    expect(forms('proponer', verb, 'gerund_participle')[1]).toBe('propuesto');
  });

  test('deshacer → deshecho', () => {
    const verb: VerbData = {
      type: 'er', regular: false, translation: 'to undo',
    };
    expect(forms('deshacer', verb, 'gerund_participle')[1]).toBe('deshecho');
  });

  test('prever → previsto (not previsto via ver)', () => {
    const verb: VerbData = {
      type: 'er', regular: false, translation: 'to foresee',
    };
    // Both should give "previsto" — ver→visto, prefix "pre"
    expect(forms('prever', verb, 'gerund_participle')[1]).toBe('previsto');
  });

  test('descubrir → descubierto (not descubristo)', () => {
    const verb: VerbData = {
      type: 'ir', regular: false, translation: 'to discover',
    };
    expect(forms('descubrir', verb, 'gerund_participle')[1]).toBe('descubierto');
  });

  test('describir → descrito (not describisto)', () => {
    const verb: VerbData = {
      type: 'ir', regular: false, translation: 'to describe',
    };
    expect(forms('describir', verb, 'gerund_participle')[1]).toBe('descrito');
  });

  test('remover → removido (regular, NOT removisto)', () => {
    const verb: VerbData = {
      type: 'er', regular: false, translation: 'to stir',
      pattern: { stemChange: { present: 'o_ue' } },
    };
    expect(forms('remover', verb, 'gerund_participle')[1]).toBe('removido');
    expect(forms('remover', verb, 'present_perfect')[0]).toBe('he removido');
  });

  test('mover → movido (regular)', () => {
    const verb: VerbData = {
      type: 'er', regular: false, translation: 'to move',
      pattern: { stemChange: { present: 'o_ue' } },
    };
    expect(forms('mover', verb, 'gerund_participle')[1]).toBe('movido');
  });

  test('promover → promovido (regular)', () => {
    const verb: VerbData = {
      type: 'er', regular: false, translation: 'to promote',
      pattern: { stemChange: { present: 'o_ue' } },
    };
    expect(forms('promover', verb, 'gerund_participle')[1]).toBe('promovido');
  });

  test('disolver → disuelto (irregular)', () => {
    const verb: VerbData = {
      type: 'er', regular: false, translation: 'to dissolve',
      pattern: { stemChange: { present: 'o_ue' } },
    };
    expect(forms('disolver', verb, 'gerund_participle')[1]).toBe('disuelto');
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

  test('poseer → poseyendo', () => {
    const verb: VerbData = { type: 'er', regular: false, translation: 'to possess' };
    const result = forms('poseer', verb, 'gerund_participle');
    expect(result[0]).toBe('poseyendo');
  });

  test('abstraer → abstrayendo', () => {
    const verb: VerbData = { type: 'er', regular: false, translation: 'to abstract' };
    const result = forms('abstraer', verb, 'gerund_participle');
    expect(result[0]).toBe('abstrayendo');
  });
});

describe('Accented infinitives', () => {
  test('reír future drops infinitive accent', () => {
    const verb: VerbData = {
      type: 'ir',
      regular: false,
      translation: 'to laugh',
      overrides: {
        present: ['río', 'ríes', 'ríe', 'reímos', 'reís', 'ríen'],
        preterite: ['reí', 'reíste', 'rio', 'reímos', 'reísteis', 'rieron'],
        subjunctive_present: ['ría', 'rías', 'ría', 'riamos', 'riáis', 'rían'],
      },
    };
    expect(forms('reír', verb, 'future')[0]).toBe('reiré');
    expect(conjugate('oír', {
      type: 'ir',
      regular: false,
      translation: 'to hear',
      overrides: {
        present: ['oigo', 'oyes', 'oye', 'oímos', 'oís', 'oyen'],
        preterite: ['oí', 'oíste', 'oyó', 'oímos', 'oísteis', 'oyeron'],
        subjunctive_present: ['oiga', 'oigas', 'oiga', 'oigamos', 'oigáis', 'oigan'],
      },
    }, 'imperative_affirmative')[4].form).toBe('oíd');
  });

  test('reír and sonreír keep accented 3rd-person preterite forms', () => {
    const reir: VerbData = {
      type: 'ir',
      regular: false,
      translation: 'to laugh',
      overrides: {
        present: ['río', 'ríes', 'ríe', 'reímos', 'reís', 'ríen'],
        preterite: ['reí', 'reíste', 'rió', 'reímos', 'reísteis', 'rieron'],
        subjunctive_present: ['ría', 'rías', 'ría', 'riamos', 'riáis', 'rían'],
      },
    };
    const sonreir: VerbData = {
      type: 'ir',
      regular: false,
      translation: 'to smile',
      overrides: {
        present: ['sonrío', 'sonríes', 'sonríe', 'sonreímos', 'sonreís', 'sonríen'],
        preterite: ['sonreí', 'sonreíste', 'sonrió', 'sonreímos', 'sonreísteis', 'sonrieron'],
        subjunctive_present: ['sonría', 'sonrías', 'sonría', 'sonriamos', 'sonriáis', 'sonrían'],
      },
    };
    expect(forms('reír', reir, 'preterite')[2]).toBe('rió');
    expect(forms('sonreír', sonreir, 'preterite')[2]).toBe('sonrió');
  });
});

describe('Traer family compounds', () => {
  test('abstraer behaves like traer in key irregular forms', () => {
    const verb: VerbData = {
      type: 'er',
      regular: false,
      translation: 'to abstract',
      pattern: { irregularPreteriteStem: 'abstraj' },
      overrides: {
        present: ['abstraigo', 'abstraes', 'abstrae', 'abstraemos', 'abstraéis', 'abstraen'],
        subjunctive_present: ['abstraiga', 'abstraigas', 'abstraiga', 'abstraigamos', 'abstraigáis', 'abstraigan'],
      },
    };
    expect(forms('abstraer', verb, 'present')[0]).toBe('abstraigo');
    expect(forms('abstraer', verb, 'preterite')[2]).toBe('abstrajo');
    expect(forms('abstraer', verb, 'subjunctive_imperfect')[2]).toBe('abstrajera');
  });

  test('decir imperfect subjunctive is dijera', () => {
    const verb: VerbData = {
      type: 'ir',
      regular: false,
      translation: 'to say/tell',
      pattern: { irregularFutureStem: 'dir', irregularPreteriteStem: 'dij' },
      overrides: {
        present: ['digo', 'dices', 'dice', 'decimos', 'decís', 'dicen'],
        preterite: ['dije', 'dijiste', 'dijo', 'dijimos', 'dijisteis', 'dijeron'],
        subjunctive_present: ['diga', 'digas', 'diga', 'digamos', 'digáis', 'digan'],
      },
    };
    expect(forms('decir', verb, 'subjunctive_imperfect')[2]).toBe('dijera');
  });

  test('contradecir follows decir-family irregular patterns', () => {
    const verb: VerbData = {
      type: 'ir',
      regular: false,
      translation: 'to contradict',
      pattern: { irregularPreteriteStem: 'contradij', irregularFutureStem: 'contradir' },
      overrides: {
        present: ['contradigo', 'contradices', 'contradice', 'contradecimos', 'contradecís', 'contradicen'],
        subjunctive_present: ['contradiga', 'contradigas', 'contradiga', 'contradigamos', 'contradigáis', 'contradigan'],
      },
    };
    expect(forms('contradecir', verb, 'present')[0]).toBe('contradigo');
    expect(forms('contradecir', verb, 'preterite')[2]).toBe('contradijo');
    expect(forms('contradecir', verb, 'subjunctive_imperfect')[2]).toBe('contradijera');
    expect(forms('contradecir', verb, 'future')[0]).toBe('contradiré');
  });

  test('predecir keeps regular future but irregular decir-family stems elsewhere', () => {
    const verb: VerbData = {
      type: 'ir',
      regular: false,
      translation: 'to predict',
      pattern: { irregularPreteriteStem: 'predij' },
      overrides: {
        present: ['predigo', 'predices', 'predice', 'predecimos', 'predecís', 'predicen'],
        subjunctive_present: ['prediga', 'predigas', 'prediga', 'predigamos', 'predigáis', 'predigan'],
      },
    };
    expect(forms('predecir', verb, 'present')[0]).toBe('predigo');
    expect(forms('predecir', verb, 'preterite')[2]).toBe('predijo');
    expect(forms('predecir', verb, 'subjunctive_imperfect')[2]).toBe('predijera');
    expect(forms('predecir', verb, 'future')[0]).toBe('predeciré');
  });

  test('bendecir follows decir-family present and preterite patterns', () => {
    const verb: VerbData = {
      type: 'ir',
      regular: false,
      translation: 'to bless',
      pattern: { irregularPreteriteStem: 'bendij' },
      overrides: {
        present: ['bendigo', 'bendices', 'bendice', 'bendecimos', 'bendecís', 'bendicen'],
        subjunctive_present: ['bendiga', 'bendigas', 'bendiga', 'bendigamos', 'bendigáis', 'bendigan'],
      },
    };
    expect(forms('bendecir', verb, 'present')[0]).toBe('bendigo');
    expect(forms('bendecir', verb, 'preterite')[2]).toBe('bendijo');
    expect(forms('bendecir', verb, 'subjunctive_imperfect')[2]).toBe('bendijera');
    expect(forms('bendecir', verb, 'future')[0]).toBe('bendeciré');
  });
});

describe('Missing compound irregulars added to dataset', () => {
  test('deshacer follows hacer-family patterns', () => {
    const verb: VerbData = {
      type: 'er',
      regular: false,
      translation: 'to undo',
      pattern: { irregularFutureStem: 'deshar' },
      overrides: {
        present: ['deshago', 'deshaces', 'deshace', 'deshacemos', 'deshacéis', 'deshacen'],
        preterite: ['deshice', 'deshiciste', 'deshizo', 'deshicimos', 'deshicisteis', 'deshicieron'],
        subjunctive_present: ['deshaga', 'deshagas', 'deshaga', 'deshagamos', 'deshagáis', 'deshagan'],
      },
    };
    expect(forms('deshacer', verb, 'present')[0]).toBe('deshago');
    expect(forms('deshacer', verb, 'preterite')[2]).toBe('deshizo');
    expect(forms('deshacer', verb, 'subjunctive_imperfect')[2]).toBe('deshiciera');
    expect(forms('deshacer', verb, 'future')[0]).toBe('desharé');
  });

  test('maldecir follows decir-family patterns with regular future', () => {
    const verb: VerbData = {
      type: 'ir',
      regular: false,
      translation: 'to curse',
      overrides: {
        present: ['maldigo', 'maldices', 'maldice', 'maldecimos', 'maldecís', 'maldicen'],
        preterite: ['maldije', 'maldijiste', 'maldijo', 'maldijimos', 'maldijisteis', 'maldijeron'],
        subjunctive_present: ['maldiga', 'maldigas', 'maldiga', 'maldigamos', 'maldigáis', 'maldigan'],
      },
    };
    expect(forms('maldecir', verb, 'present')[0]).toBe('maldigo');
    expect(forms('maldecir', verb, 'preterite')[2]).toBe('maldijo');
    expect(forms('maldecir', verb, 'subjunctive_imperfect')[2]).toBe('maldijera');
    expect(forms('maldecir', verb, 'future')[0]).toBe('maldeciré');
  });

  test('proponer follows poner-family patterns', () => {
    const verb: VerbData = {
      type: 'er',
      regular: false,
      translation: 'to propose',
      pattern: { yoGo: true, irregularPreteriteStem: 'propus', irregularFutureStem: 'propondr' },
    };
    expect(forms('proponer', verb, 'present')[0]).toBe('propongo');
    expect(forms('proponer', verb, 'preterite')[2]).toBe('propuso');
    expect(forms('proponer', verb, 'subjunctive_imperfect')[2]).toBe('propusiera');
    expect(forms('proponer', verb, 'future')[0]).toBe('propondré');
  });

  test('prever follows ver-family present and participle patterns', () => {
    const verb: VerbData = {
      type: 'er',
      regular: false,
      translation: 'to foresee',
      overrides: {
        present: ['preveo', 'prevés', 'prevé', 'preveemos', 'prevéis', 'prevén'],
        subjunctive_present: ['prevea', 'preveas', 'prevea', 'preveamos', 'preveáis', 'prevean'],
      },
    };
    expect(forms('prever', verb, 'present')[0]).toBe('preveo');
    expect(forms('prever', verb, 'present')[2]).toBe('prevé');
    expect(forms('prever', verb, 'subjunctive_present')[0]).toBe('prevea');
    expect(forms('prever', verb, 'gerund_participle')[1]).toBe('previsto');
  });

  test('entrever follows ver-family present and participle patterns', () => {
    const verb: VerbData = {
      type: 'er',
      regular: false,
      translation: 'to glimpse',
      overrides: {
        present: ['entreveo', 'entrevés', 'entrevé', 'entreveemos', 'entrevéis', 'entrevén'],
        subjunctive_present: ['entrevea', 'entreveas', 'entrevea', 'entreveamos', 'entreveáis', 'entrevean'],
      },
    };
    expect(forms('entrever', verb, 'present')[0]).toBe('entreveo');
    expect(forms('entrever', verb, 'present')[2]).toBe('entrevé');
    expect(forms('entrever', verb, 'subjunctive_present')[0]).toBe('entrevea');
    expect(forms('entrever', verb, 'gerund_participle')[1]).toBe('entrevisto');
  });
});

describe('Dataset integrity regressions', () => {
  test('fixed regular verb type mismatches conjugate with the correct class', () => {
    expect(forms('debatir', { type: 'ir', regular: true, translation: 'to debate' }, 'present')[3]).toBe('debatimos');
    expect(forms('corromper', { type: 'er', regular: true, translation: 'to corrupt' }, 'present')[3]).toBe('corrompemos');
    expect(forms('demoler', { type: 'er', regular: true, translation: 'to demolish' }, 'present')[0]).toBe('demolo');
    expect(forms('abolir', { type: 'ir', regular: true, translation: 'to abolish' }, 'imperfect')[0]).toBe('abolía');
    expect(forms('comprometer', { type: 'er', regular: true, translation: 'to compromise' }, 'present')[3]).toBe('comprometemos');
    expect(forms('alquilar', { type: 'ar', regular: true, translation: 'to rent' }, 'present')[0]).toBe('alquilo');
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
