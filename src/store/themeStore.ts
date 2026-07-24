import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeRemoveItem, safeSetItem } from '../utils/safeStorage';
import { createStoreQueue } from '../utils/storeQueue';

interface ThemeStore {
  isDark: boolean;
  autoTTS: boolean;
  includeVosotros: boolean;
  loaded: boolean;
  loadTheme: () => Promise<void>;
  toggleTheme: () => Promise<void>;
  toggleAutoTTS: () => Promise<void>;
  toggleVosotros: () => Promise<void>;
  resetPreferences: () => Promise<boolean>;
}

const queue = createStoreQueue();

export const useThemeStore = create<ThemeStore>((set, get) => ({
  isDark: false,
  autoTTS: false,
  includeVosotros: true,
  loaded: false,

  loadTheme: async () => {
    if (get().loaded) return;
    return queue.runLoad(async () => {
      if (get().loaded) return;
      try {
        const stored = await AsyncStorage.getItem('theme_mode');
        const tts = await AsyncStorage.getItem('auto_tts');
        const vosotros = await AsyncStorage.getItem('include_vosotros');
        set({
          isDark: stored === 'dark',
          autoTTS: tts === 'true',
          includeVosotros: vosotros !== 'false',
          loaded: true,
        });
      } catch (e) {
        // Unlike the data stores, fall back to defaults and mark loaded:
        // App.tsx gates ALL rendering on loaded, so refusing here would
        // blank the app over three recoverable booleans.
        console.warn('Failed to load theme:', e);
        set({ loaded: true });
      }
    });
  },

  toggleTheme: async () => {
    return queue.enqueue(async () => {
      const newIsDark = !get().isDark;
      set({ isDark: newIsDark });
      if (!(await safeSetItem('theme_mode', newIsDark ? 'dark' : 'light'))) {
        console.warn('Theme preference not persisted; will revert on next launch');
      }
    });
  },

  toggleAutoTTS: async () => {
    return queue.enqueue(async () => {
      const newAutoTTS = !get().autoTTS;
      set({ autoTTS: newAutoTTS });
      if (!(await safeSetItem('auto_tts', newAutoTTS ? 'true' : 'false'))) {
        console.warn('Auto-TTS preference not persisted; will revert on next launch');
      }
    });
  },

  toggleVosotros: async () => {
    return queue.enqueue(async () => {
      const newVal = !get().includeVosotros;
      set({ includeVosotros: newVal });
      if (!(await safeSetItem('include_vosotros', newVal ? 'true' : 'false'))) {
        console.warn('Vosotros preference not persisted; will revert on next launch');
      }
    });
  },

  resetPreferences: async () => {
    return queue.enqueue(async () => {
      const removed = await Promise.all([
        safeRemoveItem('theme_mode'),
        safeRemoveItem('auto_tts'),
        safeRemoveItem('include_vosotros'),
      ]);
      if (removed.some((success) => !success)) {
        console.warn('Failed to reset one or more display preferences');
        return false;
      }
      set({
        isDark: false,
        autoTTS: false,
        includeVosotros: true,
        loaded: true,
      });
      return true;
    });
  },
}));

export function __resetThemeStoreForTests() {
  queue.reset();
  useThemeStore.setState({ isDark: false, autoTTS: false, includeVosotros: true, loaded: false });
}
