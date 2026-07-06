// Light/dark theme: OS default on first load, manual toggle overrides, choice persists locally.
// Applies a `dark` class on <html>. Stored under prefs.theme = 'light' | 'dark' | 'system'.
const KEY = 'prefs.theme';

function prefersDark() {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
}
function resolve(pref) {
  return pref === 'dark' || (pref !== 'light' && prefersDark());
}
function apply(isDark) {
  document.documentElement.classList.toggle('dark', isDark);
}

export function getThemePref() {
  return localStorage.getItem(KEY) || 'system';
}
export function initTheme() {
  apply(resolve(getThemePref()));
}
export function isDark() {
  return document.documentElement.classList.contains('dark');
}
// Flip between explicit light/dark and persist. Returns the new resolved isDark.
export function toggleTheme() {
  const next = isDark() ? 'light' : 'dark';
  localStorage.setItem(KEY, next);
  apply(next === 'dark');
  return next === 'dark';
}
