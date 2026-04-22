import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeRemoveItem, safeSetItem } from '../utils/safeStorage';
import { Tense } from '../utils/conjugate';

// Track how well the user knows each verb
// weight: higher = more likely to appear (user struggles with it)
interface VerbWeight {
  [verbInfinitive: string]: number;
}

interface SpacedRepStore {
  weights: VerbWeight;
  loaded: boolean;
  loadWeights: () => Promise<void>;
  recordResult: (verb: string, tense: Tense, personIndex: number, correct: boolean) => Promise<void>;
  getWeight: (verb: string, tense: Tense, personIndex: number) => number;
  resetWeights: () => Promise<void>;
}

const DEFAULT_WEIGHT = 1;
const MIN_WEIGHT = 0.2;
const MAX_WEIGHT = 5;
const PROMPT_KEY_SEPARATOR = '::';

export function buildPromptKey(verb: string, tense: Tense, personIndex: number): string {
  return `${verb}${PROMPT_KEY_SEPARATOR}${tense}${PROMPT_KEY_SEPARATOR}${personIndex}`;
}

export function getStoredWeight(
  weights: VerbWeight,
  verb: string,
  tense: Tense,
  personIndex: number,
): number {
  const promptKey = buildPromptKey(verb, tense, personIndex);
  return weights[promptKey] ?? weights[verb] ?? DEFAULT_WEIGHT;
}

export function applyPromptResult(
  weights: VerbWeight,
  verb: string,
  tense: Tense,
  personIndex: number,
  correct: boolean,
): VerbWeight {
  const nextWeights = { ...weights };
  const promptKey = buildPromptKey(verb, tense, personIndex);
  const current = getStoredWeight(nextWeights, verb, tense, personIndex);

  nextWeights[promptKey] = correct
    ? Math.max(MIN_WEIGHT, current * 0.7)
    : Math.min(MAX_WEIGHT, current * 1.5);

  // Legacy weights were stored by infinitive only. Once an exact prompt has
  // history, let that more precise signal take over for the verb.
  delete nextWeights[verb];

  return nextWeights;
}

export const useSpacedRepStore = create<SpacedRepStore>((set, get) => ({
  weights: {},
  loaded: false,

  loadWeights: async () => {
    try {
      const stored = await AsyncStorage.getItem('spaced_rep_weights');
      if (stored) {
        set({ weights: JSON.parse(stored), loaded: true });
      } else {
        set({ loaded: true });
      }
    } catch (e) {
      console.warn('Failed to load spaced rep weights:', e);
      set({ loaded: true });
    }
  },

  recordResult: async (verb: string, tense: Tense, personIndex: number, correct: boolean) => {
    const weights = applyPromptResult(get().weights, verb, tense, personIndex, correct);
    set({ weights });
    await safeSetItem('spaced_rep_weights', JSON.stringify(weights));
  },

  getWeight: (verb: string, tense: Tense, personIndex: number) => {
    return getStoredWeight(get().weights, verb, tense, personIndex);
  },

  resetWeights: async () => {
    set({ weights: {} });
    await safeRemoveItem('spaced_rep_weights');
  },
}));
