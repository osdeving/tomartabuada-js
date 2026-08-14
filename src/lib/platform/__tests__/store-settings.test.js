import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_AUDIO_SETTINGS,
  normalizePlatformSettings,
} from "../platformSettings.js";

test("preferências de áudio começam com música e efeitos independentes", () => {
  assert.equal(DEFAULT_AUDIO_SETTINGS.music, true);
  assert.equal(DEFAULT_AUDIO_SETTINGS.soundEffects, true);
});

test("migra o antigo botão de som sem surpreender quem escolheu silêncio", () => {
  const migrated = normalizePlatformSettings({ sound: false }, DEFAULT_AUDIO_SETTINGS);

  assert.equal(migrated.music, false);
  assert.equal(migrated.soundEffects, false);
  assert.equal("sound" in migrated, false);
});

test("preferências novas prevalecem sobre o alias legado", () => {
  const normalized = normalizePlatformSettings({
    music: false,
    sound: false,
    soundEffects: true,
  }, DEFAULT_AUDIO_SETTINGS);

  assert.equal(normalized.music, false);
  assert.equal(normalized.soundEffects, true);
});
