import verbs from '../data/verbs.json';
import { allTenses, conjugate, type Tense, type VerbData } from '../utils/conjugate';
import { generateQuestion } from '../utils/quizQuestion';

const data = verbs as Record<string, VerbData>;
// DLE conjugation tables checked 2026-10-01:
// https://dle.rae.es/reír https://dle.rae.es/sonreír
// https://dle.rae.es/huir https://dle.rae.es/fluir

test.each<[string, Tense, number, string]>([
  ['reír', 'preterite', 2, 'rio'], ['reír', 'subjunctive_present', 4, 'riais'],
  ['reír', 'imperative_negative', 4, 'no riais'],
  ['huir', 'preterite', 0, 'hui'], ['huir', 'present', 4, 'huis'],
  ['fluir', 'preterite', 0, 'flui'], ['fluir', 'present', 4, 'fluis'],
  ['sonreír', 'preterite', 2, 'sonrió'], ['sonreír', 'subjunctive_present', 4, 'sonriáis'],
  ['reír', 'preterite', 0, 'reí'], ['reír', 'present', 4, 'reís'],
  ['reír', 'present', 0, 'río'], ['reír', 'present', 2, 'ríe'],
  ['incluir', 'preterite', 0, 'incluí'], ['construir', 'present', 4, 'construís'],
  ['huir', 'preterite', 2, 'huyó'], ['huir', 'imperfect', 4, 'huíais'],
  ['enviar', 'present', 0, 'envío'], ['confiar', 'present', 0, 'confío'],
  ['evaluar', 'present', 0, 'evalúo'],
])('%s %s person %i keeps the DLE spelling %s', (verb, tense, person, expected) => {
  expect(conjugate(verb, data[verb], tense)[person].form).toBe(expected);
});

test('all shipped forms, examples and quiz distractors exclude superseded monosyllable spellings', () => {
  const obsolete = new Set(['rió', 'riáis', 'huí', 'huís', 'fluí', 'fluís']);
  const obsoleteWords = (text: string) => (text.toLowerCase().match(/\p{L}+/gu) ?? []).filter(word => obsolete.has(word));
  for (const [verb, entry] of Object.entries(data)) {
    for (const tense of allTenses) {
      for (const row of conjugate(verb, entry, tense)) expect(obsoleteWords(row.form)).toEqual([]);
    }
    for (const example of entry.examples ?? []) expect(obsoleteWords(example)).toEqual([]);
  }
  let state = 2010;
  const random = jest.spyOn(Math, 'random').mockImplementation(() => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  });
  try {
    const entries: [string, VerbData][] = ['reír', 'huir', 'fluir'].map(verb => [verb, data[verb]]);
    for (let i = 0; i < 100; i++) {
      const question = generateQuestion(['present', 'preterite', 'subjunctive_present', 'imperative_negative'], () => 1, entries);
      expect(question.options.flatMap(obsoleteWords)).toEqual([]);
    }
  } finally {
    random.mockRestore();
  }
});
