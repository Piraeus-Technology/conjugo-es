import verbs from '../data/verbs.json';
import { getBareInfinitive, type Tense, type VerbData } from './conjugate';
import { getPracticeAnswer, getPracticeForms, pickWeightedPrompt, type createPracticeSession } from './practicePrompts';

const allVerbEntries = Object.entries(verbs as Record<string, VerbData>);

export interface Question {
  verb: string;
  translation: string;
  tense: Tense;
  personIndex: number;
  correctAnswer: string;
  alternateAnswers?: string[];
  options: string[];
}

export function isCorrectAnswer(question: Question, answer: string): boolean {
  return answer === question.correctAnswer || question.alternateAnswers?.includes(answer) === true;
}

export function generateQuestion(
  activeTenses: Tense[],
  getWeight: (verb: string, tense: Tense, personIndex: number) => number,
  filteredEntries: [string, VerbData][],
  includeVosotros: boolean = true,
  session?: ReturnType<typeof createPracticeSession>,
  allowRetry = true,
): Question {
  const verbEntries = filteredEntries.length > 0 ? filteredEntries : allVerbEntries;
  const prompt = session
    ? session.next(verbEntries, activeTenses, getWeight, includeVosotros, allowRetry)
    : pickWeightedPrompt(verbEntries, activeTenses, getWeight, includeVosotros);
  const { verb, data, tense, personIndex } = prompt;
  const correctAnswer = prompt.answer;
  const results = getPracticeForms(verb, data, tense);
  const alternateAnswers = results[personIndex]?.alternateForms;
  const wordCount = correctAnswer.split(' ').length;
  const negative = correctAnswer.startsWith('no ');
  const reflexive = getBareInfinitive(verb) !== verb;
  const isDistractor = (form: string) =>
    form !== correctAnswer && !alternateAnswers?.includes(form)
    && form.startsWith('no ') === negative && form.split(' ').length === wordCount;

  // Generate wrong answers — prioritize hard distractors.
  const sameVerbSameTense: string[] = [];
  results.forEach((result, index) => {
    if (
      result && index !== personIndex
      && (includeVosotros || index !== 4)
      && isDistractor(result.form)
      && !sameVerbSameTense.includes(result.form)
    ) {
      sameVerbSameTense.push(result.form);
    }
  });

  const sameVerbDiffTense: string[] = [];
  for (const otherTense of activeTenses) {
    if (otherTense === tense) continue;
    const form = getPracticeAnswer(verb, data, otherTense, personIndex);
    if (
      form
      && isDistractor(form)
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

  const addDistractorFrom = ([otherVerb, otherData]: [string, VerbData]) => {
    if ((getBareInfinitive(otherVerb) !== otherVerb) !== reflexive) return;
    const form = getPracticeAnswer(otherVerb, otherData, tense, personIndex);
    if (form && isDistractor(form) && !selected.includes(form)) selected.push(form);
  };
  let fallbackAttempts = 0;
  while (selected.length < 3 && fallbackAttempts < 200) {
    fallbackAttempts += 1;
    addDistractorFrom(verbEntries[Math.floor(Math.random() * verbEntries.length)]);
  }
  if (selected.length < 3) {
    // Small or restricted pools can run out of options with the right shape.
    for (const entry of allVerbEntries) {
      addDistractorFrom(entry);
      if (selected.length === 3) break;
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
    ...(alternateAnswers && { alternateAnswers }),
    options,
  };
}
