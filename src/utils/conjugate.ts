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

// ============ PROGRESSIVE TENSES ============

const estarForms: Record<string, string[]> = {
  present_progressive: ['estoy', 'estás', 'está', 'estamos', 'estáis', 'están'],
  past_progressive: ['estaba', 'estabas', 'estaba', 'estábamos', 'estabais', 'estaban'],
};

// ============ IRREGULAR PARTICIPLES ============

// Explicit list of ALL verbs with irregular participles.
// No more auto-matching compound verbs — too error-prone
// (e.g. "remover" matched "ver" → "removisto")
const irregularParticiples: Record<string, string> = {
  // Base irregulars
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
  imprimir: 'impreso',
  freír: 'frito',
  satisfacer: 'satisfecho',
  // Compound -volver
  devolver: 'devuelto',
  envolver: 'envuelto',
  revolver: 'revuelto',
  // Compound -poner
  componer: 'compuesto',
  disponer: 'dispuesto',
  exponer: 'expuesto',
  imponer: 'impuesto',
  oponer: 'opuesto',
  proponer: 'propuesto',
  suponer: 'supuesto',
  descomponer: 'descompuesto',
  // Compound -hacer
  deshacer: 'deshecho',
  rehacer: 'rehecho',
  // Compound -cubrir
  descubrir: 'descubierto',
  encubrir: 'encubierto',
  recubrir: 'recubierto',
  // Compound -escribir
  describir: 'descrito',
  inscribir: 'inscrito',
  prescribir: 'prescrito',
  suscribir: 'suscrito',
  transcribir: 'transcrito',
  // Compound -ver
  prever: 'previsto',
  entrever: 'entrevisto',
  // Compound -decir
  bendecir: 'bendecido', // regular participle (unlike decir)
  maldecir: 'maldecido', // regular participle
  predecir: 'predicho',
  contradecir: 'contradicho',
  // Compound -abrir
  entreabrir: 'entreabierto',
  // Compound -resolver
  disolver: 'disuelto',
};

function getIrregularParticiple(infinitive: string): string | null {
  return irregularParticiples[infinitive] || null;
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
  spellingChange?: 'car_qué' | 'gar_gué' | 'zar_cé' | 'cer_z' | 'ger_j' | 'gir_j' | 'guir_g' | 'uir_uy';
  fullOverrides?: Partial<Record<SimpleTense, string[]>>;
}

// ============ TYPE EXPORTS ============

export type SimpleTense = keyof typeof regularEndings;
export type CompoundTense = keyof typeof haberForms;
export type ProgressiveTense = keyof typeof estarForms;
export type Tense = SimpleTense | CompoundTense | ProgressiveTense | 'gerund_participle';

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
  'present_progressive',
  'past_progressive',
  'gerund_participle',
];

export const tenseNames: Record<Tense, string> = {
  present: 'Present',
  preterite: 'Preterite',
  imperfect: 'Imperfect',
  future: 'Future',
  conditional: 'Conditional',
  subjunctive_present: 'Subjunctive Present',
  subjunctive_imperfect: 'Subjunctive Imperfect',
  imperative_affirmative: 'Imperative (+)',
  imperative_negative: 'Imperative (−)',
  present_perfect: 'Present Perfect',
  past_perfect: 'Past Perfect',
  future_perfect: 'Future Perfect',
  conditional_perfect: 'Conditional Perfect',
  present_progressive: 'Present Progressive',
  past_progressive: 'Past Progressive',
  gerund_participle: 'Gerund & Participle',
};

export const imperativeTenses: Tense[] = [
  'imperative_affirmative',
  'imperative_negative',
];

export type VerbLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface VerbData {
  type: 'ar' | 'er' | 'ir';
  regular: boolean;
  translation: string;
  level?: VerbLevel;
  examples?: string[];
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
  // -uir verbs: i between vowels → y (distribuir → distribuyendo)
  if (infinitive.endsWith('uir')) {
    return infinitive.slice(0, -2) + 'yendo';
  }
  const stem = infinitive.slice(0, -2);
  return type === 'ar' ? stem + 'ando' : stem + 'iendo';
}

