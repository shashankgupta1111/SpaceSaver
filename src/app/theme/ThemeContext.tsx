import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  ReactNode,
} from 'react';
import {useColorScheme, StatusBar} from 'react-native';
import {MMKV} from 'react-native-mmkv';
import {createTheme, Theme} from './index';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: Theme;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const storage = new MMKV({id: 'theme-storage'});

export function ThemeProvider({children}: {children: ReactNode}) {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>(
    () => (storage.getString('themeMode') as ThemeMode) ?? 'system',
  );

  const isDark = useMemo(() => {
    if (themeMode === 'system') {
      return systemColorScheme === 'dark';
    }
    return themeMode === 'dark';
  }, [themeMode, systemColorScheme]);

  const theme = useMemo(() => createTheme(isDark), [isDark]);

  const setThemeMode = (mode: ThemeMode) => {
    storage.set('themeMode', mode);
    setThemeModeState(mode);
  };

  useEffect(() => {
    StatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content', true);
    StatusBar.setBackgroundColor(theme.colors.background, true);
  }, [isDark, theme.colors.background]);

  return (
    <ThemeContext.Provider value={{theme, themeMode, setThemeMode, isDark}}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
