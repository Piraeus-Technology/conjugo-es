import AsyncStorage from '@react-native-async-storage/async-storage';
import { __resetFavoritesStoreForTests, useFavoritesStore } from '../store/favoritesStore';
import { __resetHistoryStoreForTests, useHistoryStore } from '../store/historyStore';
import { __resetThemeStoreForTests, useThemeStore } from '../store/themeStore';
import {
  __resetPracticeSettingsStoreForTests,
  allLevels,
  allTenses,
  usePracticeSettingsStore,
} from '../store/practiceSettingsStore';

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

describe('simple store persistence', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockStorage.clear();
    jest.clearAllMocks();
    __resetFavoritesStoreForTests();
    __resetHistoryStoreForTests();
    __resetThemeStoreForTests();
    __resetPracticeSettingsStoreForTests();
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  describe('favorites', () => {
    test('load failure refuses writes instead of clobbering disk', async () => {
      mockStorage.set('favorites', JSON.stringify(['ser', 'estar']));
      jest.mocked(AsyncStorage.getItem).mockImplementationOnce(() =>
        Promise.reject(new Error('disk error')),
      );

      await useFavoritesStore.getState().loadFavorites();
      expect(useFavoritesStore.getState().loaded).toBe(false);
      expect(useFavoritesStore.getState().loadError).toBe(true);

      // getItem still failing: the toggle's load retry also fails → refuse to write
      jest.mocked(AsyncStorage.getItem).mockImplementationOnce(() =>
        Promise.reject(new Error('disk error')),
      );
      await useFavoritesStore.getState().toggleFavorite('tener');

      expect(mockStorage.get('favorites')).toBe(JSON.stringify(['ser', 'estar']));
      expect(useFavoritesStore.getState().favorites).toEqual([]);
    });

    test('write retries the load first and succeeds once storage recovers', async () => {
      mockStorage.set('favorites', JSON.stringify(['ser']));
      jest.mocked(AsyncStorage.getItem).mockImplementationOnce(() =>
        Promise.reject(new Error('transient')),
      );

      await useFavoritesStore.getState().loadFavorites();
      expect(useFavoritesStore.getState().loaded).toBe(false);

      await useFavoritesStore.getState().toggleFavorite('tener');

      expect(useFavoritesStore.getState().favorites).toEqual(['tener', 'ser']);
      expect(mockStorage.get('favorites')).toBe(JSON.stringify(['tener', 'ser']));
    });

    test('toggle during an in-flight load cannot be stomped by the load result', async () => {
      mockStorage.set('favorites', JSON.stringify(['ser']));
      const load = deferred<string | null>();
      jest.mocked(AsyncStorage.getItem).mockImplementationOnce(() => load.promise);

      const loadPromise = useFavoritesStore.getState().loadFavorites();
      const togglePromise = useFavoritesStore.getState().toggleFavorite('tener');

      load.resolve(JSON.stringify(['ser']));
      await Promise.all([loadPromise, togglePromise]);

      expect(useFavoritesStore.getState().favorites).toEqual(['tener', 'ser']);
      expect(mockStorage.get('favorites')).toBe(JSON.stringify(['tener', 'ser']));
    });

    test('failed persist leaves in-memory state aligned with disk', async () => {
      mockStorage.set('favorites', JSON.stringify(['ser']));
      await useFavoritesStore.getState().loadFavorites();

      jest.mocked(AsyncStorage.setItem).mockImplementationOnce(() =>
        Promise.reject(new Error('disk full')),
      );
      await useFavoritesStore.getState().toggleFavorite('tener');

      expect(useFavoritesStore.getState().favorites).toEqual(['ser']);
      expect(mockStorage.get('favorites')).toBe(JSON.stringify(['ser']));
    });

    test('corrupt non-array payload falls back to empty but loads', async () => {
      mockStorage.set('favorites', JSON.stringify({ not: 'an array' }));
      await useFavoritesStore.getState().loadFavorites();
      expect(useFavoritesStore.getState().loaded).toBe(true);
      expect(useFavoritesStore.getState().favorites).toEqual([]);
    });
  });

  describe('history', () => {
    test('load failure refuses writes instead of clobbering disk', async () => {
      mockStorage.set('verb_history', JSON.stringify(['hablar', 'comer']));
      jest.mocked(AsyncStorage.getItem).mockImplementation(() =>
        Promise.reject(new Error('disk error')),
      );

      await useHistoryStore.getState().loadHistory();
      await useHistoryStore.getState().addToHistory('vivir');

      expect(mockStorage.get('verb_history')).toBe(JSON.stringify(['hablar', 'comer']));
      expect(useHistoryStore.getState().history).toEqual([]);

      jest.mocked(AsyncStorage.getItem).mockImplementation((key: string) =>
        Promise.resolve(mockStorage.get(key) ?? null),
      );
    });

    test('add and remove persist through the queue in order', async () => {
      await useHistoryStore.getState().loadHistory();
      await Promise.all([
        useHistoryStore.getState().addToHistory('hablar'),
        useHistoryStore.getState().addToHistory('comer'),
        useHistoryStore.getState().removeFromHistory('hablar'),
      ]);

      expect(useHistoryStore.getState().history).toEqual(['comer']);
      expect(mockStorage.get('verb_history')).toBe(JSON.stringify(['comer']));
    });
  });

  describe('practice settings', () => {
    test('concurrent tense and level toggles both persist (no patch clobber)', async () => {
      await usePracticeSettingsStore.getState().loadPracticeSettings();
      await Promise.all([
        usePracticeSettingsStore.getState().toggleTense('present'),
        usePracticeSettingsStore.getState().toggleLevel('A1'),
      ]);

      const persisted = JSON.parse(mockStorage.get('practiceSettings')!);
      expect(persisted.activeTenses).not.toContain('present');
      expect(persisted.activeLevels).not.toContain('A1');
      expect(persisted.activeTenses).toEqual(usePracticeSettingsStore.getState().activeTenses);
      expect(persisted.activeLevels).toEqual(usePracticeSettingsStore.getState().activeLevels);
    });

    test('unknown or empty persisted values fall back to defaults', async () => {
      mockStorage.set(
        'practiceSettings',
        JSON.stringify({ activeTenses: ['present', 'bogus_tense'], activeLevels: [] }),
      );
      await usePracticeSettingsStore.getState().loadPracticeSettings();

      expect(usePracticeSettingsStore.getState().activeTenses).toEqual(['present']);
      expect(usePracticeSettingsStore.getState().activeLevels).toEqual(allLevels);
    });

    test('reload after loaded is a no-op and keeps array identities stable', async () => {
      mockStorage.set(
        'practiceSettings',
        JSON.stringify({ activeTenses: ['present'], activeLevels: ['A1'] }),
      );
      await usePracticeSettingsStore.getState().loadPracticeSettings();
      const firstTenses = usePracticeSettingsStore.getState().activeTenses;

      await usePracticeSettingsStore.getState().loadPracticeSettings();
      expect(usePracticeSettingsStore.getState().activeTenses).toBe(firstTenses);
    });

    test('load failure falls back to defaults but still loads', async () => {
      jest.mocked(AsyncStorage.getItem).mockImplementationOnce(() =>
        Promise.reject(new Error('disk error')),
      );
      await usePracticeSettingsStore.getState().loadPracticeSettings();

      expect(usePracticeSettingsStore.getState().loaded).toBe(true);
      expect(usePracticeSettingsStore.getState().activeTenses).toEqual(allTenses);
    });
  });

  describe('theme', () => {
    test('load failure falls back to defaults but still loads (App gates render on loaded)', async () => {
      jest.mocked(AsyncStorage.getItem).mockImplementation(() =>
        Promise.reject(new Error('disk error')),
      );
      await useThemeStore.getState().loadTheme();

      expect(useThemeStore.getState().loaded).toBe(true);
      expect(useThemeStore.getState().isDark).toBe(false);

      jest.mocked(AsyncStorage.getItem).mockImplementation((key: string) =>
        Promise.resolve(mockStorage.get(key) ?? null),
      );
    });

    test('toggle persists and keeps UI state on persist failure', async () => {
      await useThemeStore.getState().loadTheme();
      await useThemeStore.getState().toggleTheme();
      expect(mockStorage.get('theme_mode')).toBe('dark');

      jest.mocked(AsyncStorage.setItem).mockImplementationOnce(() =>
        Promise.reject(new Error('disk full')),
      );
      await useThemeStore.getState().toggleTheme();
      // Preference toggles stay responsive even if the write fails
      expect(useThemeStore.getState().isDark).toBe(false);
      expect(mockStorage.get('theme_mode')).toBe('dark');
    });
  });
});
