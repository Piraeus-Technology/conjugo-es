import { buildExampleSentence } from '../utils/exampleSentence';
import { conjugate, allTenses, VerbData } from '../utils/conjugate';
import verbs from '../data/verbs.json';

const data = verbs as Record<string, VerbData>;
const full = (p: ReturnType<typeof buildExampleSentence>) =>
  p ? `${p.before}${p.form}${p.after}` : null;

describe('buildExampleSentence', () => {
  it('builds a simple-tense sentence with the form and generic tail', () => {
    expect(full(buildExampleSentence('present', 0, 'consuelo', 'consolar')))
      .toBe('Yo consuelo mucho.');
    expect(full(buildExampleSentence('preterite', 5, 'consolaron', 'consolar')))
      .toBe('Ellos consolaron mucho.');
  });

  it('uses copula complements instead of the generic tail', () => {
    expect(full(buildExampleSentence('present', 0, 'soy', 'ser'))).toBe('Yo soy así.');
    expect(full(buildExampleSentence('present', 0, 'estoy', 'estar'))).toBe('Yo estoy bien.');
  });

  it('adds a lead-in for subjunctive tenses', () => {
    expect(full(buildExampleSentence('subjunctive_present', 0, 'consuele', 'consolar')))
      .toBe('Quizá yo consuele mucho.');
    expect(full(buildExampleSentence('subjunctive_imperfect', 1, 'consolaras', 'consolar')))
      .toBe('Ojalá tú consolaras mucho.');
  });

  it('renders imperatives as a capitalized command with no subject', () => {
    expect(full(buildExampleSentence('imperative_affirmative', 1, 'consuela', 'consolar')))
      .toBe('Consuela.');
    expect(full(buildExampleSentence('imperative_negative', 1, 'no consueles', 'consolar')))
      .toBe('No consueles.');
    expect(full(buildExampleSentence('imperative_affirmative', 1, 'sé', 'ser')))
      .toBe('Sé así.');
  });

  it('keeps compound and progressive forms intact', () => {
    expect(full(buildExampleSentence('present_perfect', 0, 'he consolado', 'consolar')))
      .toBe('Yo he consolado mucho.');
    expect(full(buildExampleSentence('present_progressive', 0, 'estoy consolando', 'consolar')))
      .toBe('Yo estoy consolando.');
  });

  it('returns null where no natural sentence applies', () => {
    expect(buildExampleSentence('gerund_participle', 0, 'consolando', 'consolar')).toBeNull();
    expect(buildExampleSentence('present', 0, 'he', 'haber')).toBeNull();
    expect(buildExampleSentence('imperative_affirmative', 0, '—', 'consolar')).toBeNull();
    expect(buildExampleSentence('present', 0, '', 'consolar')).toBeNull();
  });

  it('always embeds the exact drilled form across every reachable card', () => {
    const sample = ['ser', 'estar', 'ir', 'tener', 'hacer', 'consolar', 'comer', 'vivir', 'poder'];
    for (const inf of sample) {
      for (const t of allTenses) {
        const res = conjugate(inf, data[inf], t);
        res.forEach((r, i) => {
          const parts = buildExampleSentence(t, i, r.form, inf);
          if (parts) {
            // the bolded segment is exactly the conjugated form (case-adjusted)
            expect(parts.form.toLowerCase()).toBe(r.form.toLowerCase());
          }
        });
      }
    }
  });
});
