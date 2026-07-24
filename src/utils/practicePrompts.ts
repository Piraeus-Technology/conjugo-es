import { conjugate, Tense, VerbData } from './conjugate';
import {
  CORE_PRACTICE_VERBS,
  WEIGHTED_CANDIDATE_COUNT,
  WEIGHTED_PICK_COMMON_BIAS,
} from './constants';

export interface PromptCandidate {
  verb: string;
  data: VerbData;
  tense: Tense;
  personIndex: number;
  answer: string;
}

const corePracticeVerbSet = new Set<string>(CORE_PRACTICE_VERBS);

export function getCorePracticeEntries(
  verbEntries: [string, VerbData][],
): [string, VerbData][] {
  const curatedBeginners = verbEntries.filter(
    ([verb, data]) =>
      corePracticeVerbSet.has(verb) && (data.level === 'A1' || data.level === 'A2'),
  );

  if (curatedBeginners.length > 0) return curatedBeginners;

  // A custom data set may not contain the curated core. Preserve the intended
  // beginner bias where possible, then fall back to the caller's full pool.
  const beginnerEntries = verbEntries.filter(
    ([, data]) => data.level === 'A1' || data.level === 'A2',
  );
  return beginnerEntries.length > 0 ? beginnerEntries : verbEntries;
}

// Weighted random prompt selection shared by the quiz and flashcard screens:
// sample a handful of valid (verb, tense, person) candidates with a bias
// toward a curated beginner core, then keep the one the user struggles with
// most according to the spaced-repetition weights.
export function pickWeightedPrompt(
  verbEntries: [string, VerbData][],
  activeTenses: Tense[],
  getWeight: (verb: string, tense: Tense, personIndex: number) => number,
  includeVosotros: boolean = true,
): PromptCandidate {
  const coreEntries = getCorePracticeEntries(verbEntries);
  const candidates: PromptCandidate[] = [];

  let attempts = 0;
  while (candidates.length < WEIGHTED_CANDIDATE_COUNT && attempts < 200) {
    attempts++;
    const source = Math.random() < WEIGHTED_PICK_COMMON_BIAS
      ? coreEntries
      : verbEntries;
    const [verb, data] = source[Math.floor(Math.random() * source.length)];
    const tense = activeTenses[Math.floor(Math.random() * activeTenses.length)];
    const results = conjugate(verb, data, tense);
    const validPersons = results
      .map((r, i) => ({ index: i, ...r }))
      .filter(r => !r.disabled && r.form !== '—' && (includeVosotros || r.index !== 4));

    if (validPersons.length === 0) continue;

    const picked = validPersons[Math.floor(Math.random() * validPersons.length)];
    candidates.push({
      verb,
      data,
      tense,
      personIndex: picked.index,
      answer: picked.form,
    });
  }

  if (candidates.length === 0) {
    // Degenerate settings/data: scan deterministically for any valid prompt
    // instead of crashing in the reduce below.
    for (const [verb, data] of verbEntries) {
      for (const tense of activeTenses) {
        const results = conjugate(verb, data, tense);
        const idx = results.findIndex(
          (r, i) => !r.disabled && r.form !== '—' && (includeVosotros || i !== 4),
        );
        if (idx !== -1) {
          return { verb, data, tense, personIndex: idx, answer: results[idx].form };
        }
      }
    }
    throw new Error('No conjugable prompts for the current practice settings');
  }

  return candidates.reduce((best, candidate) =>
    getWeight(candidate.verb, candidate.tense, candidate.personIndex) >
      getWeight(best.verb, best.tense, best.personIndex)
      ? candidate
      : best
  );
}
