import verbs from '../data/verbs.json';
import { conjugate, type VerbData, type Tense } from '../utils/conjugate';
import { auditExamples } from '../utils/exampleAudit';

const names = ['andar', 'continuar', 'llenar', 'quitar', 'gastar', 'dudar', 'reunir', 'actuar', 'saltar', 'acostar', 'escoger'];
const data = verbs as Record<string, VerbData>;

test('approved common verbs have valid examples and complete finite paradigms', () => {
  const additions = Object.fromEntries(names.map(name => [name, data[name]]));
  expect(auditExamples(additions)).toEqual([]);
  for (const name of names) {
    expect(data[name].examples).toHaveLength(2);
    expect(conjugate(name, data[name], 'present').every(row => row.form !== '—')).toBe(true);
  }
  expect(data.andar.examples?.[0]).toBe('Ando por el parque todas las mañanas.');
});

test.each<[string, Tense, number, string]>([
  ['andar', 'preterite', 0, 'anduve'], ['andar', 'preterite', 5, 'anduvieron'],
  ['andar', 'subjunctive_imperfect', 3, 'anduviéramos'],
  ['continuar', 'present', 0, 'continúo'], ['continuar', 'present', 3, 'continuamos'],
  ['continuar', 'subjunctive_present', 0, 'continúe'],
  ['actuar', 'present', 0, 'actúo'], ['actuar', 'imperative_affirmative', 1, 'actúa'],
  ['reunir', 'present', 0, 'reúno'], ['reunir', 'present', 1, 'reúnes'],
  ['reunir', 'present', 3, 'reunimos'], ['reunir', 'subjunctive_present', 3, 'reunamos'],
  ['acostar', 'present', 0, 'acuesto'], ['acostar', 'subjunctive_present', 0, 'acueste'],
  ['escoger', 'present', 0, 'escojo'], ['escoger', 'subjunctive_present', 0, 'escoja'],
  ['llenar', 'preterite', 5, 'llenaron'],
])('%s %s person %i is %s', (name, tense, person, expected) => {
  expect(conjugate(name, data[name], tense)[person].form).toBe(expected);
});
