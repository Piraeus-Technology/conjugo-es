import { allTenses, conjugate, getBareInfinitive, reflexivePronouns, type VerbData } from './conjugate';

export interface ExampleMismatch {
  infinitive: string;
  example: string;
}

const clitics = ['me', 'te', 'se', 'nos', 'os', 'lo', 'la', 'los', 'las', 'le', 'les'];
const cliticEndings = [...clitics, ...clitics.flatMap(first => clitics.map(last => first + last))];

function words(text: string): string[] {
  return text.toLowerCase().match(/\p{L}+/gu) ?? [];
}

function withoutStressAccents(text: string): string {
  return text.replace(/[áéíóú]/g, vowel => ({ á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' })[vowel]!);
}

export function exampleContainsVerbForm(infinitive: string, data: VerbData, example: string): boolean {
  const sentenceWords = words(example);
  const sentence = ` ${sentenceWords.join(' ')} `;
  const forms = new Set([infinitive]);
  const bareInfinitive = getBareInfinitive(infinitive);
  const reflexive = bareInfinitive !== infinitive;
  const attachableForms = new Set([withoutStressAccents(bareInfinitive)]);
  for (const tense of allTenses) {
    for (const row of conjugate(infinitive, data, tense)) {
      if (row.disabled || row.form === '—' || (reflexive && row.pronoun === 'Past Participle')) continue;
      forms.add(row.form);
      row.alternateForms?.forEach(form => forms.add(form));
      if (reflexive && row.pronoun === 'Gerund') {
        attachableForms.add(withoutStressAccents(row.form.slice(0, -2)));
      } else if (!reflexive && (tense === 'imperative_affirmative' || tense === 'gerund_participle')) {
        attachableForms.add(withoutStressAccents(row.form));
      }
    }
  }
  if ([...forms].some(form => sentence.includes(` ${words(form).join(' ')} `))) return true;
  // An enclitic may shift the written accent. Match the whole remaining word.
  // Reflexive commands are matched above, so only infinitives and gerunds
  // are checked here for a different attached reflexive pronoun.
  const endings = reflexive ? reflexivePronouns : cliticEndings;
  return sentenceWords.some(word => endings.some(ending =>
    word.endsWith(ending) && attachableForms.has(withoutStressAccents(word.slice(0, -ending.length))),
  ));
}

// Exceptions name their exact sentence and explain why the dataset
// intentionally uses a form outside the reference table.
export const exampleExceptions: Record<string, string> = {
  // These passive/adjectival participles agree with feminine subjects; the
  // reference table exposes only the uninflected masculine participle.
  'hospitalizar::Fue hospitalizada durante una semana.': 'Feminine agreement of hospitalizado.',
  'destinar::Esa sala está destinada a reuniones.': 'Feminine agreement of destinado.',
};

export function auditExamples(verbs: Record<string, VerbData>): ExampleMismatch[] {
  return Object.entries(verbs).flatMap(([infinitive, data]) =>
    (data.examples ?? [])
      .filter(example => !exampleContainsVerbForm(infinitive, data, example)
        && !exampleExceptions[`${infinitive}::${example}`])
      .map(example => ({ infinitive, example })),
  );
}
