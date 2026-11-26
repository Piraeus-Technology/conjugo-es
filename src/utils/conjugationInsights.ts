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
  const present = conjugate(infinitive, verb, 'present');

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
    case 'i_ie':
      notes.add('Present tense stem change: i -> ie in boot forms.');
      break;
    case 'u_ue':
      notes.add('Present tense stem change: u -> ue in boot forms.');
      break;
    case 'i_í':
      notes.add('The stem i takes an accent in present-tense boot forms.');
      break;
    case 'u_ú':
      notes.add('The stem u takes an accent in present-tense boot forms.');
      break;
  }

  switch (pattern?.stemChange?.preterite) {
    case 'e_i':
      notes.add('The stem changes from e to i in the third-person preterite and throughout the imperfect subjunctive.');
      break;
    case 'o_u':
      notes.add('The stem changes from o to u in the third-person preterite and throughout the imperfect subjunctive.');
      break;
  }

  if (pattern?.yoGo && !present[0].disabled) notes.add('Irregular yo form: the present tense yo form ends in -go.');
  if (pattern?.yoZco && !present[0].disabled) notes.add('Irregular yo form: the present tense yo form ends in -zco.');
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

  if (verb.type !== 'ar' && /(?:ñ|ll)$/.test(stem) && gerund === `${stem}endo`) {
    notes.add(`After ñ or ll, the gerund ends in -endo (${gerund}). The third-person preterite endings are -ó and -eron.`);
  } else if (gerund !== regularGerund) {
    notes.add(`Irregular gerund: ${gerund}.`);
  }
  if (participle !== regularParticiple) {
    notes.add(`Irregular past participle: ${participle}.`);
  }

  for (const tense of ['present', 'preterite', 'subjunctive_present'] as const) {
    if (!verb.overrides?.[tense] && !pattern?.fullOverrides?.[tense]) continue;
    const example = conjugate(infinitive, verb, tense)[tense === 'preterite' ? 2 : 0];
    if (!example.disabled) {
      notes.add(`Some forms have irregular stems or endings, such as ${example.form}.`);
      break;
    }
  }

  if (verb.impersonal) {
    notes.add('Defective conjugation: only the third-person singular is used for weather or time of day.');
  }
  if (verb.thirdPersonOnly) {
    notes.add('Defective conjugation: used only in the third-person singular and plural.');
  }
  if (verb.pronominalOnly) {
    notes.add(`Used as ${infinitive}se: me ${present[0].form}, te ${present[1].form}, se ${present[2].form}.`);
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
