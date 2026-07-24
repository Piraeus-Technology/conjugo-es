import verbs from '../data/verbs.json';
import { conjugate, type Tense, type VerbData } from './conjugate';
import { pickWeightedPrompt } from './practicePrompts';

const allVerbEntries = Object.entries(verbs as Record<string, VerbData>);

export interface Question {
  verb: string;
  translation: string;
  tense: Tense;
  personIndex: number;
  correctAnswer: string;
  options: string[];
}

export function generateQuestion(
  activeTenses: Tense[],
  getWeight: (verb: string, tense: Tense, personIndex: number) => number,
  filteredEntries: [string, VerbData][],
  includeVosotros: boolean = true,
): Question {
  const verbEntries = filteredEntries.length > 0 ? filteredEntries : allVerbEntries;
  const prompt = pickWeightedPrompt(verbEntries, activeTenses, getWeight, includeVosotros);
  const { verb, data, tense, personIndex } = prompt;
  const correctAnswer = prompt.answer;
  const results = conjugate(verb, data, tense);

  // Generate wrong answers — prioritize hard distractors.
  const sameVerbSameTense: string[] = [];
  results.forEach((result, index) => {
    if (
      index !== personIndex
      && (includeVosotros || index !== 4)
      && result.form !== '—'
      && !result.disabled
      && result.form !== correctAnswer
      && !sameVerbSameTense.includes(result.form)
    ) {
      sameVerbSameTense.push(result.form);
    }
  });

  const sameVerbDiffTense: string[] = [];
  for (const otherTense of activeTenses) {
    if (otherTense === tense) continue;
    const otherResults = conjugate(verb, data, otherTense);
    const form = otherResults[personIndex].form;
    if (
      form !== '—'
      && !otherResults[personIndex].disabled
      && form !== correctAnswer
      && !sameVerbSameTense.includes(form)
      && !sameVerbDiffTense.includes(form)
    ) {
      sameVerbDiffTense.push(form);
    }
  }

  for (let index = sameVerbSameTense.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [sameVerbSameTense[index], sameVerbSameTense[swapIndex]] =
      [sameVerbSameTense[swapIndex], sameVerbSameTense[index]];
  }
  for (let index = sameVerbDiffTense.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [sameVerbDiffTense[index], sameVerbDiffTense[swapIndex]] =
      [sameVerbDiffTense[swapIndex], sameVerbDiffTense[index]];
  }

  const selected: string[] = [];
  if (sameVerbSameTense.length > 0 && sameVerbDiffTense.length > 0) {
    selected.push(sameVerbSameTense.shift()!);
    selected.push(sameVerbDiffTense.shift()!);
    const remaining = [...sameVerbSameTense, ...sameVerbDiffTense];
    if (remaining.length > 0) {
      selected.push(remaining[Math.floor(Math.random() * remaining.length)]);
    }
  } else {
    const pool = sameVerbSameTense.length > 0 ? sameVerbSameTense : sameVerbDiffTense;
    while (selected.length < 3 && pool.length > 0) {
      selected.push(pool.shift()!);
    }
  }

  let fallbackAttempts = 0;
  while (selected.length < 3 && fallbackAttempts < 200) {
    fallbackAttempts += 1;
    const [otherVerb, otherData] = verbEntries[Math.floor(Math.random() * verbEntries.length)];
    const otherResults = conjugate(otherVerb, otherData, tense);
    const form = otherResults[personIndex].form;
    if (form !== correctAnswer && form !== '—' && !selected.includes(form)) {
      selected.push(form);
    }
  }

  const options = [correctAnswer, ...selected];
  for (let index = options.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [options[index], options[swapIndex]] = [options[swapIndex], options[index]];
  }

  return {
    verb,
    translation: data.translation,
    tense,
    personIndex,
    correctAnswer,
    options,
  };
}
