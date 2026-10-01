import { useFavoritesStore } from '../store/favoritesStore';
import { useFlashcardSessionStore } from '../store/flashcardSessionStore';
import { useHistoryStore } from '../store/historyStore';
import { usePracticeSettingsStore } from '../store/practiceSettingsStore';
import { useQuizStore } from '../store/quizStore';
import { useSessionStore } from '../store/sessionStore';
import { useSpacedRepStore } from '../store/spacedRepStore';
import { useThemeStore } from '../store/themeStore';
import { usePracticeResetStore } from '../store/practiceResetStore';

export async function resetAllLearningData(): Promise<boolean> {
  const current = usePracticeResetStore.getState();
  if (current.resetting) return false;
  usePracticeResetStore.setState({ version: current.version + 1, resetting: true });
  try {
    const results = await Promise.all([
      useQuizStore.getState().resetStats(),
      useSpacedRepStore.getState().resetWeights(),
      useSessionStore.getState().clearSessions(),
      useFlashcardSessionStore.getState().clearSessions(),
      useFavoritesStore.getState().clearFavorites(),
      useHistoryStore.getState().clearHistory(),
      usePracticeSettingsStore.getState().resetPracticeSettings(),
      useThemeStore.getState().resetPreferences(),
    ]);

    return results.every(Boolean);
  } finally {
    usePracticeResetStore.setState({ resetting: false });
  }
}
