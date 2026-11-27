import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeSetItem } from '../utils/safeStorage';
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

export const beginnerTenses: Tense[] = ['present', 'preterite', 'imperfect', 'future', 'imperative_affirmative'];
export const beginnerLevels: VerbLevel[] = ['A1', 'A2'];

// These keys were written by 1.2.x independently of Practice Settings. Any
// surviving key is conservative evidence of an existing installation, even
// if its value is empty/corrupt. A never-used installation with no persisted
// state is indistinguishable from a new one.
const legacyKeys = ['quiz_stats', 'sessions', 'flashcardSessions', 'spaced_rep_weights',
  'favorites', 'verb_history', 'theme_mode', 'auto_tts', 'include_vosotros'];
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
    // The loaded guard preserves the current selection across screen mounts.
    if (get().loaded) return;
    return queue.runLoad(async () => {
      if (get().loaded) return;
      try {
        const stored = await AsyncStorage.getItem('practiceSettings');
        const legacyValues = stored === null
          ? await Promise.all(legacyKeys.map(key => AsyncStorage.getItem(key)))
          : [];
        const fresh = stored === null && legacyValues.every(value => value === null);
        const defaultTenses = fresh ? beginnerTenses : allTenses;
        const defaultLevels = fresh ? beginnerLevels : allLevels;
        const parsed = stored ? JSON.parse(stored) : {};
        const tenses = parseStoredSubset(parsed?.activeTenses, allTenses);
        const levels = parseStoredSubset(parsed?.activeLevels, allLevels);
        // Resolve and persist before App renders any screen that could write
        // history. Persist legacy defaults too, so later clearing history
        // cannot silently reclassify an existing learner as a beginner.
        const snapshot = {
          activeTenses: tenses ?? [...defaultTenses],
          activeLevels: levels ?? [...defaultLevels],
        };
        if (stored === null) await safeSetItem('practiceSettings', JSON.stringify(snapshot));
        set({
          activeTenses: tenses ?? [...defaultTenses],
          activeLevels: levels ?? [...defaultLevels],
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
    set({ activeTenses: [...tenses] });
    return queue.enqueue(() => persistSnapshot(get));
  },

  setActiveLevels: async (levels) => {
    if (!get().loaded) {
      await get().loadPracticeSettings();
    }
    set({ activeLevels: [...levels] });
    return queue.enqueue(() => persistSnapshot(get));
  },

  toggleTense: async (tense) => {
    if (!get().loaded) {
      await get().loadPracticeSettings();
    }
    const current = get().activeTenses;
    return get().setActiveTenses(current.includes(tense) ? current.filter(t => t !== tense) : [...current, tense]);
  },

  toggleLevel: async (level) => {
    if (!get().loaded) {
      await get().loadPracticeSettings();
    }
    const current = get().activeLevels;
    return get().setActiveLevels(current.includes(level) ? current.filter(l => l !== level) : [...current, level]);
  },

  resetPracticeSettings: async () => {
    return queue.enqueue(async () => {
      const persisted = await safeSetItem('practiceSettings', JSON.stringify({
        activeTenses: beginnerTenses, activeLevels: beginnerLevels,
      }));
      if (!persisted) {
        console.warn('Failed to reset practice settings');
        return false;
      }
      set({
        activeTenses: [...beginnerTenses],
        activeLevels: [...beginnerLevels],
        loaded: true,
      });
      return true;
    });
  },
}));

// Apply selections immediately so practice sees the last tap on return from
// settings. Serialize complete snapshots to preserve the current selection.
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
