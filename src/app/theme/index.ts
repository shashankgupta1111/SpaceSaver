export * from './colors';
export * from './typography';
export * from './spacing';

import {lightColors, darkColors, ColorScheme} from './colors';
import {typography} from './typography';
import {spacing, borderRadius, elevation} from './spacing';

export const createTheme = (isDark: boolean) => ({
  // Cast collapses the `typeof lightColors | ColorScheme` union to one shape so
  // consumers get a single, stable colors type (gradients stay tuples).
  colors: (isDark ? darkColors : lightColors) as ColorScheme,
  typography,
  spacing,
  borderRadius,
  elevation,
  isDark,
});

export type Theme = ReturnType<typeof createTheme>;
export type {ColorScheme};
