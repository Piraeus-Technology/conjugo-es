import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuizStore } from '../store/quizStore';
import { buildPromptKey, useSpacedRepStore } from '../store/spacedRepStore';

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

  beforeEach(async () => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockStorage.clear();
    jest.clearAllMocks();

    await useQuizStore.getState().resetStats();
    await useSpacedRepStore.getState().resetWeights();
    useQuizStore.setState({ totalQuestions: 0, totalCorrect: 0, bestStreak: 0, loaded: false });
    useSpacedRepStore.setState({ weights: {}, loaded: false });

    mockStorage.clear();
    jest.clearAllMocks();
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

  test('quiz answer rejects and leaves state unchanged when persistence fails', async () => {
    useQuizStore.setState({ totalQuestions: 5, totalCorrect: 4, bestStreak: 3, loaded: true });
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk full'));

    await expect(useQuizStore.getState().recordAnswer(false, 0)).rejects.toThrow('Failed to persist quiz stats');

    expect(useQuizStore.getState()).toMatchObject({
      totalQuestions: 5,
      totalCorrect: 4,
      bestStreak: 3,
      loaded: true,
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
    expect(useSpacedRepStore.getState().weights).toEqual({ [promptKey]: 3 });
    expect(JSON.parse(mockStorage.get('spaced_rep_weights')!)).toEqual({ [promptKey]: 3 });
  });

  test('spaced repetition result rejects and leaves state unchanged when persistence fails', async () => {
    useSpacedRepStore.setState({ weights: { dormir: 2 }, loaded: true });
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk full'));

    await expect(
      useSpacedRepStore.getState().recordResult('dormir', 'preterite', 2, false),
    ).rejects.toThrow('Failed to persist spaced rep weights');

    expect(useSpacedRepStore.getState().weights).toEqual({ dormir: 2 });
  });
});
