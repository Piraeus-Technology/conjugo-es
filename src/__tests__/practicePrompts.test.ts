import verbs from '../data/verbs.json';
import { generateQuestion, isCorrectAnswer } from '../utils/quizQuestion';
import {
  createPracticeSession,
  getCorePracticeEntries,
  getPracticeAnswer,
  MISSED_PROMPT_DELAY,
  pickWeightedPrompt,
} from '../utils/practicePrompts';
import { allTenses, practiceTenses, type Tense, type VerbData } from '../utils/conjugate';

const allVerbEntries = Object.entries(verbs as Record<string, VerbData>);
const flatWeight = () => 1;

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe('practice prompt selection', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('beginner-only prompts retain the curated A1/A2 distribution', () => {
    jest.spyOn(Math, 'random').mockImplementation(seededRandom(0xC0FFEE));
    const beginnerEntries = allVerbEntries.filter(([, data]) => data.level === 'A1' || data.level === 'A2');
    const coreEntries = getCorePracticeEntries(beginnerEntries);

    expect(coreEntries.map(([verb]) => verb)).toEqual(
      expect.arrayContaining(['hablar', 'comer', 'vivir']),
    );
    expect(coreEntries.every(([, data]) => data.level === 'A1' || data.level === 'A2')).toBe(true);

    const counts = new Map<string, number>();
    let corePrompts = 0;
    let a1Prompts = 0;
    const sampleSize = 3000;

    for (let index = 0; index < sampleSize; index += 1) {
      const prompt = pickWeightedPrompt(
        beginnerEntries,
        ['present'],
        flatWeight,
      );
      counts.set(prompt.verb, (counts.get(prompt.verb) ?? 0) + 1);
      if (coreEntries.some(([verb]) => verb === prompt.verb)) corePrompts++;
      if (prompt.data.level === 'A1') a1Prompts++;
    }

    expect(corePrompts / sampleSize).toBeGreaterThan(0.75);
    expect(a1Prompts / sampleSize).toBeGreaterThan(0.79);
    expect(a1Prompts / sampleSize).toBeLessThan(0.87);
    for (const foundationalVerb of ['hablar', 'comer', 'vivir']) {
      expect(counts.get(foundationalVerb) ?? 0).toBeGreaterThanOrEqual(10);
    }
  });

  test.each([
    ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
    ['B1', 'B2', 'C1', 'C2'],
  ])('neutral prompts balance selected levels (%s...)', (...levels) => {
    jest.spyOn(Math, 'random').mockImplementation(seededRandom(0xC0FFEE));
    const pool = allVerbEntries.filter(([, data]) => levels.includes(data.level!));
    const counts = new Map<string, number>();
    for (let i = 0; i < 6000; i++) {
      const prompt = pickWeightedPrompt(pool, ['present', 'preterite'], flatWeight);
      counts.set(prompt.data.level!, (counts.get(prompt.data.level!) ?? 0) + 1);
    }
    for (const level of levels) {
      expect((counts.get(level) ?? 0) / 6000).toBeGreaterThan(0.12);
      expect((counts.get(level) ?? 0) / 6000).toBeLessThan(0.30);
    }
  });

  test('vosotros is excluded from both prompts and answer options when disabled', () => {
    jest.spyOn(Math, 'random').mockImplementation(seededRandom(0xBADA55));
    const hablar: VerbData = {
      type: 'ar',
      regular: true,
      translation: 'to speak',
      level: 'A1',
    };

    for (let index = 0; index < 100; index += 1) {
      const question = generateQuestion(
        ['present'] satisfies Tense[],
        flatWeight,
        [['hablar', hablar]],
        false,
      );

      expect(question.personIndex).not.toBe(4);
      expect(question.options).not.toContain('habláis');
    }
  });

  test('impersonal verbs only produce third-person singular prompts', () => {
    jest.spyOn(Math, 'random').mockImplementation(seededRandom(0x1A2B3C));
    const llover = (verbs as Record<string, VerbData>).llover;

    for (let index = 0; index < 25; index += 1) {
      const prompt = pickWeightedPrompt(
        [['llover', llover]],
        ['present', 'preterite'],
        flatWeight,
      );
      expect(prompt.personIndex).toBe(2);
    }
  });

  test('includes reflexive imperatives and skips tenses no longer taught', () => {
    jest.spyOn(Math, 'random').mockImplementation(seededRandom(0xA3));
    const pool = allVerbEntries.filter(([verb]) =>
      ['quejarse', 'atreverse', 'desvivirse', 'adentrarse', 'haber', 'soler', 'hablar'].includes(verb),
    );
    const verbsPicked = new Set(Array.from({ length: 50 }, () =>
      pickWeightedPrompt(pool, ['imperative_affirmative', 'imperative_negative'], flatWeight).verb,
    ));
    expect(verbsPicked).toEqual(new Set(['quejarse', 'atreverse', 'desvivirse', 'adentrarse', 'hablar']));
  });

  test('reflexive command distractors match the answer shape and exclude alternate correct forms', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.65);
    const irse = allVerbEntries.find(([verb]) => verb === 'irse')!;
    const question = generateQuestion(['imperative_affirmative', ...practiceTenses.filter(tense =>
      tense !== 'imperative_affirmative')], flatWeight, [irse], true, {
      ...createPracticeSession(),
      next: () => ({ verb: 'irse', data: irse[1], tense: 'imperative_affirmative', personIndex: 3, answer: 'vámonos' }),
    });
    expect(question.options).toHaveLength(4);
    expect(question.options).toContain('vámonos');
    expect(question.options).not.toContain('vayámonos');
    expect(question.options).not.toContain('vamos');
    expect(question.options.every(option => !option.includes(' '))).toBe(true);
    expect(isCorrectAnswer(question, 'vayámonos')).toBe(true);
    expect(isCorrectAnswer(question, 'vamos')).toBe(false);
  });

  test('a missed prompt returns after two other answers despite settings redraws', () => {
    jest.spyOn(Math, 'random').mockImplementation(seededRandom(223));
    const session = createPracticeSession();
    const next = (allowRetry = true) => session.next(allVerbEntries, ['present', 'preterite'], flatWeight, true, allowRetry);
    const missed = next();
    session.recordAnswer(missed, false);
    for (let index = 0; index < 5; index += 1) expect(next(false)).not.toEqual(missed);
    for (let index = 1; index < MISSED_PROMPT_DELAY; index += 1) {
      const prompt = next();
      expect(prompt).not.toEqual(missed);
      session.recordAnswer(prompt, true);
    }
    expect(next(false)).not.toEqual(missed);
    expect(next()).toEqual(missed);
    expect(next()).toEqual(missed);
    session.recordAnswer(missed, true);
    expect(next()).not.toEqual(missed);
  });

  test('limits soler practice to frequently used forms', () => {
    const soler = (verbs as Record<string, VerbData>).soler;
    expect(allTenses.filter(tense => getPracticeAnswer('soler', soler, tense, 0))).toEqual([
      'present', 'imperfect', 'subjunctive_present', 'subjunctive_imperfect', 'present_perfect',
    ]);
  });

  test.each([
    ['subjunctive_present_perfect', 'haya muerto'],
    ['subjunctive_past_perfect', 'hubiera muerto'],
  ] as const)('%s supports flashcard prompts and four quiz options', (tense, answer) => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const entries = allVerbEntries.filter(([verb]) => verb === 'morir');
    const session = createPracticeSession();
    expect(session.next(entries, [tense], flatWeight, true)).toMatchObject({
      verb: 'morir', tense, personIndex: 0, answer,
    });
    const question = generateQuestion([tense], flatWeight, entries);
    expect(question).toMatchObject({ verb: 'morir', tense, personIndex: 0, correctAnswer: answer });
    expect(new Set(question.options).size).toBe(4);
    expect(question.options).toContain(answer);
    expect(question.options.every(option => option.endsWith(' muerto'))).toBe(true);
  });

  test('a settings change drops queued prompts that are no longer eligible', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const session = createPracticeSession();
    const entries = allVerbEntries.filter(([verb]) => verb === 'hablar');
    const missed = { verb: 'hablar', tense: 'present', personIndex: 4 } as const;
    session.recordAnswer(missed, false);
    session.prune(entries, ['present'], false);
    session.recordAnswer(session.next(entries, ['present'], flatWeight, true), true);
    session.recordAnswer(session.next(entries, ['present'], flatWeight, true), true);
    expect(session.next(entries, ['present'], flatWeight, true).personIndex).toBe(0);
  });

  test('negative imperative and bare options are never mixed', () => {
    jest.spyOn(Math, 'random').mockImplementation(seededRandom(0xB4));
    for (let index = 0; index < 100; index += 1) {
      const question = generateQuestion(['present', 'imperative_negative'], flatWeight, allVerbEntries);
      expect(question.options).toHaveLength(4);
      expect(question.options.every(option => option.startsWith('no ') === question.correctAnswer.startsWith('no '))).toBe(true);
    }
  });
});
