import { useThemeStore } from '../store/themeStore';

const lightColors = {
  primary: '#C8102E',
  primaryLight: '#E8384F',
  primaryDark: '#A00D24',

  accent: '#F4B942',
  accentLight: '#FCEABB',

  bg: '#FAFAFA',
  card: '#FFFFFF',
  searchBg: '#F0EEEB',

  textPrimary: '#1A1A1A',
  textSecondary: '#6B6B6B',
  textMuted: '#9E9E9E',

  border: '#E8E5E0',
  divider: '#F0EEEB',

  pillBg: '#F0EEEB',
  pillActiveBg: '#C8102E',
  pillText: '#4A4A4A',
  pillActiveText: '#FFFFFF',

  regularTag: '#E8F5E9',
  regularTagText: '#2E7D32',
  irregularTag: '#FFF3E0',
  irregularTagText: '#E65100',

  levelA1Bg: '#E0F7FA', levelA1Text: '#00838F',
  levelA2Bg: '#E0F2F1', levelA2Text: '#00695C',
  levelB1Bg: '#E3F2FD', levelB1Text: '#1565C0',
  levelB2Bg: '#EDE7F6', levelB2Text: '#4527A0',
  levelC1Bg: '#FCE4EC', levelC1Text: '#AD1457',
  levelC2Bg: '#F3E5F5', levelC2Text: '#6A1B9A',
};

const darkColors = {
  primary: '#E8384F',
  primaryLight: '#FF5A6E',
  primaryDark: '#FF6B7A',

  accent: '#F4B942',
  accentLight: '#3D2E0A',

  bg: '#121212',
  card: '#1E1E1E',
  searchBg: '#2A2A2A',

  textPrimary: '#F0F0F0',
  textSecondary: '#A0A0A0',
  textMuted: '#666666',

  border: '#333333',
  divider: '#2A2A2A',

  pillBg: '#2A2A2A',
  pillActiveBg: '#E8384F',
  pillText: '#A0A0A0',
  pillActiveText: '#FFFFFF',

  regularTag: '#1B3A1B',
  regularTagText: '#66BB6A',
  irregularTag: '#3E2200',
  irregularTagText: '#FFB74D',

  levelA1Bg: '#0A2E30', levelA1Text: '#4DD0E1',
  levelA2Bg: '#0D2E2B', levelA2Text: '#4DB6AC',
  levelB1Bg: '#0D2137', levelB1Text: '#64B5F6',
  levelB2Bg: '#1A1035', levelB2Text: '#B39DDB',
  levelC1Bg: '#2D0E1E', levelC1Text: '#F48FB1',
  levelC2Bg: '#1F0D2B', levelC2Text: '#CE93D8',
};

export type ThemeColors = typeof lightColors;

export const themes = { light: lightColors, dark: darkColors };

export function useColors(): ThemeColors {
  const isDark = useThemeStore((s) => s.isDark);
  return isDark ? darkColors : lightColors;
}

// Static export for places that can't use hooks (like building the conjugation index)
export const colors = lightColors;

export const fonts = {
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 24,
    xxl: 32,
    hero: 40,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  full: 999,
};