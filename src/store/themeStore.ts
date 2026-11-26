import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeRemoveItem, safeSetItem } from '../utils/safeStorage';
import { createStoreQueue } from '../utils/storeQueue';

interface ThemeStore {
  isDark: boolean;
  deviceIsDark: boolean;
  themeOverride: boolean | null;
  autoTTS: boolean;
  includeVosotros: boolean;
  loaded: boolean;
  loadTheme: () => Promise<void>;
  setDeviceTheme: (isDark: boolean) => void;
  toggleTheme: () => Promise<void>;
  toggleAutoTTS: () => Promise<void>;
  toggleVosotros: () => Promise<void>;
  resetPreferences: () => Promise<boolean>;
}

const queue = createStoreQueue();

export const useThemeStore = create<ThemeStore>((set, get) => ({
  isDark: false,
  deviceIsDark: false,
  themeOverride: null,
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
        const themeOverride = stored === 'dark' ? true : stored === 'light' ? false : null;
        set({
          isDark: themeOverride ?? get().deviceIsDark,
          themeOverride,
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

  setDeviceTheme: (deviceIsDark) => set(state => ({
    deviceIsDark,
    isDark: state.themeOverride ?? deviceIsDark,
  })),

  toggleTheme: async () => {
    return queue.enqueue(async () => {
      const newIsDark = !get().isDark;
      set({ isDark: newIsDark, themeOverride: newIsDark });
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
        isDark: get().deviceIsDark,
        themeOverride: null,
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
  useThemeStore.setState({ isDark: false, deviceIsDark: false, themeOverride: null,
    autoTTS: false, includeVosotros: true, loaded: false });
}
