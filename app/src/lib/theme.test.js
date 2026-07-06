import { test, expect, beforeEach } from 'vitest';
import { toggleTheme, initTheme, getThemePref, isDark } from './theme.js';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
});

test('toggleTheme flips the persisted value and the root class', () => {
  initTheme(); // system default (jsdom: not dark) => light
  expect(isDark()).toBe(false);

  const nowDark = toggleTheme();
  expect(nowDark).toBe(true);
  expect(getThemePref()).toBe('dark');
  expect(document.documentElement.classList.contains('dark')).toBe(true);

  const nowLight = toggleTheme();
  expect(nowLight).toBe(false);
  expect(getThemePref()).toBe('light');
  expect(document.documentElement.classList.contains('dark')).toBe(false);
});
