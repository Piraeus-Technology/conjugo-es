import verbs from '../data/verbs.json';
import { generateQuestion } from '../utils/quizQuestion';
import {
  createPracticeSession,
  getCorePracticeEntries,
  MISSED_PROMPT_DELAY,
  pickWeightedPrompt,
} from '../utils/practicePrompts';
import type { Tense, VerbData } from '../utils/conjugate';

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

  test('skips pronominal-only entries and tenses no longer taught', () => {
    jest.spyOn(Math, 'random').mockImplementation(seededRandom(0xA3));
    const pool = allVerbEntries.filter(([verb]) =>
      ['quejar', 'atrever', 'desvivir', 'adentrar', 'haber', 'soler', 'hablar'].includes(verb),
    );
    for (let index = 0; index < 50; index += 1) {
      const prompt = pickWeightedPrompt(pool, ['imperative_affirmative', 'imperative_negative'], flatWeight);
      expect(prompt.verb).toBe('hablar');
    }
  });

  test('a missed prompt returns on the third draw in its own session', () => {
    jest.spyOn(Math, 'random').mockImplementation(seededRandom(223));
    const session = createPracticeSession();
    const next = () => session.next(allVerbEntries, ['present', 'preterite'], flatWeight, true);
    const missed = next();
    session.recordMiss(missed);
    for (let index = 1; index < MISSED_PROMPT_DELAY; index += 1) {
      expect(next()).not.toEqual(missed);
    }
    expect(next()).toEqual(missed);
  });

  test('a settings change drops queued prompts that are no longer eligible', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const session = createPracticeSession();
    const entries = allVerbEntries.filter(([verb]) => verb === 'hablar');
    const missed = { verb: 'hablar', tense: 'present', personIndex: 4 } as const;
    session.recordMiss(missed);
    session.prune(entries, ['present'], false);
    session.next(entries, ['present'], flatWeight, true);
    session.next(entries, ['present'], flatWeight, true);
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
