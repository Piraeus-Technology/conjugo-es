import AsyncStorage from '@react-native-async-storage/async-storage';
import { __resetQuizStoreForTests, useQuizStore } from '../store/quizStore';
import {
  __resetSpacedRepStoreForTests,
  buildPromptKey,
  parseStoredWeights,
  useSpacedRepStore,
} from '../store/spacedRepStore';

const mockStorage = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage.get(key) ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    mockStorage.set(key, value);
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    mockStorage.delete(key);
    return Promise.resolve();
  }),
}));

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('quiz and spaced repetition store persistence', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockStorage.clear();
    jest.clearAllMocks();
    __resetQuizStoreForTests();
    __resetSpacedRepStoreForTests();
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  test('quiz answer waits for an in-flight initial load and preserves loaded totals', async () => {
    const load = deferred<string | null>();
    jest.mocked(AsyncStorage.getItem).mockImplementationOnce(() => load.promise);

    const loadPromise = useQuizStore.getState().loadStats();
    const recordPromise = useQuizStore.getState().recordAnswer(true, 2);

    load.resolve(JSON.stringify({ totalQuestions: 5, totalCorrect: 4, bestStreak: 3 }));
    await Promise.all([loadPromise, recordPromise]);

    expect(useQuizStore.getState()).toMatchObject({
      totalQuestions: 6,
      totalCorrect: 5,
      bestStreak: 3,
      loaded: true,
    });
    expect(JSON.parse(mockStorage.get('quiz_stats')!)).toEqual({
      totalQuestions: 6,
      totalCorrect: 5,
      bestStreak: 3,
    });
  });

  test('quiz answer leaves disk and state untouched when persistence fails', async () => {
    useQuizStore.setState({ totalQuestions: 5, totalCorrect: 4, bestStreak: 3, loaded: true });
    mockStorage.set('quiz_stats', JSON.stringify({ totalQuestions: 5, totalCorrect: 4, bestStreak: 3 }));
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk full'));

    // Non-throwing on persist failure: caller's optimistic UI stays as-is,
    // and the global store stays aligned with what's actually on disk.
    await expect(useQuizStore.getState().recordAnswer(false, 0)).resolves.toBeUndefined();

    expect(useQuizStore.getState()).toMatchObject({
      totalQuestions: 5,
      totalCorrect: 4,
      bestStreak: 3,
      loaded: true,
    });
    expect(JSON.parse(mockStorage.get('quiz_stats')!)).toEqual({
      totalQuestions: 5,
      totalCorrect: 4,
      bestStreak: 3,
    });
  });

  test('quiz reset leaves state intact when deletion fails', async () => {
    useQuizStore.setState({
      totalQuestions: 5,
      totalCorrect: 4,
      bestStreak: 3,
      loaded: true,
    });
    mockStorage.set(
      'quiz_stats',
      JSON.stringify({ totalQuestions: 5, totalCorrect: 4, bestStreak: 3 }),
    );
    jest.mocked(AsyncStorage.removeItem).mockRejectedValueOnce(new Error('disk locked'));

    await expect(useQuizStore.getState().resetStats()).resolves.toBe(false);

    expect(useQuizStore.getState()).toMatchObject({
      totalQuestions: 5,
      totalCorrect: 4,
      bestStreak: 3,
    });
    expect(mockStorage.has('quiz_stats')).toBe(true);
  });

  test.each([
    ['malformed JSON', '{not-json'],
    ['right JSON with the wrong shape', JSON.stringify({ totalQuestions: 'many' })],
  ])('quiz store recovers its key from %s', async (_label, stored) => {
    mockStorage.set('quiz_stats', stored);

    await useQuizStore.getState().loadStats();

    expect(useQuizStore.getState()).toMatchObject({
      totalQuestions: 0,
      totalCorrect: 0,
      bestStreak: 0,
      loaded: true,
      loadError: false,
    });
    expect(mockStorage.has('quiz_stats')).toBe(false);
  });

  test('quiz answer refuses to write when initial load failed, preserving disk', async () => {
    mockStorage.set('quiz_stats', JSON.stringify({ totalQuestions: 100, totalCorrect: 80, bestStreak: 12 }));
    jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('disk locked'));

    await useQuizStore.getState().recordAnswer(true, 1);

    // Disk must still hold the user's real history, not zero-defaults + 1.
    expect(JSON.parse(mockStorage.get('quiz_stats')!)).toEqual({
      totalQuestions: 100,
      totalCorrect: 80,
      bestStreak: 12,
    });
    expect(useQuizStore.getState().loaded).toBe(false);
    expect(useQuizStore.getState().loadError).toBe(true);
  });

  test('quiz store recovers on the next call after a transient load failure', async () => {
    mockStorage.set('quiz_stats', JSON.stringify({ totalQuestions: 50, totalCorrect: 40, bestStreak: 5 }));
    jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('transient'));

    await useQuizStore.getState().recordAnswer(true, 1);
    expect(JSON.parse(mockStorage.get('quiz_stats')!)).toEqual({
      totalQuestions: 50,
      totalCorrect: 40,
      bestStreak: 5,
    });

    await useQuizStore.getState().recordAnswer(true, 2);

    expect(useQuizStore.getState()).toMatchObject({
      totalQuestions: 51,
      totalCorrect: 41,
      bestStreak: 5,
      loaded: true,
      loadError: false,
    });
    expect(JSON.parse(mockStorage.get('quiz_stats')!)).toEqual({
      totalQuestions: 51,
      totalCorrect: 41,
      bestStreak: 5,
    });
  });

  test('spaced repetition result waits for an in-flight initial load and preserves loaded weights', async () => {
    const load = deferred<string | null>();
    jest.mocked(AsyncStorage.getItem).mockImplementationOnce(() => load.promise);

    const loadPromise = useSpacedRepStore.getState().loadWeights();
    const recordPromise = useSpacedRepStore.getState().recordResult('dormir', 'preterite', 2, false);

    load.resolve(JSON.stringify({ dormir: 2 }));
    await Promise.all([loadPromise, recordPromise]);

    const promptKey = buildPromptKey('dormir', 'preterite', 2);
    expect(useSpacedRepStore.getState().weights).toEqual({ dormir: 2, [promptKey]: 3 });
    expect(JSON.parse(mockStorage.get('spaced_rep_weights')!)).toEqual({ dormir: 2, [promptKey]: 3 });
  });

  test('spaced repetition result leaves disk and state untouched when persistence fails', async () => {
    useSpacedRepStore.setState({ weights: { dormir: 2 }, loaded: true });
    mockStorage.set('spaced_rep_weights', JSON.stringify({ dormir: 2 }));
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk full'));

    await expect(
      useSpacedRepStore.getState().recordResult('dormir', 'preterite', 2, false),
    ).resolves.toBeUndefined();

    expect(useSpacedRepStore.getState().weights).toEqual({ dormir: 2 });
    expect(JSON.parse(mockStorage.get('spaced_rep_weights')!)).toEqual({ dormir: 2 });
  });

  test('spaced repetition reset leaves state intact when deletion fails', async () => {
    useSpacedRepStore.setState({ weights: { dormir: 2 }, loaded: true });
    mockStorage.set('spaced_rep_weights', JSON.stringify({ dormir: 2 }));
    jest.mocked(AsyncStorage.removeItem).mockRejectedValueOnce(new Error('disk locked'));

    await expect(useSpacedRepStore.getState().resetWeights()).resolves.toBe(false);

    expect(useSpacedRepStore.getState().weights).toEqual({ dormir: 2 });
    expect(mockStorage.has('spaced_rep_weights')).toBe(true);
  });

  test('spaced repetition rejects non-finite and wrong-shape weights', async () => {
    expect(parseStoredWeights({ dormir: Number.NaN })).toBeNull();
    expect(parseStoredWeights({ dormir: 'heavy' })).toBeNull();

    mockStorage.set('spaced_rep_weights', JSON.stringify({ dormir: null }));
    await useSpacedRepStore.getState().loadWeights();

    expect(useSpacedRepStore.getState()).toMatchObject({
      weights: {},
      loaded: true,
      loadError: false,
    });
    expect(mockStorage.has('spaced_rep_weights')).toBe(false);
  });

  test('spaced repetition refuses to write when initial load failed, preserving disk', async () => {
    mockStorage.set('spaced_rep_weights', JSON.stringify({ dormir: 4, hablar: 0.5 }));
    jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('disk locked'));

    await useSpacedRepStore.getState().recordResult('dormir', 'preterite', 2, false);

    expect(JSON.parse(mockStorage.get('spaced_rep_weights')!)).toEqual({
      dormir: 4,
      hablar: 0.5,
    });
    expect(useSpacedRepStore.getState().loaded).toBe(false);
    expect(useSpacedRepStore.getState().loadError).toBe(true);
  });

  test('spaced repetition recovers on the next call after a transient load failure', async () => {
    mockStorage.set('spaced_rep_weights', JSON.stringify({ dormir: 4 }));
    jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('transient'));

    await useSpacedRepStore.getState().recordResult('dormir', 'preterite', 2, false);
    expect(useSpacedRepStore.getState()).toMatchObject({
      loaded: false,
      loadError: true,
    });

    await useSpacedRepStore.getState().recordResult('dormir', 'preterite', 2, false);

    const promptKey = buildPromptKey('dormir', 'preterite', 2);
    expect(useSpacedRepStore.getState()).toMatchObject({
      loaded: true,
      loadError: false,
      weights: { dormir: 4, [promptKey]: 5 },
    });
    expect(JSON.parse(mockStorage.get('spaced_rep_weights')!)).toEqual({ dormir: 4, [promptKey]: 5 });
  });
});
