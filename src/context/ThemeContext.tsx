/**
 * Theme Context — Global dynamic theme and dark mode provider for Nexus.
 * Provides colors, isDark flag, and useThemedStyles hook for reactive styling.
 */
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useColorScheme, Appearance, ColorSchemeName } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Colors, DarkColors, ThemeColors } from '../constants/theme';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  themeMode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const THEME_STORAGE_KEY = 'nexus_theme_mode';

const ThemeContext = createContext<ThemeContextValue>({
  themeMode: 'system',
  isDark: false,
  colors: Colors,
  setThemeMode: () => {},
  toggleTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const hookScheme = useColorScheme();
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(
    Appearance.getColorScheme() || hookScheme || 'light'
  );
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');

  // Listen to OS-level Appearance change events in real time
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      if (colorScheme) {
        setSystemScheme(colorScheme);
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (hookScheme) {
      setSystemScheme(hookScheme);
    }
  }, [hookScheme]);

  useEffect(() => {
    SecureStore.getItemAsync(THEME_STORAGE_KEY)
      .then((saved) => {
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          setThemeModeState(saved as ThemeMode);
        }
      })
      .catch(() => {});
  }, []);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    SecureStore.setItemAsync(THEME_STORAGE_KEY, mode).catch(() => {});
  }, []);

  const isDark = useMemo(() => {
    if (themeMode === 'system') {
      const activeSys = systemScheme || Appearance.getColorScheme() || 'light';
      return activeSys === 'dark';
    }
    return themeMode === 'dark';
  }, [themeMode, systemScheme]);

  const toggleTheme = useCallback(() => {
    setThemeMode(isDark ? 'light' : 'dark');
  }, [isDark, setThemeMode]);

  const colors = useMemo(() => {
    return isDark ? DarkColors : Colors;
  }, [isDark]);

  const value = useMemo(
    () => ({
      themeMode,
      isDark,
      colors,
      setThemeMode,
      toggleTheme,
    }),
    [themeMode, isDark, colors, setThemeMode, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);

export function useThemedStyles<T extends Record<string, any>>(
  styleFactory: (colors: ThemeColors, isDark: boolean) => T
): T {
  const { colors, isDark } = useTheme();
  return useMemo(() => styleFactory(colors, isDark), [colors, isDark, styleFactory]);
}

export default ThemeContext;