// ============ SMART CONJUGATION ENGINE ============

interface ConjugationContext {
  infinitive: string;
  stem: string;
  verb: VerbData;
  pattern: IrregularPattern | undefined;
  tense: SimpleTense;
  endings: string[];
  isImperative: boolean;
}

function makeResult(pronoun: string, form: string, disabled: boolean): ConjugationResult {
  return { pronoun, form, disabled };
}

/** Check for full overrides (truly irregular verbs like ser, ir) */
function tryOverrides(ctx: ConjugationContext): ConjugationResult[] | null {
  const overrides = ctx.verb.overrides?.[ctx.tense] ?? ctx.pattern?.fullOverrides?.[ctx.tense];
  if (overrides) {
    return pronouns.map((pronoun, i) =>
      makeResult(pronoun, overrides[i], ctx.isImperative && i === 0)
    );
  }

  // Derive imperative from subjunctive overrides if available
  const subjOverrides = ctx.verb.overrides?.subjunctive_present ?? ctx.pattern?.fullOverrides?.subjunctive_present;
  if (subjOverrides && ctx.tense === 'imperative_affirmative') {
    // tú (index 1) uses 3rd person present (handled elsewhere), rest use subjunctive
    const presentOverrides = ctx.verb.overrides?.present;
    return pronouns.map((pronoun, i) => {
      if (i === 0) return makeResult(pronoun, '—', true);
      if (i === 1 && presentOverrides) return makeResult(pronoun, presentOverrides[2], false); // tú = 3rd person present
      if (i === 4) return makeResult(pronoun, ctx.stem + ctx.endings[i], false); // vosotros regular
      return makeResult(pronoun, subjOverrides[i], false);
    });
  }
  if (subjOverrides && ctx.tense === 'imperative_negative') {
    return pronouns.map((pronoun, i) => {
      if (i === 0) return makeResult(pronoun, '—', true);
      return makeResult(pronoun, 'no ' + subjOverrides[i], false);
    });
  }

  return null;
}

/** Handle irregular future/conditional stems (tendr-, harr-, etc.) */
function tryIrregularFutureConditional(ctx: ConjugationContext, i: number): string | null {
  if ((ctx.tense === 'future' || ctx.tense === 'conditional') && ctx.pattern?.irregularFutureStem) {
    return ctx.pattern.irregularFutureStem + ctx.endings[i];
  }
  return null;
}

/** Handle irregular preterite stems (tuv-, sup-, etc.) */
function tryIrregularPreterite(ctx: ConjugationContext, i: number): string | null {
  if (ctx.tense === 'preterite' && ctx.pattern?.irregularPreteriteStem) {
    const pretEndings = ['e', 'iste', 'o', 'imos', 'isteis', 'ieron'];
    return ctx.pattern.irregularPreteriteStem + pretEndings[i];
  }
  return null;
}

/** Handle yo-go verbs in present tense (tengo, vengo, etc.) */
function tryYoGo(ctx: ConjugationContext, i: number): string | null {
  if (!ctx.pattern?.yoGo) return null;
  const goStem = ctx.stem + 'g';
  if (ctx.tense === 'present' && i === 0) {
    return goStem + 'o';
  }
  // Subjunctive present: all persons use g stem
  if (ctx.tense === 'subjunctive_present') {
    const subjEndings = ctx.verb.type === 'ar'
      ? ['e', 'es', 'e', 'emos', 'éis', 'en']
      : ['a', 'as', 'a', 'amos', 'áis', 'an'];
    return goStem + subjEndings[i];
  }
  // Imperative affirmative: usted/nosotros/ustedes use subjunctive (g+a) forms
  if (ctx.tense === 'imperative_affirmative' && [2, 3, 5].includes(i)) {
    const impEndings: Record<number, string> = { 2: 'a', 3: 'amos', 5: 'an' };
    return goStem + impEndings[i];
  }
  // Imperative negative: all persons use subjunctive (g+a) forms
  if (ctx.tense === 'imperative_negative' && i !== 0) {
    const negEndings: Record<number, string> = { 1: 'as', 2: 'a', 3: 'amos', 4: 'áis', 5: 'an' };
    return 'no ' + goStem + negEndings[i];
  }
  return null;
}

