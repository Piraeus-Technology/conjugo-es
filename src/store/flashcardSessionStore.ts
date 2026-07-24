import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeRemoveItem, safeSetItem } from '../utils/safeStorage';
import { createStoreQueue } from '../utils/storeQueue';
import {
  getTodayKey,
  isValidDayKey,
  normalizeStoredDayKey,
  timestampToDayKey,
} from '../utils/dayKey';
import { MAX_DAILY_SESSIONS } from '../utils/constants';

export interface FlashcardSession {
  day: string; // 'YYYY-MM-DD'
  reviewed: number;
  correct: number;
}

interface FlashcardSessionStore {
  sessions: FlashcardSession[];
  loaded: boolean;
  loadError: boolean;
  loadSessions: () => Promise<void>;
  saveSession: (session: Omit<FlashcardSession, 'day'>) => Promise<void>;
  clearSessions: () => Promise<boolean>;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

export function parseStoredFlashcardSessions(
  value: unknown,
): { sessions: FlashcardSession[]; didMigrate: boolean } | null {
  if (!Array.isArray(value)) return null;
  const dayMap: Record<string, FlashcardSession> = {};
  let didMigrate = false;

  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const stored = raw as Record<string, unknown>;
    if (
      !isNonNegativeInteger(stored.reviewed)
      || !isNonNegativeInteger(stored.correct)
      || stored.correct > stored.reviewed
    ) {
      return null;
    }

    let day: string;
    if (typeof stored.day === 'string') {
      day = normalizeStoredDayKey(stored.day);
      if (!isValidDayKey(day)) return null;
      if (day !== stored.day) didMigrate = true;
    } else if (typeof stored.date === 'number' && Number.isFinite(stored.date)) {
      day = timestampToDayKey(stored.date);
      didMigrate = true;
    } else {
      return null;
    }

    if (dayMap[day]) {
      didMigrate = true;
      dayMap[day].reviewed += stored.reviewed;
      dayMap[day].correct += stored.correct;
    } else {
      dayMap[day] = {
        day,
        reviewed: stored.reviewed,
        correct: stored.correct,
      };
    }
  }

  return {
    sessions: Object.values(dayMap).sort((a, b) => b.day.localeCompare(a.day)),
    didMigrate,
  };
}

// See sessionStore.ts. Dedupes concurrent first-load calls.
const queue = createStoreQueue();

export const useFlashcardSessionStore = create<FlashcardSessionStore>((set, get) => ({
  sessions: [],
  loaded: false,
  loadError: false,

  loadSessions: async () => {
    if (get().loaded) return;
    set({ loadError: false });
    return queue.runLoad(async () => {
      if (get().loaded) return;
      try {
        const stored = await AsyncStorage.getItem('flashcardSessions');
        if (stored) {
          let parsed: ReturnType<typeof parseStoredFlashcardSessions> = null;
          try {
            parsed = parseStoredFlashcardSessions(JSON.parse(stored));
          } catch {
            // Treat malformed JSON as per-key corruption.
          }
          if (!parsed) {
            console.warn('Discarding corrupt flashcard sessions');
            const removed = await safeRemoveItem('flashcardSessions');
            if (!removed) {
              set({ loadError: true });
              return;
            }
            set({ sessions: [], loaded: true, loadError: false });
            return;
          }
          set({ sessions: parsed.sessions, loaded: true, loadError: false });
          if (parsed.didMigrate) {
            await safeSetItem('flashcardSessions', JSON.stringify(parsed.sessions));
          }
        } else {
          set({ loaded: true, loadError: false });
        }
      } catch (e) {
        // Leave loaded: false so saveSession refuses to write rather
        // than overwriting historical session data with an empty merge.
        console.warn('Failed to load flashcard sessions:', e);
        set({ loadError: true });
      }
    });
  },

  saveSession: async (session) => {
    if (!get().loaded) {
      await get().loadSessions();
    }
    if (!get().loaded) {
      throw new Error('Cannot save flashcard session: store never loaded');
    }

    return queue.enqueue(async () => {
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
    return queue.enqueue(async () => {
      const removed = await safeRemoveItem('flashcardSessions');
      if (!removed) {
        console.warn('Failed to clear flashcard sessions');
        return false;
      }
      set({ sessions: [], loaded: true, loadError: false });
      return true;
    });
  },
}));

export function __resetFlashcardSessionStoreForTests() {
  queue.reset();
  useFlashcardSessionStore.setState({ sessions: [], loaded: false, loadError: false });
}
