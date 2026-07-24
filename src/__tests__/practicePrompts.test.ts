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

  test('default prompts favor curated A1/A2 verbs without relying on JSON order', () => {
    jest.spyOn(Math, 'random').mockImplementation(seededRandom(0xC0FFEE));
    const coreEntries = getCorePracticeEntries(allVerbEntries);

    expect(coreEntries.map(([verb]) => verb)).toEqual(
      expect.arrayContaining(['hablar', 'comer', 'vivir']),
    );
    expect(coreEntries.every(([, data]) => data.level === 'A1' || data.level === 'A2')).toBe(true);

    const counts = new Map<string, number>();
    let beginnerPrompts = 0;
    const sampleSize = 3000;

    for (let index = 0; index < sampleSize; index += 1) {
      const prompt = pickWeightedPrompt(
        allVerbEntries,
        ['present'],
        flatWeight,
      );
      counts.set(prompt.verb, (counts.get(prompt.verb) ?? 0) + 1);
      if (prompt.data.level === 'A1' || prompt.data.level === 'A2') {
        beginnerPrompts += 1;
      }
    }

    expect(beginnerPrompts / sampleSize).toBeGreaterThan(0.65);
    for (const foundationalVerb of ['hablar', 'comer', 'vivir']) {
      expect(counts.get(foundationalVerb) ?? 0).toBeGreaterThanOrEqual(10);
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