/** Handle yo-zco verbs (conozco, aparezco, etc.) */
function tryYoZco(ctx: ConjugationContext, i: number): string | null {
  if (!ctx.pattern?.yoZco) return null;
  const zcStem = ctx.stem.slice(0, -1) + 'zc';
  if (ctx.tense === 'present' && i === 0) {
    return zcStem + 'o';
  }
  if (ctx.tense === 'subjunctive_present') {
    return zcStem + ctx.endings[i];
  }
  // Imperative affirmative: usted/nosotros/ustedes use subjunctive (zc+a) forms
  if (ctx.tense === 'imperative_affirmative' && [2, 3, 5].includes(i)) {
    const subjEndings: Record<number, string> = { 2: 'a', 3: 'amos', 5: 'an' };
    return zcStem + subjEndings[i];
  }
  // Imperative negative: all persons use subjunctive (zc+a) forms
  if (ctx.tense === 'imperative_negative' && i !== 0) {
    const negEndings: Record<number, string> = { 1: 'as', 2: 'a', 3: 'amos', 4: 'áis', 5: 'an' };
    return 'no ' + zcStem + negEndings[i];
  }
  return null;
}

/** Handle spelling changes for -car, -gar, -zar, -cer, -ger, -gir, -guir verbs */
function trySpellingChangePreterite(ctx: ConjugationContext, i: number): string | null {
  if (!ctx.pattern?.spellingChange) return null;
  const sc = ctx.pattern.spellingChange;

  // Get the modified stem for subjunctive/imperative contexts (before a/o)
  const getModStem = (): string | null => {
    switch (sc) {
      case 'car_qué': return ctx.stem.slice(0, -1) + 'qu';
      case 'gar_gué': return ctx.stem + 'u';
      case 'zar_cé': return ctx.stem.slice(0, -1) + 'c';
      case 'cer_z': return ctx.stem.slice(0, -1) + 'z';   // torcer → tuerz/torz
      case 'ger_j': return ctx.stem.slice(0, -1) + 'j';   // coger → coj
      case 'gir_j': return ctx.stem.slice(0, -1) + 'j';   // dirigir → dirij
      case 'guir_g': return ctx.stem.slice(0, -2) + 'g';  // distinguir → disting
      default: return null;
    }
  };

  const modStem = getModStem();
  if (!modStem) return null;

  // Preterite yo (-car/-gar/-zar only)
  if (ctx.tense === 'preterite' && i === 0) {
    switch (sc) {
      case 'car_qué': return ctx.stem.slice(0, -1) + 'qué';
      case 'gar_gué': return ctx.stem + 'ué';
      case 'zar_cé': return ctx.stem.slice(0, -1) + 'cé';
    }
  }

  // Present yo (-cer_z, -ger_j, -gir_j, -guir_g): yo form changes
  if (ctx.tense === 'present' && i === 0) {
    if (sc === 'cer_z' || sc === 'ger_j' || sc === 'gir_j' || sc === 'guir_g') {
      let finalStem = modStem;
      if (ctx.pattern?.stemChange?.present) {
        finalStem = applyStemChange(modStem, ctx.pattern.stemChange.present);
      }
      return finalStem + 'o';
    }
  }

  // Subjunctive present: all persons use modified stem
  if (ctx.tense === 'subjunctive_present') {
    if (sc === 'car_qué' || sc === 'gar_gué' || sc === 'zar_cé') {
      return modStem + ctx.endings[i];
    }
    // -cer/-ger/-gir/-guir: subjunctive uses modified stem + -ar subjunctive endings
    const subjEndings = ctx.verb.type === 'ir'
      ? ['a', 'as', 'a', 'amos', 'áis', 'an']
      : ['a', 'as', 'a', 'amos', 'áis', 'an'];
    // Apply stem change if present (e.g. torcer o→ue in boot positions)
    let finalStem = modStem;
    if (ctx.pattern?.stemChange?.present && [0, 1, 2, 5].includes(i)) {
      finalStem = applyStemChange(modStem, ctx.pattern.stemChange.present);
    }
    return finalStem + subjEndings[i];
  }

  // Imperative affirmative: usted/nosotros/ustedes use subjunctive forms
  if (ctx.tense === 'imperative_affirmative' && [2, 3, 5].includes(i)) {
    if (sc === 'car_qué' || sc === 'gar_gué' || sc === 'zar_cé') {
      const impEndings: Record<number, string> = { 2: 'e', 3: 'emos', 5: 'en' };
      return modStem + impEndings[i];
    }
    const impEndings: Record<number, string> = { 2: 'a', 3: 'amos', 5: 'an' };
    let finalStem = modStem;
    if (ctx.pattern?.stemChange?.present && [2, 5].includes(i)) {
      finalStem = applyStemChange(modStem, ctx.pattern.stemChange.present);
    }
    return finalStem + impEndings[i];
  }

  // Imperative negative: all persons use subjunctive forms
  if (ctx.tense === 'imperative_negative' && i !== 0) {
    if (sc === 'car_qué' || sc === 'gar_gué' || sc === 'zar_cé') {
      const negEndings: Record<number, string> = { 1: 'es', 2: 'e', 3: 'emos', 4: 'éis', 5: 'en' };
      return 'no ' + modStem + negEndings[i];
    }
    const negEndings: Record<number, string> = { 1: 'as', 2: 'a', 3: 'amos', 4: 'áis', 5: 'an' };
    let finalStem = modStem;
    if (ctx.pattern?.stemChange?.present && [1, 2, 5].includes(i)) {
      finalStem = applyStemChange(modStem, ctx.pattern.stemChange.present);
    }
    return 'no ' + finalStem + negEndings[i];
  }

  return null;
}

