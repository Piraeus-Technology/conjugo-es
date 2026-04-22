import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFlashcardSessionStore } from '../store/flashcardSessionStore';
import { useSessionStore } from '../store/sessionStore';

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

const today = () => new Date().toLocaleDateString('en-CA');

describe('session store persistence races', () => {
  beforeEach(async () => {
    mockStorage.clear();
    jest.clearAllMocks();
    await useSessionStore.getState().clearSessions();
    await useFlashcardSessionStore.getState().clearSessions();
    useSessionStore.setState({ sessions: [], loaded: false });
    useFlashcardSessionStore.setState({ sessions: [], loaded: false });
    jest.clearAllMocks();
  });

  test('quiz save waits for an in-flight initial load and preserves both totals', async () => {
    const load = deferred<string | null>();
    jest.mocked(AsyncStorage.getItem).mockImplementationOnce(() => load.promise);

    const loadPromise = useSessionStore.getState().loadSessions();
    const savePromise = useSessionStore.getState().saveSession({ total: 2, correct: 1, streak: 1 });

    load.resolve(JSON.stringify([{ day: today(), total: 5, correct: 4, streak: 3 }]));
    await Promise.all([loadPromise, savePromise]);

    expect(useSessionStore.getState().sessions).toEqual([
      { day: today(), total: 7, correct: 5, streak: 3 },
    ]);
    expect(JSON.parse(mockStorage.get('sessions')!)).toEqual([
      { day: today(), total: 7, correct: 5, streak: 3 },
    ]);
  });

  test('quiz overlapping saves are serialized and merge into the latest state', async () => {
    useSessionStore.setState({
      sessions: [{ day: today(), total: 5, correct: 4, streak: 3 }],
      loaded: true,
    });
    const firstWrite = deferred<void>();
    const secondWrite = deferred<void>();
    jest
      .mocked(AsyncStorage.setItem)
      .mockImplementationOnce((key, value) => {
        mockStorage.set(key, value);
        return firstWrite.promise;
      })
      .mockImplementationOnce((key, value) => {
        mockStorage.set(key, value);
        return secondWrite.promise;
      });

    const firstSave = useSessionStore.getState().saveSession({ total: 2, correct: 1, streak: 1 });
    const secondSave = useSessionStore.getState().saveSession({ total: 3, correct: 3, streak: 4 });

    await Promise.resolve();
    firstWrite.resolve();
    await firstSave;
    secondWrite.resolve();
    await secondSave;

    expect(useSessionStore.getState().sessions).toEqual([
      { day: today(), total: 10, correct: 8, streak: 4 },
    ]);
    expect(JSON.parse(mockStorage.get('sessions')!)).toEqual([
      { day: today(), total: 10, correct: 8, streak: 4 },
    ]);
  });

  test('flashcard save waits for an in-flight initial load and preserves both totals', async () => {
    const load = deferred<string | null>();
    jest.mocked(AsyncStorage.getItem).mockImplementationOnce(() => load.promise);

    const loadPromise = useFlashcardSessionStore.getState().loadSessions();
    const savePromise = useFlashcardSessionStore.getState().saveSession({ reviewed: 2, correct: 1 });

    load.resolve(JSON.stringify([{ day: today(), reviewed: 5, correct: 4 }]));
    await Promise.all([loadPromise, savePromise]);

    expect(useFlashcardSessionStore.getState().sessions).toEqual([
      { day: today(), reviewed: 7, correct: 5 },
    ]);
    expect(JSON.parse(mockStorage.get('flashcardSessions')!)).toEqual([
      { day: today(), reviewed: 7, correct: 5 },
    ]);
  });

  test('flashcard overlapping saves are serialized and merge into the latest state', async () => {
    useFlashcardSessionStore.setState({
      sessions: [{ day: today(), reviewed: 5, correct: 4 }],
      loaded: true,
    });
    const firstWrite = deferred<void>();
    const secondWrite = deferred<void>();
    jest
      .mocked(AsyncStorage.setItem)
      .mockImplementationOnce((key, value) => {
        mockStorage.set(key, value);
        return firstWrite.promise;
      })
      .mockImplementationOnce((key, value) => {
        mockStorage.set(key, value);
        return secondWrite.promise;
      });

    const firstSave = useFlashcardSessionStore.getState().saveSession({ reviewed: 2, correct: 1 });
    const secondSave = useFlashcardSessionStore.getState().saveSession({ reviewed: 3, correct: 3 });

    await Promise.resolve();
    firstWrite.resolve();
    await firstSave;
    secondWrite.resolve();
    await secondSave;

    expect(useFlashcardSessionStore.getState().sessions).toEqual([
      { day: today(), reviewed: 10, correct: 8 },
    ]);
    expect(JSON.parse(mockStorage.get('flashcardSessions')!)).toEqual([
      { day: today(), reviewed: 10, correct: 8 },
    ]);
  });
});
