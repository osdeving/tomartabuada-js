import calmMusicUrl from "../../assets/audio/music/calm-home.mp3";
import urgentMusicUrl from "../../assets/audio/music/urgent-battle.mp3";
import comboSfxUrl from "../../assets/audio/sfx/combo.mp3";
import correctSfxUrl from "../../assets/audio/sfx/correct.mp3";
import finishSfxUrl from "../../assets/audio/sfx/finish.mp3";
import startSfxUrl from "../../assets/audio/sfx/start.mp3";
import tickSfxUrl from "../../assets/audio/sfx/tick.mp3";
import wrongSfxUrl from "../../assets/audio/sfx/wrong.mp3";
import congratulationsVoiceUrl from "../../assets/audio/voice/congratulations.mp3";
import correctVoiceUrl from "../../assets/audio/voice/correct.mp3";
import gameOverVoiceUrl from "../../assets/audio/voice/game-over.mp3";
import hurryVoiceUrl from "../../assets/audio/voice/hurry-up.mp3";
import newHighscoreVoiceUrl from "../../assets/audio/voice/new-highscore.mp3";
import readyVoiceUrl from "../../assets/audio/voice/ready.mp3";
import timeOverVoiceUrl from "../../assets/audio/voice/time-over.mp3";
import wrongVoiceUrl from "../../assets/audio/voice/wrong.mp3";

export const APP_TRAINING_AUDIO_MANIFEST = Object.freeze({
  music: Object.freeze({
    calm: Object.freeze({ url: calmMusicUrl, volume: 0.16 }),
    focus: Object.freeze({ url: calmMusicUrl, volume: 0.18 }),
    intense: Object.freeze({ url: urgentMusicUrl, volume: 0.2 }),
    urgent: Object.freeze({ url: urgentMusicUrl, volume: 0.22 }),
  }),
  effects: Object.freeze({
    start: Object.freeze({ url: startSfxUrl, volume: 0.5 }),
    correct: Object.freeze({ url: correctSfxUrl, volume: 0.52 }),
    wrong: Object.freeze({ url: wrongSfxUrl, volume: 0.5 }),
    combo: Object.freeze({ url: comboSfxUrl, volume: 0.55 }),
    finish: Object.freeze({ url: finishSfxUrl, volume: 0.55 }),
    tick: Object.freeze({ url: tickSfxUrl, volume: 0.42 }),
  }),
  voices: Object.freeze({
    ready: Object.freeze({ url: readyVoiceUrl, volume: 0.62 }),
    hurry: Object.freeze({ url: hurryVoiceUrl, volume: 0.66 }),
    correct: Object.freeze({ url: correctVoiceUrl, volume: 0.62 }),
    wrong: Object.freeze({ url: wrongVoiceUrl, volume: 0.62 }),
    congratulations: Object.freeze({ url: congratulationsVoiceUrl, volume: 0.66 }),
    timeOver: Object.freeze({ url: timeOverVoiceUrl, volume: 0.66 }),
    gameOver: Object.freeze({ url: gameOverVoiceUrl, volume: 0.66 }),
    newHighscore: Object.freeze({ url: newHighscoreVoiceUrl, volume: 0.68 }),
  }),
});
