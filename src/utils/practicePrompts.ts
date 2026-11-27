import { conjugate, practiceTenses, Tense, VerbData } from './conjugate';
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

type PromptIdentity = Pick<PromptCandidate, 'verb' | 'tense' | 'personIndex'>;
type WeightForPrompt = (verb: string, tense: Tense, personIndex: number) => number;
type SkipPrompt = (verb: string, tense: Tense, personIndex: number) => boolean;
type PracticeEntries = [string, VerbData][];

export const MISSED_PROMPT_DELAY = 3;

export function createPracticeSession() {
  let answeredCount = 0;
  let missed: { prompt: PromptIdentity; due: number }[] = [];
  const isSamePrompt = (first: PromptIdentity, second: PromptIdentity) =>
    first.verb === second.verb && first.tense === second.tense && first.personIndex === second.personIndex;

  function prune(entries: PracticeEntries, tenses: Tense[], includeVosotros: boolean) {
    missed = missed.filter(({ prompt: { verb, tense, personIndex } }) => {
      if (!tenses.includes(tense) || (!includeVosotros && personIndex === 4)) return false;
      const entry = entries.find(([infinitive]) => infinitive === verb);
      return entry && getPracticeAnswer(verb, entry[1], tense, personIndex);
    });
  }

  return {
    prune,
    recordAnswer({ verb, tense, personIndex }: PromptIdentity, correct: boolean) {
      answeredCount += 1;
      const prompt = { verb, tense, personIndex };
      missed = missed.filter(retry => !isSamePrompt(retry.prompt, prompt));
      if (!correct) missed.push({ prompt, due: answeredCount + MISSED_PROMPT_DELAY - 1 });
    },
    next(entries: PracticeEntries, tenses: Tense[], getWeight: WeightForPrompt, includeVosotros: boolean, allowRetry = true) {
      if (allowRetry && missed[0]?.due <= answeredCount) {
        const { prompt } = missed[0];
        const data = entries.find(([verb]) => verb === prompt.verb)?.[1];
        const answer = data && getPracticeAnswer(prompt.verb, data, prompt.tense, prompt.personIndex);
        if (data && answer && tenses.includes(prompt.tense) && (includeVosotros || prompt.personIndex !== 4)) {
          return { ...prompt, data, answer };
        }
      }
      const skip: SkipPrompt | undefined = missed.length === 0 ? undefined : (verb, tense, personIndex) =>
        missed.some(({ prompt }) => isSamePrompt(prompt, { verb, tense, personIndex }));
      return pickWeightedPrompt(entries, tenses, getWeight, includeVosotros, skip);
    },
  };
}

export function practiceSelectionKey(tenses: Tense[], levels: readonly string[], includeVosotros: boolean): string {
  return JSON.stringify([[...tenses].sort(), [...levels].sort(), includeVosotros]);
}

const corePracticeVerbSet = new Set<string>(CORE_PRACTICE_VERBS);

export function getPracticeAnswer(
  verb: string, data: VerbData, tense: Tense, personIndex: number,
): string | undefined {
  return getPracticeForms(verb, data, tense)[personIndex]?.form;
}

export function getPracticeForms(verb: string, data: VerbData, tense: Tense) {
  if (data.pronominalOnly || !practiceTenses.includes(tense)
    || (data.practiceTenses && !data.practiceTenses.includes(tense))) return [];
  return conjugate(verb, data, tense).map(result =>
    result.disabled || result.form === '—' ? undefined : result,
  );
}

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
// Keep the existing curated-core distribution for beginner-only selections.
// Otherwise sample a level uniformly before sampling a verb so dataset size
// and the beginner core cannot drown out higher levels. Difficulty weights
// still choose among the sampled candidates.
export function pickWeightedPrompt(
  entries: [string, VerbData][],
  activeTenses: Tense[],
  getWeight: WeightForPrompt,
  includeVosotros: boolean = true,
  skip?: SkipPrompt,
): PromptCandidate {
  const verbEntries = entries.filter(([, data]) => !data.pronominalOnly);
  const coreEntries = getCorePracticeEntries(verbEntries);
  const beginnerOnly = verbEntries.every(([, data]) => data.level === 'A1' || data.level === 'A2');
  const byLevel = new Map<VerbData['level'], [string, VerbData][]>();
  if (!beginnerOnly) {
    for (const entry of verbEntries) {
      const group = byLevel.get(entry[1].level) ?? [];
      group.push(entry);
      byLevel.set(entry[1].level, group);
    }
  }
  const levelPools = [...byLevel.values()];
  const candidates: PromptCandidate[] = [];

  let attempts = 0;
  while (verbEntries.length > 0 && activeTenses.length > 0
    && candidates.length < WEIGHTED_CANDIDATE_COUNT && attempts < 200) {
    attempts++;
    const source = beginnerOnly
      ? (Math.random() < WEIGHTED_PICK_COMMON_BIAS ? coreEntries : verbEntries)
      : levelPools[Math.floor(Math.random() * levelPools.length)];
    const [verb, data] = source[Math.floor(Math.random() * source.length)];
    const tense = activeTenses[Math.floor(Math.random() * activeTenses.length)];
    const validPersons = getPracticeForms(verb, data, tense).flatMap((result, index) =>
      result && (includeVosotros || index !== 4) && !skip?.(verb, tense, index)
        ? [{ index, form: result.form }] : [],
    );

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
        const results = getPracticeForms(verb, data, tense);
        const idx = results.findIndex(
          (result, i) => result && (includeVosotros || i !== 4) && !skip?.(verb, tense, i),
        );
        if (idx !== -1) {
          return { verb, data, tense, personIndex: idx, answer: results[idx]!.form };
        }
      }
    }
    if (skip) return pickWeightedPrompt(entries, activeTenses, getWeight, includeVosotros);
    throw new Error('No conjugable prompts for the current practice settings');
  }

  return candidates.reduce((best, candidate) =>
    getWeight(candidate.verb, candidate.tense, candidate.personIndex) >
      getWeight(best.verb, best.tense, best.personIndex)
      ? candidate
      : best
  );
}