/** Handle UIR verbs with y-insertion (construyo, destruyen, etc.) */
function tryUirVerb(ctx: ConjugationContext, i: number): string | null {
  if (ctx.pattern?.spellingChange !== 'uir_uy') return null;
  const uirStem = ctx.stem.slice(0, -1) + 'uy';
  if (ctx.tense === 'present' && [0, 1, 2, 5].includes(i)) {
    return uirStem + ctx.endings[i];
  }
  if (ctx.tense === 'preterite' && [2, 5].includes(i)) {
    return uirStem + (i === 2 ? 'ó' : 'eron');
  }
  // Imperative affirmative: tú uses 3rd person present (uy+e), others use subjunctive (uy+a)
  if (ctx.tense === 'imperative_affirmative' && i !== 0 && i !== 4) {
    const impEndings: Record<number, string> = { 1: 'e', 2: 'a', 3: 'amos', 5: 'an' };
    return uirStem + impEndings[i];
  }
  // Imperative negative: all use subjunctive forms (uy+a)
  if (ctx.tense === 'imperative_negative' && i !== 0) {
    const negEndings: Record<number, string> = { 1: 'as', 2: 'a', 3: 'amos', 4: 'áis', 5: 'an' };
    return 'no ' + uirStem + negEndings[i];
  }
  // Subjunctive present: all persons use uy stem
  if (ctx.tense === 'subjunctive_present') {
    const subjEndings = ['a', 'as', 'a', 'amos', 'áis', 'an'];
    return uirStem + subjEndings[i];
  }
  return null;
}

/** Handle subjunctive imperfect with irregular preterite stems */
function trySubjunctiveImperfect(ctx: ConjugationContext, i: number): string | null {
  if (ctx.tense !== 'subjunctive_imperfect' || !ctx.pattern?.irregularPreteriteStem) return null;
  const subjImpEndings = ['iera', 'ieras', 'iera', 'iéramos', 'ierais', 'ieran'];
  return ctx.pattern.irregularPreteriteStem + subjImpEndings[i];
}

