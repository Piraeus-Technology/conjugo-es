import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  __resetFavoritesStoreForTests,
  useFavoritesStore,
} from '../store/favoritesStore';
import {
  __resetFlashcardSessionStoreForTests,
  useFlashcardSessionStore,
} from '../store/flashcardSessionStore';
import {
  __resetHistoryStoreForTests,
  useHistoryStore,
} from '../store/historyStore';
import {
  __resetPracticeSettingsStoreForTests,
  allLevels,
  allTenses,
  usePracticeSettingsStore,
} from '../store/practiceSettingsStore';
import { __resetQuizStoreForTests, useQuizStore } from '../store/quizStore';
import { __resetSessionStoreForTests, useSessionStore } from '../store/sessionStore';
import {
  __resetSpacedRepStoreForTests,
  useSpacedRepStore,
} from '../store/spacedRepStore';
import { __resetThemeStoreForTests, useThemeStore } from '../store/themeStore';
import { resetAllLearningData } from '../utils/resetLearningData';

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

describe('reset all learning data', () => {
  beforeEach(() => {
    mockStorage.clear();
    jest.clearAllMocks();
    __resetQuizStoreForTests();
    __resetSpacedRepStoreForTests();
    __resetSessionStoreForTests();
    __resetFlashcardSessionStoreForTests();
    __resetFavoritesStoreForTests();
    __resetHistoryStoreForTests();
    __resetPracticeSettingsStoreForTests();
    __resetThemeStoreForTests();
  });

  test('clears progress, weights, sessions, favorites, history, and preferences', async () => {
    useQuizStore.setState({
      totalQuestions: 4,
      totalCorrect: 3,
      bestStreak: 2,
      reviewPrompted: true,
      loaded: true,
    });
    useSpacedRepStore.setState({ weights: { hablar: 2 }, loaded: true });
    useSessionStore.setState({
      sessions: [{ day: '2026-07-24', total: 4, correct: 3, streak: 2 }],
      loaded: true,
    });
    useFlashcardSessionStore.setState({
      sessions: [{ day: '2026-07-24', reviewed: 3, correct: 2 }],
      loaded: true,
    });
    useFavoritesStore.setState({ favorites: ['hablar'], loaded: true });
    useHistoryStore.setState({ history: ['comer'], loaded: true });
    usePracticeSettingsStore.setState({
      activeTenses: ['present'],
      activeLevels: ['A1'],
      loaded: true,
    });
    useThemeStore.setState({
      isDark: true,
      autoTTS: true,
      includeVosotros: false,
      loaded: true,
    });

    for (const key of [
      'quiz_stats',
      'spaced_rep_weights',
      'sessions',
      'flashcardSessions',
      'favorites',
      'verb_history',
      'practiceSettings',
      'theme_mode',
      'auto_tts',
      'include_vosotros',
    ]) {
      mockStorage.set(key, 'stored');
    }

    await expect(resetAllLearningData()).resolves.toBe(true);

    expect(useQuizStore.getState()).toMatchObject({
      totalQuestions: 0,
      totalCorrect: 0,
      bestStreak: 0,
      reviewPrompted: false,
    });
    expect(useSpacedRepStore.getState().weights).toEqual({});
    expect(useSessionStore.getState().sessions).toEqual([]);
    expect(useFlashcardSessionStore.getState().sessions).toEqual([]);
    expect(useFavoritesStore.getState().favorites).toEqual([]);
    expect(useHistoryStore.getState().history).toEqual([]);
    expect(usePracticeSettingsStore.getState().activeTenses).toEqual(allTenses);
    expect(usePracticeSettingsStore.getState().activeLevels).toEqual(allLevels);
    expect(useThemeStore.getState()).toMatchObject({
      isDark: false,
      autoTTS: false,
      includeVosotros: true,
    });
    expect(mockStorage.size).toBe(0);
    expect(AsyncStorage.removeItem).toHaveBeenCalled();
  });
});
