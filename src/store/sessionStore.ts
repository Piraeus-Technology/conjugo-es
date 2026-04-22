import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeRemoveItem, safeSetItem } from '../utils/safeStorage';
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
  loadSessions: () => Promise<void>;
  saveSession: (session: Omit<Session, 'day'>) => Promise<void>;
  clearSessions: () => Promise<void>;
}

function getTodayKey(): string {
  return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
}

// Module-scoped to dedupe concurrent first-load calls from multiple screens.
let loadPromise: Promise<void> | null = null;
let operationQueue: Promise<void> = Promise.resolve();

function enqueueOperation(operation: () => Promise<void>): Promise<void> {
  const next = operationQueue.catch(() => undefined).then(operation);
  operationQueue = next.catch(() => undefined);
  return next;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  loaded: false,

  loadSessions: async () => {
    if (get().loaded) return;
    if (loadPromise) return loadPromise;
    loadPromise = enqueueOperation(async () => {
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
            const day = s.day || new Date(s.date).toLocaleDateString('en-CA');
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
          set({ sessions, loaded: true });
          if (didMigrate) {
            await safeSetItem('sessions', JSON.stringify(sessions));
          }
        } else {
          set({ loaded: true });
        }
      } catch (e) {
        console.warn('Failed to load sessions:', e);
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
    return enqueueOperation(async () => {
      set({ sessions: [], loaded: true });
      loadPromise = null;
      await safeRemoveItem('sessions');
    });
  },
}));
