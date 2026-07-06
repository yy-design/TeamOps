import { create } from 'zustand';
import type { UserDto } from '@teamops/shared';

interface AuthState {
  token: string | null;
  user: UserDto | null;
  setSession: (token: string, user: UserDto) => void;
  clearSession: () => void;
}

const tokenKey = 'teamops.token';
const userKey = 'teamops.user';

function getStorage() {
  if (typeof window === 'undefined' || typeof window.localStorage?.getItem !== 'function') {
    return undefined;
  }
  return window.localStorage;
}

function readUser() {
  const value = getStorage()?.getItem(userKey);
  if (!value) return null;
  try {
    return JSON.parse(value) as UserDto;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  token: getStorage()?.getItem(tokenKey) ?? null,
  user: readUser(),
  setSession: (token, user) => {
    getStorage()?.setItem(tokenKey, token);
    getStorage()?.setItem(userKey, JSON.stringify(user));
    set({ token, user });
  },
  clearSession: () => {
    getStorage()?.removeItem(tokenKey);
    getStorage()?.removeItem(userKey);
    set({ token: null, user: null });
  }
}));
