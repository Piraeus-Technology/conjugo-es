const pronouns = ['yo', 'tú', 'él/ella/Ud.', 'nosotros', 'vosotros', 'ellos/ellas/Uds.'];

// ============ REGULAR ENDINGS ============

const regularEndings: Record<string, Record<string, string[]>> = {
  present: {
    ar: ['o', 'as', 'a', 'amos', 'áis', 'an'],
    er: ['o', 'es', 'e', 'emos', 'éis', 'en'],
    ir: ['o', 'es', 'e', 'imos', 'ís', 'en'],
  },
  preterite: {
    ar: ['é', 'aste', 'ó', 'amos', 'asteis', 'aron'],
    er: ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'],
    ir: ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'],
  },
  imperfect: {
    ar: ['aba', 'abas', 'aba', 'ábamos', 'abais', 'aban'],
    er: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'],
    ir: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'],
  },
  future: {
    ar: ['é', 'ás', 'á', 'emos', 'éis', 'án'],
    er: ['é', 'ás', 'á', 'emos', 'éis', 'án'],
    ir: ['é', 'ás', 'á', 'emos', 'éis', 'án'],
  },
  conditional: {
    ar: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'],
    er: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'],
    ir: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'],
  },
  subjunctive_present: {
    ar: ['e', 'es', 'e', 'emos', 'éis', 'en'],
    er: ['a', 'as', 'a', 'amos', 'áis', 'an'],
    ir: ['a', 'as', 'a', 'amos', 'áis', 'an'],
  },
  subjunctive_imperfect: {
    ar: ['ara', 'aras', 'ara', 'áramos', 'arais', 'aran'],
    er: ['iera', 'ieras', 'iera', 'iéramos', 'ierais', 'ieran'],
    ir: ['iera', 'ieras', 'iera', 'iéramos', 'ierais', 'ieran'],
  },
  imperative_affirmative: {
    ar: ['—', 'a', 'e', 'emos', 'ad', 'en'],
    er: ['—', 'e', 'a', 'amos', 'ed', 'an'],
    ir: ['—', 'e', 'a', 'amos', 'id', 'an'],
  },
  imperative_negative: {
    ar: ['—', 'es', 'e', 'emos', 'éis', 'en'],
    er: ['—', 'as', 'a', 'amos', 'áis', 'an'],
    ir: ['—', 'as', 'a', 'amos', 'áis', 'an'],
  },
};

// ============ COMPOUND TENSES ============

const haberForms: Record<string, string[]> = {
  present_perfect: ['he', 'has', 'ha', 'hemos', 'habéis', 'han'],
  past_perfect: ['había', 'habías', 'había', 'habíamos', 'habíais', 'habían'],
  future_perfect: ['habré', 'habrás', 'habrá', 'habremos', 'habréis', 'habrán'],
  conditional_perfect: ['habría', 'habrías', 'habría', 'habríamos', 'habríais', 'habrían'],
};

// ============ IRREGULAR PARTICIPLES ============

const irregularParticiples: Record<string, string> = {
  abrir: 'abierto',
  cubrir: 'cubierto',
  decir: 'dicho',
  escribir: 'escrito',
  hacer: 'hecho',
  morir: 'muerto',
  poner: 'puesto',
  resolver: 'resuelto',
  romper: 'roto',
  ver: 'visto',
  volver: 'vuelto',
  devolver: 'devuelto',
  describir: 'descrito',
  descubrir: 'descubierto',
  satisfacer: 'satisfecho',
  imprimir: 'impreso',
  freír: 'frito',
};

// Also check compound verbs (e.g. "descubrir" → "cubrir" base)
function getIrregularParticiple(infinitive: string): string | null {
  if (irregularParticiples[infinitive]) return irregularParticiples[infinitive];
  // Check if verb ends with a known irregular base
  for (const [base, participle] of Object.entries(irregularParticiples)) {
    if (infinitive.endsWith(base) && infinitive !== base) {
      const prefix = infinitive.slice(0, -base.length);
      return prefix + participle;
    }
  }
  return null;
}

