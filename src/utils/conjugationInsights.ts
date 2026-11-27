import {
  conjugate,
  getRegularPastParticiple,
  imperativeTenses,
  tenseNames,
  type Tense,
  type VerbData,
} from './conjugate';

const familyBases = ['decir', 'hacer', 'poner', 'tener', 'venir', 'traer', 'ver', 'oír', 'reír'] as const;
const verFamily = new Set(['ver', 'prever', 'entrever']);

const accentless = (form: string) => form.normalize('NFD').replace(/\u0301/g, '');

export function getOverrideExample(infinitive: string, verb: VerbData) {
  for (const tense of ['present', 'preterite', 'subjunctive_present'] as const) {
    if (!verb.overrides?.[tense] && !verb.pattern?.fullOverrides?.[tense]) continue;
    const regular = conjugate(infinitive, { type: verb.type, regular: true, translation: verb.translation }, tense);
    const displayed = conjugate(infinitive, verb, tense);
    const order = tense === 'preterite' ? [2, 0, 1, 3, 4, 5] : [0, 1, 2, 3, 4, 5];
    const personIndex = order.find(index => !displayed[index].disabled && displayed[index].form !== regular[index].form);
    if (personIndex === undefined) continue;

    const form = displayed[personIndex].form;
    const regularForm = regular[personIndex].form;
    const stem = infinitive.slice(0, -2);
    const regularEnding = regularForm.slice(stem.length);
    let difference = 'stem and ending';
    if (accentless(form) === accentless(regularForm)) difference = 'accent';
    else if (form.replace(/ü/g, 'u') === regularForm || form.replace(/y/g, 'i') === regularForm) difference = 'spelling';
    else if (regularEnding && form.endsWith(regularEnding)) difference = 'stem';
    else if (stem && form.startsWith(stem)) difference = 'ending';
    return { tense, personIndex, form, regularForm, difference };
  }
}

export function getInflectionNotes(infinitive: string, verb: VerbData): string[] {
  const notes = new Set<string>();
  const pattern = verb.pattern;
  const present = conjugate(infinitive, verb, 'present');
  const hasForms = (tense: Tense) => conjugate(infinitive, verb, tense).some(row => !row.disabled);
  const presentScope = verb.impersonal ? 'in the third-person singular' : verb.thirdPersonOnly
    ? 'in the third person' : 'in boot forms';

  switch (!present[2].disabled && pattern?.stemChange?.present) {
    case 'e_ie':
      notes.add(`Present tense stem change: e -> ie ${presentScope}.`);
      break;
    case 'o_ue':
      notes.add(`Present tense stem change: o -> ue ${presentScope}.`);
      break;
    case 'e_i':
      notes.add(`Present tense stem change: e -> i ${presentScope}.`);
      break;
    case 'i_ie':
      notes.add(`Present tense stem change: i -> ie ${presentScope}.`);
      break;
    case 'u_ue':
      notes.add(`Present tense stem change: u -> ue ${presentScope}.`);
      break;
    case 'i_í':
      notes.add(`The stem i takes an accent ${presentScope} in the present tense.`);
      break;
    case 'u_ú':
      notes.add(`The stem u takes an accent ${presentScope} in the present tense.`);
      break;
  }

  const preteriteChange = pattern?.stemChange?.preterite;
  if (preteriteChange === 'e_i' || preteriteChange === 'o_u') {
    const [from, to] = preteriteChange.split('_');
    const affected = [
      hasForms('preterite') && 'the third-person preterite',
      hasForms('subjunctive_imperfect') && (verb.impersonal || verb.thirdPersonOnly
        ? 'the available imperfect subjunctive forms' : 'all imperfect subjunctive forms'),
      !conjugate(infinitive, verb, 'subjunctive_present')[3].disabled && 'the nosotros and vosotros forms of the present subjunctive',
      'the gerund',
    ].filter(Boolean);
    notes.add(`For this -ir verb, the stem changes from ${from} to ${to} in ${affected.slice(0, -1).join(', ')}${affected.length > 1 ? ', and ' : ''}${affected.at(-1)}.`);
  }

  if (pattern?.yoGo && !present[0].disabled) notes.add('Irregular yo form: the present tense yo form ends in -go.');
  if (pattern?.yoZco) {
    if (!present[0].disabled) {
      notes.add('Irregular yo form: the present tense yo form ends in -zco.');
    } else {
      const example = conjugate(infinitive, verb, 'subjunctive_present').find(row => !row.disabled && /zca(?:s|mos|is|n)?$/.test(row.form));
      if (example) notes.add(`In the present subjunctive, the stem changes from -c- to -zc-, as in ${example.form}.`);
    }
  }
  if (pattern?.irregularFutureStem) {
    const tenses = (['future', 'conditional'] as const).filter(hasForms).map(tense => tenseNames[tense]);
    if (tenses.length) notes.add(`Irregular stem in ${tenses.join(' and ')}.`);
  }
  if (pattern?.irregularPreteriteStem) {
    const tenses = (['preterite', 'subjunctive_imperfect'] as const).filter(hasForms).map(tense => tenseNames[tense]);
    if (tenses.length) notes.add(`Irregular preterite stem in ${tenses.join(' and ')}.`);
  }

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
    notes.add(`In -er and -ir verbs, ñ or ll absorbs the i of the gerund ending (${gerund}).`);
    if (hasForms('preterite')) notes.add('After ñ or ll in these verbs, third-person preterite endings are -ó and -eron.');
    if (hasForms('subjunctive_imperfect')) notes.add('The imperfect subjunctive also drops that i, using endings such as -era and -eran.');
  } else if (gerund !== regularGerund) {
    notes.add(`Irregular gerund: ${gerund}.`);
  }
  if (participle !== regularParticiple) {
    notes.add(`Irregular past participle: ${participle}.`);
  }

  const example = getOverrideExample(infinitive, verb);
  if (example) notes.add(`Change in ${example.difference}: ${example.form}.`);

  return [...notes];
}

export function getRuleNotes(infinitive: string, verb: VerbData): string[] {
  const notes = getInflectionNotes(infinitive, verb);

  if (verb.impersonal) {
    notes.push('For weather or time of day, only the third-person singular is used.');
  }
  if (verb.thirdPersonOnly) {
    notes.push('In the meaning shown here, finite forms are used only in the third-person singular and plural.');
  }
  const unavailableTenses = verb.unavailableTenses ?? [];
  const hasNoImperative = verb.impersonal || verb.thirdPersonOnly || verb.noImperative
    || imperativeTenses.every(tense => unavailableTenses.includes(tense));
  if (hasNoImperative) notes.push('This use has no imperative forms.');
  const unavailableNamedTenses = unavailableTenses
    .filter(tense => !hasNoImperative || !imperativeTenses.includes(tense))
    .map(tense => verb.extendedReference && (tense === 'future' || tense === 'future_perfect')
      ? `${tenseNames[tense]} (including the subjunctive)` : tenseNames[tense]);
  if (unavailableNamedTenses.length) {
    notes.push(`This verb is not used in these tenses: ${unavailableNamedTenses.join(', ')}.`);
  }
  if (verb.pronominalOnly) {
    const present = conjugate(infinitive, verb, 'present');
    const examples = ['me', 'te', 'se'].flatMap((pronoun, index) =>
      present[index].disabled ? [] : [`${pronoun} ${present[index].form}`],
    );
    notes.push(`Used as ${infinitive}se${examples.length ? `: ${examples.join(', ')}` : ''}.`);
  }

  return notes;
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
