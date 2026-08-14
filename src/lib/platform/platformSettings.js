export const DEFAULT_AUDIO_SETTINGS = Object.freeze({
  music: true,
  soundEffects: true,
});

export function normalizePlatformSettings(rawSettings = {}, defaults = {}) {
  const { sound: legacySound, ...currentSettings } = rawSettings;
  const music = typeof rawSettings.music === "boolean"
    ? rawSettings.music
    : legacySound !== false;
  const soundEffects = typeof rawSettings.soundEffects === "boolean"
    ? rawSettings.soundEffects
    : legacySound !== false;

  return {
    ...defaults,
    ...currentSettings,
    music,
    soundEffects,
  };
}