// ============ IRREGULAR GERUNDS ============

const irregularGerundPatterns: Record<string, string> = {
  decir: 'diciendo',
  dormir: 'durmiendo',
  ir: 'yendo',
  leer: 'leyendo',
  morir: 'muriendo',
  oír: 'oyendo',
  pedir: 'pidiendo',
  poder: 'pudiendo',
  seguir: 'siguiendo',
  sentir: 'sintiendo',
  servir: 'sirviendo',
  venir: 'viniendo',
  vestir: 'vistiendo',
  repetir: 'repitiendo',
  mentir: 'mintiendo',
  preferir: 'prefiriendo',
  elegir: 'eligiendo',
  conseguir: 'consiguiendo',
  construir: 'construyendo',
  destruir: 'destruyendo',
  incluir: 'incluyendo',
  caer: 'cayendo',
  traer: 'trayendo',
  creer: 'creyendo',
  reír: 'riendo',
  sonreír: 'sonriendo',
  huir: 'huyendo',
};

// ============ STEM CHANGE PATTERNS ============

type StemChangePattern = 'e_ie' | 'e_i' | 'o_ue' | 'u_ue';

// Which persons get the stem change (0=yo, 1=tú, 2=él, 3=nos, 4=vos, 5=ellos)
// Boot verbs: change in yo, tú, él, ellos (not nosotros/vosotros)
const bootPositions = [0, 1, 2, 5];
// For preterite e→i and o→u changes: only él and ellos
const preteriteChangePositions = [2, 5];

function applyStemChange(
  stem: string,
  pattern: StemChangePattern,
): string {
  const changes: Record<StemChangePattern, [string, string]> = {
    e_ie: ['e', 'ie'],
    e_i: ['e', 'i'],
    o_ue: ['o', 'ue'],
    u_ue: ['u', 'ue'],
  };
  const [from, to] = changes[pattern];
  // Change the LAST occurrence of the vowel in the stem
  const lastIndex = stem.lastIndexOf(from);
  if (lastIndex === -1) return stem;
  return stem.slice(0, lastIndex) + to + stem.slice(lastIndex + from.length);
}

// ============ PATTERN DEFINITIONS ============

export interface IrregularPattern {
  stemChange?: {
    present?: StemChangePattern;
    preterite?: StemChangePattern; // e→i or o→u in preterite (3rd person)
  };
  yoGo?: boolean; // yo form ends in -go (tengo, vengo, etc.)
  yoZco?: boolean; // yo form ends in -zco (conozco, etc.)
  irregularPreteriteStem?: string; // e.g. "tuv" for tener
  irregularFutureStem?: string; // e.g. "tendr" for tener
  spellingChange?: 'car_qué' | 'gar_gué' | 'zar_cé' | 'ger_ja' | 'gir_ja' | 'guir_ga' | 'uir_uy';
  fullOverrides?: Partial<Record<SimpleTense, string[]>>;
}

// ============ TYPE EXPORTS ============

export type SimpleTense = keyof typeof regularEndings;
export type CompoundTense = keyof typeof haberForms;
export type Tense = SimpleTense | CompoundTense | 'gerund_participle';

export const allTenses: Tense[] = [
  'present',
  'preterite',
  'imperfect',
  'future',
  'conditional',
  'subjunctive_present',
  'subjunctive_imperfect',
  'imperative_affirmative',
  'imperative_negative',
  'present_perfect',
  'past_perfect',
  'future_perfect',
  'conditional_perfect',
  'gerund_participle',
];

export const tenseNames: Record<Tense, string> = {
  present: 'Present',
  preterite: 'Preterite',
  imperfect: 'Imperfect',
  future: 'Future',
  conditional: 'Conditional',
  subjunctive_present: 'Subj. Present',
  subjunctive_imperfect: 'Subj. Imperfect',
  imperative_affirmative: 'Imperative (+)',
  imperative_negative: 'Imperative (−)',
  present_perfect: 'Pres. Perfect',
  past_perfect: 'Past Perfect',
  future_perfect: 'Fut. Perfect',
  conditional_perfect: 'Cond. Perfect',
  gerund_participle: 'Gerund & Participle',
};

