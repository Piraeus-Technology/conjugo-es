import {
  conjugate,
  getRegularPastParticiple,
  type VerbData,
} from './conjugate';

const familyBases = ['decir', 'hacer', 'poner', 'tener', 'venir', 'traer', 'ver', 'oír', 'reír'] as const;
const verFamily = new Set(['ver', 'prever', 'entrever']);

export function getRuleNotes(infinitive: string, verb: VerbData): string[] {
  const notes = new Set<string>();
  const pattern = verb.pattern;

  switch (pattern?.stemChange?.present) {
    case 'e_ie':
      notes.add('Present tense stem change: e -> ie in boot forms.');
      break;
    case 'o_ue':
      notes.add('Present tense stem change: o -> ue in boot forms.');
      break;
    case 'e_i':
      notes.add('Present tense stem change: e -> i in boot forms.');
      break;
    case 'u_ue':
      notes.add('Present tense stem change: u -> ue in boot forms.');
      break;
  }

  switch (pattern?.stemChange?.preterite) {
    case 'e_i':
      notes.add('Preterite and related subjunctive forms use e -> i in the third person / nosotros-vosotros patterns.');
      break;
    case 'o_u':
      notes.add('Preterite and related subjunctive forms use o -> u in the third person / nosotros-vosotros patterns.');
      break;
  }

  if (pattern?.yoGo) notes.add('Irregular yo form: the present tense yo form ends in -go.');
  if (pattern?.yoZco) notes.add('Irregular yo form: the present tense yo form ends in -zco.');
  if (pattern?.irregularFutureStem) notes.add('Future and conditional use an irregular stem.');
  if (pattern?.irregularPreteriteStem) notes.add('Preterite and imperfect subjunctive use an irregular preterite stem.');

  switch (pattern?.spellingChange) {
    case 'car_qué':
      notes.add('Spelling change: c -> qu before e in affected forms.');
      break;
    case 'gar_gué':
      notes.add('Spelling change: g -> gu before e in affected forms.');
      break;
    case 'zar_cé':
      notes.add('Spelling change: z -> c before e in affected forms.');
      break;
    case 'cer_z':
      notes.add('Spelling change: c -> z before a / o in subjunctive and imperative-related forms.');
      break;
    case 'ger_j':
    case 'gir_j':
      notes.add('Spelling change: g -> j before a / o in subjunctive and imperative-related forms.');
      break;
    case 'guir_g':
      notes.add('Spelling change: gu -> g in affected present/subjunctive forms.');
      break;
    case 'uir_uy':
      notes.add('Y-insertion pattern: forms like present, preterite third person, and subjunctive keep y.');
      break;
  }

  const [gerund, participle] = conjugate(infinitive, verb, 'gerund_participle').map(
    (result) => result.form,
  );
  const stem = infinitive.slice(0, -2);
  const regularGerund = verb.type === 'ar' ? `${stem}ando` : `${stem}iendo`;
  const regularParticiple = getRegularPastParticiple(infinitive, verb.type);

  if (gerund !== regularGerund) notes.add(`Irregular gerund: ${gerund}.`);
  if (participle !== regularParticiple) {
    notes.add(`Irregular past participle: ${participle}.`);
  }

  if (
    verb.overrides?.present
    || verb.overrides?.preterite
    || verb.overrides?.subjunctive_present
  ) {
    notes.add('Some core forms are fully overridden rather than generated from a regular pattern.');
  }

  if (verb.impersonal) {
    notes.add('Used impersonally in the third-person singular.');
  }

  return [...notes];
}

export function getFamilyKey(infinitive: string, verb: VerbData): string | null {
  for (const base of familyBases) {
    if (base === 'ver') {
      if (verFamily.has(infinitive)) return 'base:ver';
      continue;
    }
    if (infinitive === base || infinitive.endsWith(base)) return `base:${base}`;
  }

  if (verb.pattern?.spellingChange) return `spelling:${verb.pattern.spellingChange}`;
  if (verb.pattern?.yoZco) return 'family:yoZco';
  if (verb.pattern?.yoGo) return 'family:yoGo';
  if (verb.pattern?.stemChange?.present || verb.pattern?.stemChange?.preterite) {
    return `stem:${verb.pattern.stemChange?.present ?? 'none'}:${verb.pattern.stemChange?.preterite ?? 'none'}`;
  }

  return null;
}
