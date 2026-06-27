export * from './colors';
export * from './typography';
export * from './spacing';

import {lightColors, darkColors, ColorScheme} from './colors';
import {typography} from './typography';
import {spacing, borderRadius, elevation} from './spacing';

export const createTheme = (isDark: boolean) => ({
  colors: isDark ? darkColors : lightColors,
  typography,
  spacing,
  borderRadius,
  elevation,
  isDark,
});

export type Theme = ReturnType<typeof createTheme>;
export type {ColorScheme};
