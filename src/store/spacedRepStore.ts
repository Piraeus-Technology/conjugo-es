import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeRemoveItem, safeSetItem } from '../utils/safeStorage';
import { createStoreQueue } from '../utils/storeQueue';
import { Tense } from '../utils/conjugate';

// Track how well the user knows each verb
// weight: higher = more likely to appear (user struggles with it)
interface VerbWeight {
  [verbInfinitive: string]: number;
}

interface SpacedRepStore {
  weights: VerbWeight;
  loaded: boolean;
  loadError: boolean;
  loadWeights: () => Promise<void>;
  recordResult: (verb: string, tense: Tense, personIndex: number, correct: boolean) => Promise<void>;
  getWeight: (verb: string, tense: Tense, personIndex: number) => number;
  resetWeights: () => Promise<boolean>;
}

const DEFAULT_WEIGHT = 1;
const MIN_WEIGHT = 0.2;
const MAX_WEIGHT = 5;
const PROMPT_KEY_SEPARATOR = '::';

export function parseStoredWeights(value: unknown): VerbWeight | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const entries = Object.entries(value);
  if (
    entries.some(
      ([key, weight]) =>
        key.length === 0
        || typeof weight !== 'number'
        || !Number.isFinite(weight)
        || weight <= 0,
    )
  ) {
    return null;
  }
  return Object.fromEntries(entries) as VerbWeight;
}

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

  // Legacy weights were stored by infinitive only and stay as the fallback
  // for this verb's OTHER prompts (getStoredWeight prefers the prompt key).
  // Deleting the verb weight here used to reset ~90 sibling prompts of a
  // struggling verb back to the default after a single answer.

  return nextWeights;
}

// Dedupes concurrent first-load calls and serializes writes against loads
// (prevents loadWeights from stomping a just-recorded result).
const queue = createStoreQueue();

export const useSpacedRepStore = create<SpacedRepStore>((set, get) => ({
  weights: {},
  loaded: false,
  loadError: false,

  loadWeights: async () => {
    if (get().loaded) return;
    set({ loadError: false });
    return queue.runLoad(async () => {
      if (get().loaded) return;
      try {
        const stored = await AsyncStorage.getItem('spaced_rep_weights');
        if (stored) {
          let weights: VerbWeight | null = null;
          try {
            weights = parseStoredWeights(JSON.parse(stored));
          } catch {
            // Treat malformed JSON as per-key corruption.
          }
          if (!weights) {
            console.warn('Discarding corrupt spaced repetition weights');
            const removed = await safeRemoveItem('spaced_rep_weights');
            if (!removed) {
              set({ loadError: true });
              return;
            }
            set({ weights: {}, loaded: true, loadError: false });
            return;
          }
          set({ weights, loaded: true, loadError: false });
        } else {
          set({ loaded: true, loadError: false });
        }
      } catch (e) {
        // Leave loaded: false so the next call retries instead of
        // writing zero-defaults over the user's real weights on disk.
        console.warn('Failed to load spaced rep weights:', e);
        set({ loadError: true });
      }
    });
  },

  recordResult: async (verb: string, tense: Tense, personIndex: number, correct: boolean) => {
    if (!get().loaded) {
      await get().loadWeights();
    }
    if (!get().loaded) {
      // Load failed — refuse to write to avoid clobbering existing weights.
      console.warn('Skipping spaced rep result persistence: store never loaded');
      return;
    }
    return queue.enqueue(async () => {
      const weights = applyPromptResult(get().weights, verb, tense, personIndex, correct);
      const persisted = await safeSetItem('spaced_rep_weights', JSON.stringify(weights));
      if (!persisted) {
        // Leave in-memory aligned with disk on transient persist failure.
        console.warn('Failed to persist spaced rep weights');
        return;
      }
      set({ weights });
    });
  },

  getWeight: (verb: string, tense: Tense, personIndex: number) => {
    return getStoredWeight(get().weights, verb, tense, personIndex);
  },

  resetWeights: async () => {
    return queue.enqueue(async () => {
      const removed = await safeRemoveItem('spaced_rep_weights');
      if (!removed) {
        console.warn('Failed to reset spaced repetition weights');
        return false;
      }
      set({ weights: {}, loaded: true, loadError: false });
      return true;
    });
  },
}));

export function __resetSpacedRepStoreForTests() {
  queue.reset();
  useSpacedRepStore.setState({ weights: {}, loaded: false, loadError: false });
}
