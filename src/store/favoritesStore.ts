import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface FavoritesStore {
  favorites: string[];
  loaded: boolean;
  loadFavorites: () => Promise<void>;
  toggleFavorite: (infinitive: string) => Promise<void>;
  isFavorite: (infinitive: string) => boolean;
}

export const useFavoritesStore = create<FavoritesStore>((set, get) => ({
  favorites: [],
  loaded: false,

  loadFavorites: async () => {
    try {
      const stored = await AsyncStorage.getItem('favorites');
      if (stored) {
        set({ favorites: JSON.parse(stored), loaded: true });
      } else {
        set({ loaded: true });
      }
    } catch {
      set({ loaded: true });
    }
  },

  toggleFavorite: async (infinitive: string) => {
    const current = get().favorites;
    const updated = current.includes(infinitive)
      ? current.filter((v) => v !== infinitive)
      : [infinitive, ...current];
    set({ favorites: updated });
    await AsyncStorage.setItem('favorites', JSON.stringify(updated));
  },

  isFavorite: (infinitive: string) => {
    return get().favorites.includes(infinitive);
  },
}));