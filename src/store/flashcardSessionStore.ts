import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeRemoveItem, safeSetItem } from '../utils/safeStorage';
import { MAX_DAILY_SESSIONS } from '../utils/constants';

export interface FlashcardSession {
  day: string; // 'YYYY-MM-DD'
  reviewed: number;
  correct: number;
}

interface FlashcardSessionStore {
  sessions: FlashcardSession[];
  loaded: boolean;
  loadSessions: () => Promise<void>;
  saveSession: (session: Omit<FlashcardSession, 'day'>) => Promise<void>;
  clearSessions: () => Promise<void>;
}

function getTodayKey(): string {
  return new Date().toLocaleDateString('en-CA');
}

// See sessionStore.ts. Dedupes concurrent first-load calls.
let loadPromise: Promise<void> | null = null;
let operationQueue: Promise<void> = Promise.resolve();

function enqueueOperation(operation: () => Promise<void>): Promise<void> {
  const next = operationQueue.catch(() => undefined).then(operation);
  operationQueue = next.catch(() => undefined);
  return next;
}

export const useFlashcardSessionStore = create<FlashcardSessionStore>((set, get) => ({
  sessions: [],
  loaded: false,

  loadSessions: async () => {
    if (get().loaded) return;
    if (loadPromise) return loadPromise;
    loadPromise = enqueueOperation(async () => {
      if (get().loaded) return;
      try {
        const stored = await AsyncStorage.getItem('flashcardSessions');
        if (stored) {
          const parsed = JSON.parse(stored);
          // Migrate old format (date: timestamp) to new format (day: 'YYYY-MM-DD').
          // Only write back if we actually transformed something.
          const dayMap: Record<string, FlashcardSession> = {};
          let didMigrate = false;
          for (const s of parsed) {
            if (!s.day) didMigrate = true;
            const day = s.day || new Date(s.date).toLocaleDateString('en-CA');
            if (dayMap[day]) {
              didMigrate = true;
              dayMap[day].reviewed += s.reviewed;
              dayMap[day].correct += s.correct;
            } else {
              dayMap[day] = { day, reviewed: s.reviewed, correct: s.correct };
            }
          }
          const sessions = Object.values(dayMap).sort((a, b) => b.day.localeCompare(a.day));
          set({ sessions, loaded: true });
          if (didMigrate) {
            await safeSetItem('flashcardSessions', JSON.stringify(sessions));
          }
        } else {
          set({ loaded: true });
        }
      } catch (e) {
        console.warn('Failed to load flashcard sessions:', e);
        set({ loaded: true });
      }
    });
    return loadPromise;
  },

  saveSession: async (session) => {
    if (!get().loaded) {
      await get().loadSessions();
    }

    return enqueueOperation(async () => {
      const today = getTodayKey();
      const current = get().sessions;
      const existingIndex = current.findIndex(s => s.day === today);

      let updated: FlashcardSession[];
      if (existingIndex >= 0) {
        updated = [...current];
        updated[existingIndex] = {
          day: today,
          reviewed: updated[existingIndex].reviewed + session.reviewed,
          correct: updated[existingIndex].correct + session.correct,
        };
      } else {
        updated = [{ ...session, day: today }, ...current].slice(0, MAX_DAILY_SESSIONS);
      }

      const persisted = await safeSetItem('flashcardSessions', JSON.stringify(updated));
      if (!persisted) {
        throw new Error('Failed to persist flashcard session');
      }
      set({ sessions: updated });
    });
  },

  clearSessions: async () => {
    return enqueueOperation(async () => {
      set({ sessions: [], loaded: true });
      loadPromise = null;
      await safeRemoveItem('flashcardSessions');
    });
  },
}));
