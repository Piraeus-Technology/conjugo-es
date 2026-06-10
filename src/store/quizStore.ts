import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeRemoveItem, safeSetItem } from '../utils/safeStorage';
import { createStoreQueue } from '../utils/storeQueue';

interface QuizStats {
  totalQuestions: number;
  totalCorrect: number;
  bestStreak: number;
  loaded: boolean;
  loadError: boolean;
  loadStats: () => Promise<void>;
  recordAnswer: (correct: boolean, currentStreak: number) => Promise<void>;
  resetStats: () => Promise<void>;
}

// Dedupes concurrent first-load calls and serializes writes against loads
// (prevents loadStats from stomping a just-recorded answer).
const queue = createStoreQueue();

export const useQuizStore = create<QuizStats>((set, get) => ({
  totalQuestions: 0,
  totalCorrect: 0,
  bestStreak: 0,
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
          const data = JSON.parse(stored);
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
      const persisted = await safeSetItem('quiz_stats', JSON.stringify(updated));
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

  resetStats: async () => {
    return queue.enqueue(async () => {
      set({ totalQuestions: 0, totalCorrect: 0, bestStreak: 0, loaded: true, loadError: false });
      await safeRemoveItem('quiz_stats');
    });
  },
}));

export function __resetQuizStoreForTests() {
  queue.reset();
  useQuizStore.setState({
    totalQuestions: 0,
    totalCorrect: 0,
    bestStreak: 0,
    loaded: false,
    loadError: false,
  });
}
