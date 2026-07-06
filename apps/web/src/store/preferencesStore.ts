import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark' | 'system';

interface PreferencesState {
  mode: ThemeMode;
  primaryColor: string;
  compact: boolean;
  dueReminders: boolean;
  setPreferences: (preferences: Partial<Omit<PreferencesState, 'setPreferences'>>) => void;
}

const storageKey = 'teamops.preferences';

function readPreferences() {
  const fallback = { mode: 'light' as ThemeMode, primaryColor: '#2563eb', compact: false, dueReminders: true };
  const raw = typeof window === 'undefined' ? null : window.localStorage.getItem(storageKey);
  if (!raw) return fallback;
  try {
    return { ...fallback, ...JSON.parse(raw) } as typeof fallback;
  } catch {
    return fallback;
  }
}

const initial = readPreferences();

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  ...initial,
  setPreferences: (preferences) => {
    const next = { ...get(), ...preferences };
    window.localStorage.setItem(storageKey, JSON.stringify({
      mode: next.mode,
      primaryColor: next.primaryColor,
      compact: next.compact,
      dueReminders: next.dueReminders
    }));
    set(preferences);
  }
}));
