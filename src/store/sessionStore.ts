import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeRemoveItem, safeSetItem } from '../utils/safeStorage';
import { createStoreQueue } from '../utils/storeQueue';
import { getTodayKey, timestampToDayKey } from '../utils/dayKey';
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
  clearSessions: () => Promise<void>;
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
          const parsed = JSON.parse(stored);
          // Migrate old format (date: timestamp) to new format (day: 'YYYY-MM-DD').
          // Only write back if we actually transformed something.
          const dayMap: Record<string, Session> = {};
          let didMigrate = false;
          for (const s of parsed) {
            if (!s.day) didMigrate = true;
            const day = s.day || timestampToDayKey(s.date);
            if (dayMap[day]) {
              didMigrate = true;
              dayMap[day].total += s.total;
              dayMap[day].correct += s.correct;
              dayMap[day].streak = Math.max(dayMap[day].streak, s.streak || 0);
            } else {
              dayMap[day] = { day, total: s.total, correct: s.correct, streak: s.streak || 0 };
            }
          }
          const sessions = Object.values(dayMap).sort((a, b) => b.day.localeCompare(a.day));
          set({ sessions, loaded: true, loadError: false });
          if (didMigrate) {
            await safeSetItem('sessions', JSON.stringify(sessions));
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
      set({ sessions: [], loaded: true, loadError: false });
      await safeRemoveItem('sessions');
    });
  },
}));

export function __resetSessionStoreForTests() {
  queue.reset();
  useSessionStore.setState({ sessions: [], loaded: false, loadError: false });
}
