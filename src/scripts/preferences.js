import { defaultPreferences, preferenceKeys } from "../config/preferences.js";
export const preferencesChangeEvent = "portfolio:preferenceschange";
export function readStoredPreferences(fallback = defaultPreferences) {
  const read = (key, otherwise) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return otherwise;
    }
  };
  const theme = read(preferenceKeys.theme, fallback.theme);
  const animation = read(preferenceKeys.animation, fallback.animation);
  return {
    theme:
      theme === "light" || theme === "dark" ? theme : defaultPreferences.theme,
    animation:
      animation === "off" || animation === "on"
        ? animation
        : defaultPreferences.animation,
  };
}
function persist(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Settings remain usable when browser storage is unavailable.
  }
}
export function getPreferences() {
  const { theme, animation } = document.documentElement.dataset;
  return {
    theme:
      theme === "light" || theme === "dark" ? theme : defaultPreferences.theme,
    animation:
      animation === "off" || animation === "on"
        ? animation
        : defaultPreferences.animation,
  };
}
function applyPreferences({ theme, animation }) {
  const root = document.documentElement;
  if (root.dataset.theme !== theme) root.dataset.theme = theme;
  if (root.dataset.animation !== animation) root.dataset.animation = animation;
  root.classList.toggle("dark", theme === "dark");
  document
    .querySelector('meta[name="color-scheme"]')
    ?.setAttribute("content", theme);
  document.dispatchEvent(
    new CustomEvent(preferencesChangeEvent, { detail: { theme, animation } }),
  );
}
export function setTheme(theme, save = true) {
  applyPreferences({ ...getPreferences(), theme });
  if (save) persist(preferenceKeys.theme, theme);
}
export function setAnimation(animation, save = true) {
  applyPreferences({ ...getPreferences(), animation });
  if (save) persist(preferenceKeys.animation, animation);
}
export function initPreferenceSync() {
  const restore = () =>
    applyPreferences(readStoredPreferences(getPreferences()));
  const onStorage = (event) => {
    try {
      if (event.storageArea !== localStorage) return;
    } catch {
      return;
    }
    if (
      event.key === null ||
      event.key === preferenceKeys.theme ||
      event.key === preferenceKeys.animation
    ) {
      restore();
    }
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener("pageshow", restore);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("pageshow", restore);
  };
}
