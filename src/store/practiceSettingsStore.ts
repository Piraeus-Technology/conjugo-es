import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeSetItem } from '../utils/safeStorage';
import type { Tense, VerbLevel } from '../utils/conjugate';

interface PracticeSettingsStore {
  activeTenses: Tense[];
  activeLevels: VerbLevel[];
  loaded: boolean;
  loadPracticeSettings: () => Promise<void>;
  setActiveTenses: (tenses: Tense[]) => Promise<void>;
  setActiveLevels: (levels: VerbLevel[]) => Promise<void>;
  toggleTense: (tense: Tense) => Promise<void>;
  toggleLevel: (level: VerbLevel) => Promise<void>;
}

const allTenses: Tense[] = [
  'present', 'preterite', 'imperfect', 'future', 'conditional',
  'subjunctive_present', 'subjunctive_imperfect',
  'imperative_affirmative', 'imperative_negative',
  'present_perfect', 'past_perfect', 'future_perfect', 'conditional_perfect',
  'present_progressive', 'past_progressive',
];

const allLevels: VerbLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export const usePracticeSettingsStore = create<PracticeSettingsStore>((set, get) => ({
  activeTenses: [...allTenses],
  activeLevels: [...allLevels],
  loaded: false,

  loadPracticeSettings: async () => {
    try {
      const stored = await AsyncStorage.getItem('practiceSettings');
      if (stored) {
        const parsed = JSON.parse(stored);
        set({
          activeTenses: parsed.activeTenses || [...allTenses],
          activeLevels: parsed.activeLevels || [...allLevels],
          loaded: true,
        });
      } else {
        set({ loaded: true });
      }
    } catch (e) {
      console.warn('Failed to load practice settings:', e);
      set({ loaded: true });
    }
  },

  setActiveTenses: async (tenses) => {
    const safe = tenses.length > 0 ? tenses : ['present' as Tense];
    set({ activeTenses: safe });
    await persistSettings({ activeTenses: safe });
  },

  setActiveLevels: async (levels) => {
    const safe = levels.length > 0 ? levels : ['A1' as VerbLevel];
    set({ activeLevels: safe });
    await persistSettings({ activeLevels: safe });
  },

  toggleTense: async (tense) => {
    const current = get().activeTenses;
    let updated: Tense[];
    if (current.includes(tense)) {
      if (current.length <= 1) return;
      updated = current.filter(t => t !== tense);
    } else {
      updated = [...current, tense];
    }
    set({ activeTenses: updated });
    await persistSettings({ activeTenses: updated });
  },

  toggleLevel: async (level) => {
    const current = get().activeLevels;
    let updated: VerbLevel[];
    if (current.includes(level)) {
      if (current.length <= 1) return;
      updated = current.filter(l => l !== level);
    } else {
      updated = [...current, level];
    }
    set({ activeLevels: updated });
    await persistSettings({ activeLevels: updated });
  },
}));

async function persistSettings(patch: Partial<{ activeTenses: Tense[]; activeLevels: VerbLevel[] }>) {
  try {
    const stored = await AsyncStorage.getItem('practiceSettings');
    const settings = stored ? JSON.parse(stored) : {};
    Object.assign(settings, patch);
    await safeSetItem('practiceSettings', JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to persist practice settings:', e);
  }
}

export { allTenses, allLevels };
