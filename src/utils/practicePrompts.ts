import { conjugate, Tense, VerbData } from './conjugate';
import {
  COMMON_VERB_POOL_SIZE,
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

// Weighted random prompt selection shared by the quiz and flashcard screens:
// sample a handful of valid (verb, tense, person) candidates with a bias
// toward the common-verb pool, then keep the one the user struggles with
// most according to the spaced-repetition weights.
export function pickWeightedPrompt(
  verbEntries: [string, VerbData][],
  activeTenses: Tense[],
  getWeight: (verb: string, tense: Tense, personIndex: number) => number,
  includeVosotros: boolean = true,
): PromptCandidate {
  const commonCount = Math.min(COMMON_VERB_POOL_SIZE, verbEntries.length);
  const candidates: PromptCandidate[] = [];

  let attempts = 0;
  while (candidates.length < WEIGHTED_CANDIDATE_COUNT && attempts < 200) {
    attempts++;
    const idx = Math.random() < WEIGHTED_PICK_COMMON_BIAS
      ? Math.floor(Math.random() * commonCount)
      : Math.floor(Math.random() * verbEntries.length);
    const [verb, data] = verbEntries[idx];
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