export const imperativeTenses: Tense[] = [
  'imperative_affirmative',
  'imperative_negative',
];

export interface VerbData {
  type: 'ar' | 'er' | 'ir';
  regular: boolean;
  translation: string;
  pattern?: IrregularPattern;
  overrides?: Partial<Record<SimpleTense, string[]>>;
}

export interface ConjugationResult {
  pronoun: string;
  form: string;
  disabled?: boolean;
}

// ============ HELPER FUNCTIONS ============

function getPastParticiple(infinitive: string, type: string): string {
  const irregular = getIrregularParticiple(infinitive);
  if (irregular) return irregular;
  const stem = infinitive.slice(0, -2);
  return type === 'ar' ? stem + 'ado' : stem + 'ido';
}

function getGerund(infinitive: string, type: string): string {
  if (irregularGerundPatterns[infinitive]) {
    return irregularGerundPatterns[infinitive];
  }
  const stem = infinitive.slice(0, -2);
  return type === 'ar' ? stem + 'ando' : stem + 'iendo';
}

// ============ SMART CONJUGATION ENGINE ============

function conjugateSimple(
  infinitive: string,
  verb: VerbData,
  tense: SimpleTense,
): ConjugationResult[] {
  const isImperative = imperativeTenses.includes(tense);
  const stem = infinitive.slice(0, -2);
  const pattern = verb.pattern;

  // 1. Check full overrides first (for truly irregular verbs)
  if (verb.overrides && verb.overrides[tense]) {
    return pronouns.map((pronoun, i) => ({
      pronoun,
      form: verb.overrides![tense]![i],
      disabled: isImperative && i === 0,
    }));
  }

  // Also check pattern-level full overrides
  if (pattern?.fullOverrides && pattern.fullOverrides[tense]) {
    return pronouns.map((pronoun, i) => ({
      pronoun,
      form: pattern.fullOverrides![tense]![i],
      disabled: isImperative && i === 0,
    }));
  }

  // 2. Build forms using patterns
  const endings = regularEndings[tense][verb.type];

  return pronouns.map((pronoun, i) => {
    let currentStem = stem;
    let currentEndings = endings;
    let useFullInfinitive = tense === 'future' || tense === 'conditional';

    // Irregular future/conditional stem
    if (useFullInfinitive && pattern?.irregularFutureStem) {
      return {
        pronoun,
        form: pattern.irregularFutureStem + currentEndings[i],
        disabled: isImperative && i === 0,
      };
    }

    // Irregular preterite stem
    if (tense === 'preterite' && pattern?.irregularPreteriteStem) {
      const pretEndings = ['e', 'iste', 'o', 'imos', 'isteis', 'ieron'];
      return {
        pronoun,
        form: pattern.irregularPreteriteStem + pretEndings[i],
        disabled: isImperative && i === 0,
      };
    }

    if (useFullInfinitive) {
      currentStem = infinitive;
    }

    // Yo-go verbs (present tense, yo form only) — check before stem change
    if (tense === 'present' && i === 0 && pattern?.yoGo) {
      return {
        pronoun,
        form: stem + 'go',
        disabled: false,
      };
    }

    // Stem changes in present
    if (tense === 'present' && pattern?.stemChange?.present) {
      if (bootPositions.includes(i)) {
        currentStem = applyStemChange(stem, pattern.stemChange.present);
      }
    }

    // Stem changes in preterite (e→i, o→u for -ir verbs, 3rd person only)
    if (tense === 'preterite' && pattern?.stemChange?.preterite) {
      if (preteriteChangePositions.includes(i)) {
        currentStem = applyStemChange(stem, pattern.stemChange.preterite);
      }
    }

    // Stem changes in subjunctive present
    if (tense === 'subjunctive_present' && pattern?.stemChange?.present) {
      if (bootPositions.includes(i)) {
        currentStem = applyStemChange(stem, pattern.stemChange.present);
      }
      // For -ir verbs with e→ie or e→i, nosotros/vosotros get e→i
      if (verb.type === 'ir' && pattern?.stemChange?.preterite && (i === 3 || i === 4)) {
        currentStem = applyStemChange(stem, pattern.stemChange.preterite);
      }
    }

    // Subjunctive imperfect uses preterite stem
    if (tense === 'subjunctive_imperfect') {
      if (pattern?.irregularPreteriteStem) {
        currentStem = pattern.irregularPreteriteStem;
        const subjImpEndings = ['iera', 'ieras', 'iera', 'iéramos', 'ierais', 'ieran'];
        return {
          pronoun,
          form: currentStem + subjImpEndings[i],
          disabled: isImperative && i === 0,
        };
      }
      if (pattern?.stemChange?.preterite && verb.type === 'ir') {
        if (preteriteChangePositions.includes(i) || i === 3 || i === 4) {
          currentStem = applyStemChange(stem, pattern.stemChange.preterite);
        }
      }
    }

    // Yo-zco verbs (present tense, yo form only)
    if (tense === 'present' && i === 0 && pattern?.yoZco) {
      return {
        pronoun,
        form: stem.slice(0, -1) + 'zco',
        disabled: false,
      };
    }

    // Subjunctive present for yo-zco verbs (all forms based on yo)
    if (tense === 'subjunctive_present' && pattern?.yoZco) {
      const zcoStem = stem.slice(0, -1) + 'zc';
      return {
        pronoun,
        form: zcoStem + currentEndings[i],
        disabled: isImperative && i === 0,
      };
    }

    // Spelling changes in preterite (yo form only)
    if (tense === 'preterite' && i === 0 && pattern?.spellingChange) {
      switch (pattern.spellingChange) {
        case 'car_qué': return { pronoun, form: stem.slice(0, -1) + 'qué', disabled: false };
        case 'gar_gué': return { pronoun, form: stem + 'ué', disabled: false };
        case 'zar_cé': return { pronoun, form: stem.slice(0, -1) + 'cé', disabled: false };
      }
    }

    // UIR verbs: insert 'y' before vowel endings
    if (pattern?.spellingChange === 'uir_uy') {
      if (tense === 'present' && [0, 1, 2, 5].includes(i)) {
        return {
          pronoun,
          form: stem.slice(0, -1) + 'uy' + currentEndings[i],
          disabled: false,
        };
      }
      if (tense === 'preterite' && [2, 5].includes(i)) {
        const ending = i === 2 ? 'ó' : 'eron';
        return {
          pronoun,
          form: stem.slice(0, -1) + 'uy' + ending,
          disabled: false,
        };
      }
    }

    // Negative imperative: prepend "no"
    const form = currentStem + currentEndings[i];
    const finalForm =
      isImperative && tense === 'imperative_negative' && i !== 0
        ? `no ${form}`
        : form;

    return {
      pronoun,
      form: finalForm,
      disabled: isImperative && i === 0,
    };
  });
}

// ============ MAIN EXPORT ============

export function conjugate(
  infinitive: string,
  verb: VerbData,
  tense: Tense,
): ConjugationResult[] {
  if (tense === 'gerund_participle') {
    return [
      { pronoun: 'Gerund', form: getGerund(infinitive, verb.type) },
      { pronoun: 'Past Participle', form: getPastParticiple(infinitive, verb.type) },
    ];
  }

  if (tense in haberForms) {
    const participle = getPastParticiple(infinitive, verb.type);
    const haber = haberForms[tense as CompoundTense];
    return pronouns.map((pronoun, i) => ({
      pronoun,
      form: `${haber[i]} ${participle}`,
    }));
  }

  return conjugateSimple(infinitive, verb, tense as SimpleTense);
}