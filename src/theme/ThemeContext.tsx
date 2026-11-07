import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, StyleSheet, useColorScheme } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import { darkColors, lightColors, type Palette } from './colors';
import { loadSetting, saveSetting } from '../lib/storage';

export type ThemePref = 'system' | 'light' | 'dark';
export const THEME_PREFS: ThemePref[] = ['system', 'light', 'dark'];

interface ThemeValue {
  colors: Palette;
  dark: boolean;
  /** What the user picked; "system" follows the phone. */
  pref: ThemePref;
  setPref: (pref: ThemePref) => void;
  ready: boolean;
}

const ThemeContext = createContext<ThemeValue>({
  colors: lightColors,
  dark: false,
  pref: 'system',
  setPref: () => {},
  ready: true,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [pref, setPrefState] = useState<ThemePref>('system');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadSetting('theme')
      .then((v) => THEME_PREFS.includes(v as ThemePref) && setPrefState(v as ThemePref))
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  // Native dialogs (date picker, alerts) follow the app's choice too.
  useEffect(() => {
    try {
      if (typeof Appearance.setColorScheme === 'function') Appearance.setColorScheme(pref === 'system' ? 'auto' : pref);
    } catch {
      // Not supported here (web); the app's own screens still switch.
    }
  }, [pref]);

  const dark = pref === 'dark' || (pref === 'system' && system === 'dark');
  const colors = dark ? darkColors : lightColors;

  // The window behind the screens, so screen transitions don't flash white.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [colors]);

  const setPref = useCallback((p: ThemePref) => {
    setPrefState(p);
    saveSetting('theme', p).catch(() => {});
  }, []);

  const value = useMemo(() => ({ colors, dark, pref, setPref, ready }), [colors, dark, pref, setPref, ready]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

type Styles = Parameters<typeof StyleSheet.create>[0];

/**
 * A StyleSheet built from the current palette. Each palette's sheet is made
 * once and reused, so calling the hook on every render costs nothing. Typed
 * like StyleSheet.create (`S & Styles`), so 'row' stays 'row' and typos show.
 */
export function makeStyles<S extends Styles>(build: (c: Palette) => S & Styles) {
  const cache = new Map<Palette, Readonly<S>>();
  return function useStyles(): Readonly<S> {
    const { colors } = useTheme();
    let sheet = cache.get(colors);
    if (!sheet) {
      sheet = StyleSheet.create(build(colors));
      cache.set(colors, sheet);
    }
    return sheet;
  };
}
