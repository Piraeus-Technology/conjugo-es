import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeRemoveItem, safeSetItem } from '../utils/safeStorage';

interface QuizStats {
  totalQuestions: number;
  totalCorrect: number;
  bestStreak: number;
  loaded: boolean;
  loadStats: () => Promise<void>;
  recordAnswer: (correct: boolean, currentStreak: number) => Promise<void>;
  resetStats: () => Promise<void>;
}

// Module-scoped to dedupe concurrent first-load calls and serialize writes
// against loads (prevents loadStats from stomping a just-recorded answer).
let loadPromise: Promise<void> | null = null;
let operationQueue: Promise<void> = Promise.resolve();

function enqueueOperation(operation: () => Promise<void>): Promise<void> {
  const next = operationQueue.catch(() => undefined).then(operation);
  operationQueue = next.catch(() => undefined);
  return next;
}

export const useQuizStore = create<QuizStats>((set, get) => ({
  totalQuestions: 0,
  totalCorrect: 0,
  bestStreak: 0,
  loaded: false,

  loadStats: async () => {
    if (get().loaded) return;
    if (loadPromise) return loadPromise;
    loadPromise = enqueueOperation(async () => {
      if (get().loaded) return;
      try {
        const stored = await AsyncStorage.getItem('quiz_stats');
        if (stored) {
          const data = JSON.parse(stored);
          set({ ...data, loaded: true });
        } else {
          set({ loaded: true });
        }
      } catch (e) {
        console.warn('Failed to load quiz stats:', e);
        set({ loaded: true });
      }
    });
    return loadPromise;
  },

  recordAnswer: async (correct: boolean, currentStreak: number) => {
    if (!get().loaded) {
      await get().loadStats();
    }
    return enqueueOperation(async () => {
      const state = get();
      const updated = {
        totalQuestions: state.totalQuestions + 1,
        totalCorrect: state.totalCorrect + (correct ? 1 : 0),
        bestStreak: Math.max(state.bestStreak, currentStreak),
      };
      const persisted = await safeSetItem('quiz_stats', JSON.stringify(updated));
      if (!persisted) {
        throw new Error('Failed to persist quiz stats');
      }
      set(updated);
    });
  },

  resetStats: async () => {
    return enqueueOperation(async () => {
      set({ totalQuestions: 0, totalCorrect: 0, bestStreak: 0, loaded: true });
      loadPromise = null;
      await safeRemoveItem('quiz_stats');
    });
  },
}));
