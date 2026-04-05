import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ThemeStore {
  isDark: boolean;
  autoTTS: boolean;
  loaded: boolean;
  loadTheme: () => Promise<void>;
  toggleTheme: () => Promise<void>;
  toggleAutoTTS: () => Promise<void>;
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  isDark: false,
  autoTTS: false,
  loaded: false,

  loadTheme: async () => {
    try {
      const stored = await AsyncStorage.getItem('theme_mode');
      const tts = await AsyncStorage.getItem('auto_tts');
      set({
        isDark: stored === 'dark',
        autoTTS: tts === 'true',
        loaded: true,
      });
    } catch (e) {
      console.warn('Failed to load theme:', e);
      set({ loaded: true });
    }
  },

  toggleTheme: async () => {
    const newIsDark = !get().isDark;
    set({ isDark: newIsDark });
    await AsyncStorage.setItem('theme_mode', newIsDark ? 'dark' : 'light');
  },

  toggleAutoTTS: async () => {
    const newAutoTTS = !get().autoTTS;
    set({ autoTTS: newAutoTTS });
    await AsyncStorage.setItem('auto_tts', newAutoTTS ? 'true' : 'false');
  },
}));