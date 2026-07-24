import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeRemoveItem, safeSetItem } from '../utils/safeStorage';
import { createStoreQueue, parseStoredStringArray } from '../utils/storeQueue';

interface FavoritesStore {
  favorites: string[];
  loaded: boolean;
  loadError: boolean;
  loadFavorites: () => Promise<void>;
  toggleFavorite: (infinitive: string) => Promise<void>;
  clearFavorites: () => Promise<boolean>;
  isFavorite: (infinitive: string) => boolean;
}

const queue = createStoreQueue();

export const useFavoritesStore = create<FavoritesStore>((set, get) => ({
  favorites: [],
  loaded: false,
  loadError: false,

  loadFavorites: async () => {
    if (get().loaded) return;
    set({ loadError: false });
    return queue.runLoad(async () => {
      if (get().loaded) return;
      try {
        const stored = await AsyncStorage.getItem('favorites');
        set({ favorites: parseStoredStringArray(stored), loaded: true, loadError: false });
      } catch (e) {
        // Don't set loaded: true — that would let the next toggle persist
        // the empty default over the user's real (but currently unreadable)
        // favorites on disk. Leave loaded: false so the next call retries.
        console.warn('Failed to load favorites:', e);
        set({ loadError: true });
      }
    });
  },

  toggleFavorite: async (infinitive: string) => {
    if (!get().loaded) {
      await get().loadFavorites();
    }
    if (!get().loaded) {
      console.warn('Skipping favorite toggle: store never loaded');
      return;
    }
    return queue.enqueue(async () => {
      const current = get().favorites;
      const updated = current.includes(infinitive)
        ? current.filter((v) => v !== infinitive)
        : [infinitive, ...current];
      const persisted = await safeSetItem('favorites', JSON.stringify(updated));
      if (!persisted) {
        // Leave in-memory aligned with disk so a transient AsyncStorage
        // flake doesn't show a favorite that evaporates on next launch.
        console.warn('Failed to persist favorites');
        return;
      }
      set({ favorites: updated });
    });
  },

  clearFavorites: async () => {
    return queue.enqueue(async () => {
      const removed = await safeRemoveItem('favorites');
      if (!removed) {
        console.warn('Failed to clear favorites');
        return false;
      }
      set({ favorites: [], loaded: true, loadError: false });
      return true;
    });
  },

  isFavorite: (infinitive: string) => {
    return get().favorites.includes(infinitive);
  },
}));

export function __resetFavoritesStoreForTests() {
  queue.reset();
  useFavoritesStore.setState({ favorites: [], loaded: false, loadError: false });
}
