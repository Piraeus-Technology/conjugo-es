import verbs from '../data/verbs.json';
import { conjugate, type Tense, type VerbData } from '../utils/conjugate';
import { auditExamples, exampleContainsVerbForm } from '../utils/exampleAudit';

const dataset = verbs as Record<string, VerbData>;
const forms = (verb: string, tense: Tense) => conjugate(verb, dataset[verb], tense).map(row => row.form);

test('every generated -ar preterite retains its -ar endings', () => {
  for (const [word, data] of Object.entries(dataset)) {
    if (data.type !== 'ar' || data.overrides?.preterite || data.pattern?.fullOverrides?.preterite
      || data.pattern?.irregularPreteriteStem) continue;
    const stem = word.slice(0, -2);
    const rows = conjugate(word, data, 'preterite');
    ['aste', 'ó', 'amos', 'asteis', 'aron'].forEach((ending, offset) => {
      if (!rows[offset + 1].disabled) expect(rows[offset + 1].form).toBe(stem + ending);
    });
  }
});

test.each([
  ['gruñir', 'gruñó', 'gruñeron', 'gruñendo'],
  ['zambullir', 'zambulló', 'zambulleron', 'zambullendo'],
])('%s retains non-ar i-absorption', (word, singular, plural, gerund) => {
  expect(forms(word, 'preterite')[2]).toBe(singular);
  expect(forms(word, 'preterite')[5]).toBe(plural);
  expect(forms(word, 'gerund_participle')[0]).toBe(gerund);
});

test.each([
  ['encerrar', 'encierro', 'encierre', 'encerremos', 'encierra'],
  ['enterrar', 'entierro', 'entierre', 'enterremos', 'entierra'],
  ['cegar', 'ciego', 'ciegue', 'ceguemos', 'ciega'],
  ['colar', 'cuelo', 'cuele', 'colemos', 'cuela'],
  ['poblar', 'pueblo', 'pueble', 'poblemos', 'puebla'],
  ['volcar', 'vuelco', 'vuelque', 'volquemos', 'vuelca'],
  ['acrecentar', 'acreciento', 'acreciente', 'acrecentemos', 'acrecienta'],
])('%s changes its stem and preserves spelling in affected tenses', (word, yo, subj, nosotros, tu) => {
  expect(forms(word, 'present')[0]).toBe(yo);
  expect(forms(word, 'subjunctive_present')[0]).toBe(subj);
  expect(forms(word, 'subjunctive_present')[3]).toBe(nosotros);
  expect(forms(word, 'imperative_affirmative')[1]).toBe(tu);
  expect(forms(word, 'imperative_affirmative')[2]).toBe(subj);
  expect(forms(word, 'imperative_negative')[1]).toBe(`no ${subj}s`);
});

test.each([
  ['esparcir', 'esparzo', 'esparza', 'esparzamos', 'esparce'],
  ['zurcir', 'zurzo', 'zurza', 'zurzamos', 'zurce'],
  ['prohibir', 'prohíbo', 'prohíba', 'prohibamos', 'prohíbe'],
  ['aislar', 'aíslo', 'aísle', 'aislemos', 'aísla'],
])('%s preserves spelling and hiatus accents', (word, yo, subj, nosotros, tu) => {
  expect(forms(word, 'present')[0]).toBe(yo);
  expect(forms(word, 'subjunctive_present')[0]).toBe(subj);
  expect(forms(word, 'subjunctive_present')[3]).toBe(nosotros);
  expect(forms(word, 'imperative_affirmative')[1]).toBe(tu);
  expect(forms(word, 'imperative_affirmative')[2]).toBe(subj);
  expect(forms(word, 'imperative_negative')[1]).toBe(`no ${subj}s`);
});

test.each(['prever', 'entrever'])('%s keeps the full ver imperfect', word => {
  const prefix = word.slice(0, -3);
  expect(forms(word, 'imperfect')).toEqual(
    ['veía', 'veías', 'veía', 'veíamos', 'veíais', 'veían'].map(form => prefix + form),
  );
});

test('every e→i class member raises the nosotros/vosotros subjunctive stem', () => {
  for (const [word, data] of Object.entries(dataset)) {
    if (data.pattern?.stemChange?.present !== 'e_i') continue;
    const subj = forms(word, 'subjunctive_present');
    expect(subj[3]).toBe(`${subj[0]}mos`);
    expect(subj[4]).toBe(`${subj[0].slice(0, -1)}áis`);
    expect(forms(word, 'imperative_affirmative')[3]).toBe(subj[3]);
    expect(forms(word, 'imperative_negative')[4]).toBe(`no ${subj[4]}`);
  }
});

test.each(['decir', 'bendecir', 'maldecir', 'predecir', 'contradecir'])('%s has a -diciendo gerund', word => {
  expect(forms(word, 'gerund_participle')[0]).toBe(`${word.slice(0, -5)}diciendo`);
  expect(forms(word, 'present_progressive')[0]).toBe(`estoy ${word.slice(0, -5)}diciendo`);
});

test.each([
  ['hacer', 'haz'], ['deshacer', 'deshaz'], ['rehacer', 'rehaz'], ['satisfacer', 'satisface'],
  ['bendecir', 'bendice'], ['maldecir', 'maldice'], ['predecir', 'predice'], ['contradecir', 'contradice'],
])('%s retains the intended tú command', (word, expected) => {
  expect(forms(word, 'imperative_affirmative')[1]).toBe(expected);
});

test('example checker accepts complete enclitic forms, but not a shared stem', () => {
  expect(exampleContainsVerbForm('decir', dataset.decir, 'Dímelo ahora.')).toBe(true);
  expect(exampleContainsVerbForm('hablar', dataset.hablar, 'Quiero hablarles mañana.')).toBe(true);
  expect(exampleContainsVerbForm('hablar', dataset.hablar, 'Un hablador llegó.')).toBe(false);
  expect(exampleContainsVerbForm('enseñar', dataset.enseñar, 'Me enseñaron español.')).toBe(true);
});

// The generic example gate is audit:examples; group B resolves the four
// editorial mismatches remaining after group A. Keep this import checked.
test('generic audit reports the exact sentence and verb', () => {
  expect(auditExamples({ hablar: { ...dataset.hablar, examples: ['Un hablador llegó.'] } }))
    .toEqual([{ infinitive: 'hablar', example: 'Un hablador llegó.' }]);
});
