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
  loadError: boolean;
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

// Module-scoped to dedupe concurrent first-load calls and serialize writes
// against loads (prevents loadWeights from stomping a just-recorded result).
let loadPromise: Promise<void> | null = null;
let operationQueue: Promise<void> = Promise.resolve();

function enqueueOperation(operation: () => Promise<void>): Promise<void> {
  const next = operationQueue.catch(() => undefined).then(operation);
  operationQueue = next.catch(() => undefined);
  return next;
}

export const useSpacedRepStore = create<SpacedRepStore>((set, get) => ({
  weights: {},
  loaded: false,
  loadError: false,

  loadWeights: async () => {
    if (get().loaded) return;
    if (loadPromise) return loadPromise;
    set({ loadError: false });
    const attempt = enqueueOperation(async () => {
      if (get().loaded) return;
      try {
        const stored = await AsyncStorage.getItem('spaced_rep_weights');
        if (stored) {
          set({ weights: JSON.parse(stored), loaded: true, loadError: false });
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
    const wrapped: Promise<void> = attempt.finally(() => {
      if (loadPromise === wrapped) loadPromise = null;
    });
    loadPromise = wrapped;
    return loadPromise;
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
    return enqueueOperation(async () => {
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
    return enqueueOperation(async () => {
      set({ weights: {}, loaded: true, loadError: false });
      loadPromise = null;
      await safeRemoveItem('spaced_rep_weights');
    });
  },
}));

export function __resetSpacedRepStoreForTests() {
  loadPromise = null;
  operationQueue = Promise.resolve();
  useSpacedRepStore.setState({ weights: {}, loaded: false, loadError: false });
}
