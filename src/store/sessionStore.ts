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

export interface Session {
  day: string; // 'YYYY-MM-DD'
  total: number;
  correct: number;
  streak: number;
}

interface SessionStore {
  sessions: Session[];
  loaded: boolean;
  loadError: boolean;
  loadSessions: () => Promise<void>;
  saveSession: (session: Omit<Session, 'day'>) => Promise<void>;
  clearSessions: () => Promise<boolean>;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

export function parseStoredQuizSessions(
  value: unknown,
): { sessions: Session[]; didMigrate: boolean } | null {
  if (!Array.isArray(value)) return null;
  const dayMap: Record<string, Session> = {};
  let didMigrate = false;

  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const stored = raw as Record<string, unknown>;
    if (
      !isNonNegativeInteger(stored.total)
      || !isNonNegativeInteger(stored.correct)
      || !isNonNegativeInteger(stored.streak ?? 0)
      || stored.correct > stored.total
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

    const streak = isNonNegativeInteger(stored.streak) ? stored.streak : 0;
    if (dayMap[day]) {
      didMigrate = true;
      dayMap[day].total += stored.total;
      dayMap[day].correct += stored.correct;
      dayMap[day].streak = Math.max(dayMap[day].streak, streak);
    } else {
      dayMap[day] = {
        day,
        total: stored.total,
        correct: stored.correct,
        streak,
      };
    }
  }

  return {
    sessions: Object.values(dayMap).sort((a, b) => b.day.localeCompare(a.day)),
    didMigrate,
  };
}

// Dedupes concurrent first-load calls from multiple screens.
const queue = createStoreQueue();

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  loaded: false,
  loadError: false,

  loadSessions: async () => {
    if (get().loaded) return;
    set({ loadError: false });
    return queue.runLoad(async () => {
      if (get().loaded) return;
      try {
        const stored = await AsyncStorage.getItem('sessions');
        if (stored) {
          let parsed: ReturnType<typeof parseStoredQuizSessions> = null;
          try {
            parsed = parseStoredQuizSessions(JSON.parse(stored));
          } catch {
            // Treat malformed JSON as per-key corruption.
          }
          if (!parsed) {
            console.warn('Discarding corrupt quiz sessions');
            const removed = await safeRemoveItem('sessions');
            if (!removed) {
              set({ loadError: true });
              return;
            }
            set({ sessions: [], loaded: true, loadError: false });
            return;
          }
          set({ sessions: parsed.sessions, loaded: true, loadError: false });
          if (parsed.didMigrate) {
            await safeSetItem('sessions', JSON.stringify(parsed.sessions));
          }
        } else {
          set({ loaded: true, loadError: false });
        }
      } catch (e) {
        // Leave loaded: false so saveSession refuses to write rather
        // than overwriting historical session data with just today's
        // delta merged into an empty in-memory list.
        console.warn('Failed to load sessions:', e);
        set({ loadError: true });
      }
    });
  },

  saveSession: async (session) => {
    if (!get().loaded) {
      await get().loadSessions();
    }
    if (!get().loaded) {
      throw new Error('Cannot save quiz session: store never loaded');
    }

    return queue.enqueue(async () => {
      const today = getTodayKey();
      const current = get().sessions;
      const existingIndex = current.findIndex(s => s.day === today);

      let updated: Session[];
      if (existingIndex >= 0) {
        // Merge into today's existing record
        updated = [...current];
        updated[existingIndex] = {
          day: today,
          total: updated[existingIndex].total + session.total,
          correct: updated[existingIndex].correct + session.correct,
          streak: Math.max(updated[existingIndex].streak, session.streak),
        };
      } else {
        // New day
        updated = [{ ...session, day: today }, ...current].slice(0, MAX_DAILY_SESSIONS);
      }

      const persisted = await safeSetItem('sessions', JSON.stringify(updated));
      if (!persisted) {
        throw new Error('Failed to persist quiz session');
      }
      set({ sessions: updated });
    });
  },

  clearSessions: async () => {
    return queue.enqueue(async () => {
      const removed = await safeRemoveItem('sessions');
      if (!removed) {
        console.warn('Failed to clear quiz sessions');
        return false;
      }
      set({ sessions: [], loaded: true, loadError: false });
      return true;
    });
  },
}));

export function __resetSessionStoreForTests() {
  queue.reset();
  useSessionStore.setState({ sessions: [], loaded: false, loadError: false });
}