/** Apply stem changes based on tense and person */
function applyStemChanges(ctx: ConjugationContext, i: number, currentStem: string): string {
  const { tense, stem, verb, pattern } = ctx;

  // Present tense: boot pattern stem changes
  if (tense === 'present' && pattern?.stemChange?.present) {
    if (bootPositions.includes(i)) {
      return applyStemChange(stem, pattern.stemChange.present);
    }
  }

  // Imperative affirmative: tú (index 1) and usted/ustedes (2, 5) use stem change in boot positions
  if (tense === 'imperative_affirmative' && pattern?.stemChange?.present) {
    if (i === 1 || i === 2 || i === 5) {
      return applyStemChange(stem, pattern.stemChange.present);
    }
  }

  // Imperative negative: uses subjunctive forms, so boot positions get stem change
  if (tense === 'imperative_negative' && pattern?.stemChange?.present) {
    if (bootPositions.includes(i)) {
      return applyStemChange(stem, pattern.stemChange.present);
    }
  }

  // Preterite: 3rd person stem changes for -ir verbs
  if (tense === 'preterite' && pattern?.stemChange?.preterite) {
    if (preteriteChangePositions.includes(i)) {
      return applyStemChange(stem, pattern.stemChange.preterite);
    }
  }

  // Subjunctive present: boot pattern + nosotros/vosotros for -ir
  if (tense === 'subjunctive_present' && pattern?.stemChange?.present) {
    if (bootPositions.includes(i)) {
      return applyStemChange(stem, pattern.stemChange.present);
    }
    if (verb.type === 'ir' && pattern?.stemChange?.preterite && (i === 3 || i === 4)) {
      return applyStemChange(stem, pattern.stemChange.preterite);
    }
  }

  // Subjunctive imperfect: stem changes for -ir verbs
  if (tense === 'subjunctive_imperfect' && pattern?.stemChange?.preterite && verb.type === 'ir') {
    if (preteriteChangePositions.includes(i) || i === 3 || i === 4) {
      return applyStemChange(stem, pattern.stemChange.preterite);
    }
  }

  return currentStem;
}

function conjugateSimple(
  infinitive: string,
  verb: VerbData,
  tense: SimpleTense,
): ConjugationResult[] {
  const isImperative = imperativeTenses.includes(tense);
  const stem = infinitive.slice(0, -2);
  const endings = regularEndings[tense][verb.type];
  const ctx: ConjugationContext = {
    infinitive, stem, verb, pattern: verb.pattern, tense, endings, isImperative,
  };

  // 1. Check full overrides first
  const overrideResult = tryOverrides(ctx);
  if (overrideResult) return overrideResult;

  // 2. Build forms per person
  return pronouns.map((pronoun, i) => {
    const disabled = isImperative && i === 0;

    // Try special patterns (each returns early if matched)
    const irregFutCond = tryIrregularFutureConditional(ctx, i);
    if (irregFutCond) return makeResult(pronoun, irregFutCond, disabled);

    const irregPret = tryIrregularPreterite(ctx, i);
    if (irregPret) return makeResult(pronoun, irregPret, disabled);

    const yoGo = tryYoGo(ctx, i);
    if (yoGo) return makeResult(pronoun, yoGo, false);

    const yoZco = tryYoZco(ctx, i);
    if (yoZco) return makeResult(pronoun, yoZco, disabled);

    const subjImp = trySubjunctiveImperfect(ctx, i);
    if (subjImp) return makeResult(pronoun, subjImp, disabled);

    const spellingPret = trySpellingChangePreterite(ctx, i);
    if (spellingPret) return makeResult(pronoun, spellingPret, false);

    const uir = tryUirVerb(ctx, i);
    if (uir) return makeResult(pronoun, uir, false);

    // Regular path: determine stem
    let currentStem = (tense === 'future' || tense === 'conditional') ? infinitive : stem;
    currentStem = applyStemChanges(ctx, i, currentStem);

    // Build final form
    const form = currentStem + endings[i];
    const finalForm = isImperative && tense === 'imperative_negative' && i !== 0
      ? `no ${form}`
      : form;

    return makeResult(pronoun, finalForm, disabled);
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

  if (tense in estarForms) {
    const gerund = getGerund(infinitive, verb.type);
    const estar = estarForms[tense as ProgressiveTense];
    return pronouns.map((pronoun, i) => ({
      pronoun,
      form: `${estar[i]} ${gerund}`,
    }));
  }

  return conjugateSimple(infinitive, verb, tense as SimpleTense);
}