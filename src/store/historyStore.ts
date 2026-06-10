import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeRemoveItem, safeSetItem } from '../utils/safeStorage';
import { createStoreQueue, parseStoredStringArray } from '../utils/storeQueue';
import { MAX_HISTORY_SIZE } from '../utils/constants';

interface HistoryStore {
  history: string[];
  loaded: boolean;
  loadError: boolean;
  loadHistory: () => Promise<void>;
  addToHistory: (verb: string) => Promise<void>;
  removeFromHistory: (verb: string) => Promise<void>;
  clearHistory: () => Promise<void>;
}

const queue = createStoreQueue();

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  history: [],
  loaded: false,
  loadError: false,

  loadHistory: async () => {
    if (get().loaded) return;
    set({ loadError: false });
    return queue.runLoad(async () => {
      if (get().loaded) return;
      try {
        const stored = await AsyncStorage.getItem('verb_history');
        set({ history: parseStoredStringArray(stored), loaded: true, loadError: false });
      } catch (e) {
        // Don't set loaded: true — that would let the next write persist
        // the empty default over the user's real (but currently unreadable)
        // history on disk. Leave loaded: false so the next call retries.
        console.warn('Failed to load history:', e);
        set({ loadError: true });
      }
    });
  },

  addToHistory: async (verb: string) => {
    if (!get().loaded) {
      await get().loadHistory();
    }
    if (!get().loaded) {
      console.warn('Skipping history add: store never loaded');
      return;
    }
    return queue.enqueue(async () => {
      const current = get().history.filter((v) => v !== verb);
      const updated = [verb, ...current].slice(0, MAX_HISTORY_SIZE);
      const persisted = await safeSetItem('verb_history', JSON.stringify(updated));
      if (!persisted) {
        console.warn('Failed to persist history');
        return;
      }
      set({ history: updated });
    });
  },

  removeFromHistory: async (verb: string) => {
    if (!get().loaded) {
      await get().loadHistory();
    }
    if (!get().loaded) {
      console.warn('Skipping history removal: store never loaded');
      return;
    }
    return queue.enqueue(async () => {
      const updated = get().history.filter((v) => v !== verb);
      const persisted = await safeSetItem('verb_history', JSON.stringify(updated));
      if (!persisted) {
        console.warn('Failed to persist history');
        return;
      }
      set({ history: updated });
    });
  },

  clearHistory: async () => {
    // Intentional exception to the never-loaded write guard above. This is an
    // explicit user-initiated destructive action, not a write derived from the
    // possibly-default in-memory history, and it is the recovery path when the
    // on-disk history payload is unreadable. quizStore.resetStats follows the
    // same convention for user-requested deletion.
    return queue.enqueue(async () => {
      const removed = await safeRemoveItem('verb_history');
      if (!removed) {
        console.warn('Failed to clear history');
        return;
      }
      set({ history: [], loaded: true, loadError: false });
    });
  },
}));

export function __resetHistoryStoreForTests() {
  queue.reset();
  useHistoryStore.setState({ history: [], loaded: false, loadError: false });
}
