import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import { darkColors, lightColors, type Colors } from './colors';
import { getSetting, setSetting } from '../repositories/settings';

export type ThemeMode = 'system' | 'light' | 'dark';

type ThemeContextValue = {
  colors: Colors;
  scheme: 'light' | 'dark';
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  colors: darkColors,
  scheme: 'dark',
  mode: 'system',
  setMode: () => {},
});

const SETTING_KEY = 'themeMode';

// Mount after the database is ready — the chosen mode lives in the settings table.
export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    getSetting(SETTING_KEY).then((raw) => {
      if (raw === 'light' || raw === 'dark' || raw === 'system') setModeState(raw);
    });
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    setSetting(SETTING_KEY, next);
  }, []);

  const scheme: 'light' | 'dark' = mode === 'system' ? (system === 'light' ? 'light' : 'dark') : mode;
  const value = useMemo(
    () => ({ colors: scheme === 'light' ? lightColors : darkColors, scheme, mode, setMode }),
    [scheme, mode, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

// Themed replacement for a module-level StyleSheet.create: makeStyles((c) => ({ box: { backgroundColor: c.bgSurface } }))
// returns a hook, `const styles = useStyles();` inside the component.
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(factory: (c: Colors) => T) {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
