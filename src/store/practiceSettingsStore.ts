import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeRemoveItem, safeSetItem } from '../utils/safeStorage';
import { createStoreQueue } from '../utils/storeQueue';
import { practiceTenses, type Tense, type VerbLevel } from '../utils/conjugate';

interface PracticeSettingsStore {
  activeTenses: Tense[];
  activeLevels: VerbLevel[];
  loaded: boolean;
  loadPracticeSettings: () => Promise<void>;
  setActiveTenses: (tenses: Tense[]) => Promise<void>;
  setActiveLevels: (levels: VerbLevel[]) => Promise<void>;
  toggleTense: (tense: Tense) => Promise<void>;
  toggleLevel: (level: VerbLevel) => Promise<void>;
  resetPracticeSettings: () => Promise<boolean>;
}

const allTenses: Tense[] = [...practiceTenses];

const allLevels: VerbLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const queue = createStoreQueue();

function parseStoredSubset<T>(value: unknown, valid: T[]): T[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((item): item is T => valid.includes(item as T));
}

export const usePracticeSettingsStore = create<PracticeSettingsStore>((set, get) => ({
  activeTenses: [...allTenses],
  activeLevels: [...allLevels],
  loaded: false,

  loadPracticeSettings: async () => {
    // The loaded guard matters beyond avoiding I/O: every screen calls this
    // on mount, and re-setting fresh array identities re-fires the question/
    // card generation effects on still-mounted sibling screens.
    if (get().loaded) return;
    return queue.runLoad(async () => {
      if (get().loaded) return;
      try {
        const stored = await AsyncStorage.getItem('practiceSettings');
        const parsed = stored ? JSON.parse(stored) : {};
        const tenses = parseStoredSubset(parsed?.activeTenses, allTenses);
        const levels = parseStoredSubset(parsed?.activeLevels, allLevels);
        set({
          activeTenses: tenses ?? [...allTenses],
          activeLevels: levels ?? [...allLevels],
          loaded: true,
        });
      } catch (e) {
        // Fall back to defaults and mark loaded: quiz/flashcard generation
        // gates on loaded with no retry UI, and default settings are a
        // recoverable preference, unlike user data.
        console.warn('Failed to load practice settings:', e);
        set({ loaded: true });
      }
    });
  },

  setActiveTenses: async (tenses) => {
    if (!get().loaded) {
      await get().loadPracticeSettings();
    }
    return queue.enqueue(async () => {
      set({ activeTenses: [...tenses] });
      await persistSnapshot(get);
    });
  },

  setActiveLevels: async (levels) => {
    if (!get().loaded) {
      await get().loadPracticeSettings();
    }
    return queue.enqueue(async () => {
      set({ activeLevels: [...levels] });
      await persistSnapshot(get);
    });
  },

  toggleTense: async (tense) => {
    if (!get().loaded) {
      await get().loadPracticeSettings();
    }
    return queue.enqueue(async () => {
      const current = get().activeTenses;
      let updated: Tense[];
      if (current.includes(tense)) {
        updated = current.filter(t => t !== tense);
      } else {
        updated = [...current, tense];
      }
      set({ activeTenses: updated });
      await persistSnapshot(get);
    });
  },

  toggleLevel: async (level) => {
    if (!get().loaded) {
      await get().loadPracticeSettings();
    }
    return queue.enqueue(async () => {
      const current = get().activeLevels;
      let updated: VerbLevel[];
      if (current.includes(level)) {
        updated = current.filter(l => l !== level);
      } else {
        updated = [...current, level];
      }
      set({ activeLevels: updated });
      await persistSnapshot(get);
    });
  },

  resetPracticeSettings: async () => {
    return queue.enqueue(async () => {
      const removed = await safeRemoveItem('practiceSettings');
      if (!removed) {
        console.warn('Failed to reset practice settings');
        return false;
      }
      set({
        activeTenses: [...allTenses],
        activeLevels: [...allLevels],
        loaded: true,
      });
      return true;
    });
  },
}));

// Persist the full in-memory snapshot. The store state is the source of
// truth; re-reading disk here (the old patch-merge approach) let two quick
// toggles overwrite each other's field with stale data.
async function persistSnapshot(get: () => PracticeSettingsStore) {
  const { activeTenses, activeLevels } = get();
  const persisted = await safeSetItem(
    'practiceSettings',
    JSON.stringify({ activeTenses, activeLevels }),
  );
  if (!persisted) {
    console.warn('Practice settings not persisted; will revert on next launch');
  }
}

export function __resetPracticeSettingsStoreForTests() {
  queue.reset();
  usePracticeSettingsStore.setState({
    activeTenses: [...allTenses],
    activeLevels: [...allLevels],
    loaded: false,
  });
}

export { allTenses, allLevels };
