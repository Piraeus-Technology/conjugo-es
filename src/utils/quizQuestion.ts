import verbs from '../data/verbs.json';
import {
  attachReflexivePronoun, conjugate, getBareInfinitive, getBareVerbData, practiceTenses, reflexivePronouns,
  type Tense, type VerbData,
} from './conjugate';
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

function shuffle(options: string[]) {
  for (let index = options.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [options[index], options[swapIndex]] = [options[swapIndex], options[index]];
  }
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
  const bare = getBareInfinitive(verb);
  const reflexive = bare !== verb;
  const isDistractor = (form: string) =>
    form !== correctAnswer && !alternateAnswers?.includes(form)
    && form.startsWith('no ') === negative && form.split(' ').length === wordCount;

  const commandDistractors: string[] = [];
  if (reflexive && tense === 'imperative_affirmative') {
    const pronoun = reflexivePronouns[personIndex];
    const [gerund] = conjugate(bare, getBareVerbData(data), 'gerund_participle');
    commandDistractors.push(attachReflexivePronoun(bare, pronoun), attachReflexivePronoun(gerund.form, pronoun));
  } else if (reflexive && tense === 'imperative_negative') {
    for (const indicative of ['present', 'imperfect'] as const) {
      const row = conjugate(verb, data, indicative)[personIndex];
      if (!row.disabled) commandDistractors.push(`no ${row.form}`);
    }
  }
  // Reserve one same-pronoun option before drawing from the regular pools.
  const samePronoun = commandDistractors.filter(isDistractor);
  if (tense === 'imperative_affirmative') shuffle(samePronoun);
  const selected = samePronoun.slice(0, 1);

  // Balance wrong answers from the same tense and the same person.
  const sameVerbSameTense: string[] = [];
  results.forEach((result, index) => {
    if (
      result && index !== personIndex
      && (includeVosotros || index !== 4)
      && isDistractor(result.form)
      && !selected.includes(result.form)
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
      && !selected.includes(form)
      && !sameVerbSameTense.includes(form)
      && !sameVerbDiffTense.includes(form)
    ) {
      sameVerbDiffTense.push(form);
    }
  }

  shuffle(sameVerbSameTense);
  shuffle(sameVerbDiffTense);
  if (sameVerbSameTense.length > 0 && sameVerbDiffTense.length > 0) {
    selected.push(sameVerbSameTense.shift()!);
    selected.push(sameVerbDiffTense.shift()!);
  }
  const remaining = [...sameVerbSameTense, ...sameVerbDiffTense];
  while (selected.length < 3 && remaining.length > 0) {
    selected.push(...remaining.splice(Math.floor(Math.random() * remaining.length), 1));
  }

  const addDistractor = (form: string) => {
    if (selected.length < 3 && isDistractor(form) && !selected.includes(form)) selected.push(form);
  };
  samePronoun.forEach(addDistractor);
  if (selected.length < 3) {
    const otherTenses = [...new Set([...activeTenses, ...practiceTenses])].filter(otherTense => otherTense !== tense);
    for (const otherTense of otherTenses) {
      const rows = conjugate(verb, data, otherTense);
      const samePerson = rows[personIndex];
      if (samePerson && !samePerson.disabled) addDistractor(samePerson.form);
      rows.forEach((row, index) => {
        if (!row.disabled && row.form !== '—' && (includeVosotros || index !== 4)) addDistractor(row.form);
      });
      if (selected.length === 3) break;
    }
  }

  const addDistractorFrom = ([otherVerb, otherData]: [string, VerbData]) => {
    if ((getBareInfinitive(otherVerb) !== otherVerb) !== reflexive) return;
    const form = getPracticeAnswer(otherVerb, otherData, tense, personIndex);
    if (form) addDistractor(form);
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
  shuffle(options);

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
