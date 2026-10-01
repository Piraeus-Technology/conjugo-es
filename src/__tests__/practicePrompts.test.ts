import verbs from '../data/verbs.json';
import { generateQuestion } from '../utils/quizQuestion';
import {
  getCorePracticeEntries,
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
});
