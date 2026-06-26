import { Tense } from './conjugate';

// Subject pronouns by person index (0..5). One representative gender is used
// for the 3rd-person rows so the sentence reads as a concrete example.
const subjects = ['Yo', 'Tú', 'Él', 'Nosotros', 'Vosotros', 'Ellos'];
const subjectsLower = ['yo', 'tú', 'él', 'nosotros', 'vosotros', 'ellos'];

// Copulas read as incomplete with the generic tail ("Yo soy mucho" is wrong),
// so they get a fixed, person- and number-invariant complement instead.
const complements: Record<string, string> = {
  ser: 'así',
  estar: 'bien',
};

// Verbs we never build a generated sentence for: `haber` only works as an
// auxiliary, so a standalone clause around its bare form is ungrammatical.
const skipVerbs = new Set(['haber']);

// Generic, broadly verb-agnostic tail that keeps an otherwise bare transitive
// from feeling truncated ("Yo consuelo mucho", "Ellos comen mucho").
const GENERIC_TAIL = 'mucho';

export interface ExampleParts {
  before: string; // text before the conjugated form (may be empty)
  form: string;   // the exact conjugated form, rendered in bold
  after: string;  // text after the form, including any tail and the period
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * Build a short example sentence that uses the card's exact conjugated form,
 * so the example always reinforces the form being drilled. Returns the sentence
 * split around the form (for bolding), or null when no natural sentence applies
 * (the Gerund & Participle reference forms, `haber`, or a missing form).
 */
export function buildExampleSentence(
  tense: Tense,
  personIndex: number,
  form: string,
  infinitive: string,
): ExampleParts | null {
  if (!form || form === '—') return null;
  if (tense === 'gerund_participle') return null;
  if (skipVerbs.has(infinitive)) return null;

  const complement = complements[infinitive];

  // Imperatives: a command, no subject. Negative forms already include "no ".
  if (tense === 'imperative_affirmative' || tense === 'imperative_negative') {
    const suffix = complement ? ` ${complement}.` : '.';
    return { before: '', form: capitalize(form), after: suffix };
  }

  const subject = subjects[personIndex] ?? 'Yo';
  const subjectLower = subjectsLower[personIndex] ?? 'yo';

  // Progressives carry their own meaning; a generic tail reads oddly, so stay
  // bare except for copulas, which still need their complement.
  if (tense === 'present_progressive' || tense === 'past_progressive') {
    return { before: `${subject} `, form, after: complement ? ` ${complement}.` : '.' };
  }

  const tail = complement ?? GENERIC_TAIL;

  // Subjunctives are not standalone; a "Quizá …" / "Ojalá …" lead-in makes a
  // complete, natural clause for any person.
  if (tense === 'subjunctive_present') {
    return { before: `Quizá ${subjectLower} `, form, after: ` ${tail}.` };
  }
  if (tense === 'subjunctive_imperfect') {
    return { before: `Ojalá ${subjectLower} `, form, after: ` ${tail}.` };
  }

  // Simple indicative tenses and the four perfect (compound) tenses.
  return { before: `${subject} `, form, after: ` ${tail}.` };
}
