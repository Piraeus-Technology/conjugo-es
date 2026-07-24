import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeRemoveItem, safeSetItem } from '../utils/safeStorage';
import { createStoreQueue } from '../utils/storeQueue';

interface QuizStats {
  totalQuestions: number;
  totalCorrect: number;
  bestStreak: number;
  reviewPrompted: boolean;
  loaded: boolean;
  loadError: boolean;
  loadStats: () => Promise<void>;
  recordAnswer: (correct: boolean, currentStreak: number) => Promise<void>;
  claimReviewPrompt: () => Promise<boolean>;
  resetStats: () => Promise<boolean>;
}

interface PersistedQuizStats {
  totalQuestions: number;
  totalCorrect: number;
  bestStreak: number;
  reviewPrompted: boolean;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

export function parseStoredQuizStats(value: unknown): PersistedQuizStats | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (
    !isNonNegativeInteger(candidate.totalQuestions)
    || !isNonNegativeInteger(candidate.totalCorrect)
    || !isNonNegativeInteger(candidate.bestStreak)
    || (candidate.reviewPrompted !== undefined && typeof candidate.reviewPrompted !== 'boolean')
    || candidate.totalCorrect > candidate.totalQuestions
  ) {
    return null;
  }
  return {
    totalQuestions: candidate.totalQuestions,
    totalCorrect: candidate.totalCorrect,
    bestStreak: candidate.bestStreak,
    reviewPrompted: candidate.reviewPrompted === true,
  };
}

// Dedupes concurrent first-load calls and serializes writes against loads
// (prevents loadStats from stomping a just-recorded answer).
const queue = createStoreQueue();

export const useQuizStore = create<QuizStats>((set, get) => ({
  totalQuestions: 0,
  totalCorrect: 0,
  bestStreak: 0,
  reviewPrompted: false,
  loaded: false,
  loadError: false,

  loadStats: async () => {
    if (get().loaded) return;
    set({ loadError: false });
    return queue.runLoad(async () => {
      if (get().loaded) return;
      try {
        const stored = await AsyncStorage.getItem('quiz_stats');
        if (stored) {
          let data: PersistedQuizStats | null = null;
          try {
            data = parseStoredQuizStats(JSON.parse(stored));
          } catch {
            // Handled as corrupt data below; storage I/O errors remain in the
            // outer catch and are retried without deleting anything.
          }
          if (!data) {
            console.warn('Discarding corrupt quiz stats');
            const removed = await safeRemoveItem('quiz_stats');
            if (!removed) {
              set({ loadError: true });
              return;
            }
            set({
              totalQuestions: 0,
              totalCorrect: 0,
              bestStreak: 0,
              reviewPrompted: false,
              loaded: true,
              loadError: false,
            });
            return;
          }
          set({ ...data, loaded: true, loadError: false });
        } else {
          set({ loaded: true, loadError: false });
        }
      } catch (e) {
        // Don't set loaded: true — that would let recordAnswer write
        // zero-defaults over the user's real (but currently unreadable)
        // history on disk. Leave loaded: false so the next call retries.
        console.warn('Failed to load quiz stats:', e);
        set({ loadError: true });
      }
    });
  },

  recordAnswer: async (correct: boolean, currentStreak: number) => {
    if (!get().loaded) {
      await get().loadStats();
    }
    if (!get().loaded) {
      // Load failed — refuse to write. Writing now would overwrite the
      // user's real history with zero-defaults.
      console.warn('Skipping quiz answer persistence: store never loaded');
      return;
    }
    return queue.enqueue(async () => {
      const state = get();
      const updated = {
        totalQuestions: state.totalQuestions + 1,
        totalCorrect: state.totalCorrect + (correct ? 1 : 0),
        bestStreak: Math.max(state.bestStreak, currentStreak),
      };
      const persisted = await safeSetItem(
        'quiz_stats',
        JSON.stringify({
          ...updated,
          ...(state.reviewPrompted ? { reviewPrompted: true } : {}),
        }),
      );
      if (!persisted) {
        // Don't throw or set: leave in-memory aligned with disk so a
        // transient AsyncStorage flake doesn't desync the global store
        // from the user's actual history.
        console.warn('Failed to persist quiz stats');
        return;
      }
      set(updated);
    });
  },

  claimReviewPrompt: async () => {
    if (!get().loaded) {
      await get().loadStats();
    }
    if (!get().loaded) return false;

    return queue.enqueue(async () => {
      const state = get();
      if (state.reviewPrompted) return false;
      const persisted = await safeSetItem(
        'quiz_stats',
        JSON.stringify({
          totalQuestions: state.totalQuestions,
          totalCorrect: state.totalCorrect,
          bestStreak: state.bestStreak,
          reviewPrompted: true,
        }),
      );
      if (!persisted) {
        console.warn('Failed to persist review prompt milestone');
        return false;
      }
      set({ reviewPrompted: true });
      return true;
    });
  },

  resetStats: async () => {
    return queue.enqueue(async () => {
      const removed = await safeRemoveItem('quiz_stats');
      if (!removed) {
        console.warn('Failed to reset quiz stats');
        return false;
      }
      set({
        totalQuestions: 0,
        totalCorrect: 0,
        bestStreak: 0,
        reviewPrompted: false,
        loaded: true,
        loadError: false,
      });
      return true;
    });
  },
}));

export function __resetQuizStoreForTests() {
  queue.reset();
  useQuizStore.setState({
    totalQuestions: 0,
    totalCorrect: 0,
    bestStreak: 0,
    reviewPrompted: false,
    loaded: false,
    loadError: false,
  });
}
