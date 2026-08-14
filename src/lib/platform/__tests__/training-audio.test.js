import assert from "node:assert/strict";
import test from "node:test";
import {
  TRAINING_AUDIO_EFFECTS,
  TRAINING_AUDIO_PROFILES,
  createTrainingAudioEngine,
  getTrainingAudioEffectRecipe,
  resolveTrainingAudioManifestAsset,
  selectTrainingAudioProfile,
} from "../trainingAudio.js";

test("seleciona trilhas calmas e aumenta a urgência por perfil, dificuldade, grupo e modo", () => {
  assert.equal(selectTrainingAudioProfile({ timeProfileId: "calmo", difficultyRating: 5 }), "calm");
  assert.equal(selectTrainingAudioProfile({ timeProfileId: "ritmo", difficultyRating: 5 }), "focus");
  assert.equal(selectTrainingAudioProfile({ timeProfileId: "reflexo", difficultyRating: 5 }), "intense");
  assert.equal(selectTrainingAudioProfile({ timeProfileId: "calmo", difficultyRating: 90 }), "urgent");
  assert.equal(selectTrainingAudioProfile({ groupId: "mix-insano", difficultyRating: 8 }), "intense");
  assert.equal(selectTrainingAudioProfile({ groupId: "mix-insano", difficultyRating: 50 }), "intense");
  assert.equal(selectTrainingAudioProfile({ groupId: "mix-insano", difficultyRating: 82 }), "urgent");
  assert.equal(selectTrainingAudioProfile({ modeId: "sobrevivência", wave: 1, lives: 3 }), "intense");
  assert.equal(selectTrainingAudioProfile({ modeId: "sobrevivencia", wave: 4, lives: 3 }), "urgent");
  assert.equal(selectTrainingAudioProfile({ modeId: "survival", wave: 1, lives: 1 }), "urgent");
  assert.equal(selectTrainingAudioProfile({ modeId: "sprint", remainingRatio: 0.8 }), "intense");
  assert.equal(selectTrainingAudioProfile({ modeId: "sprint", remainingRatio: 0.2 }), "urgent");
});

test("interpreta dificuldade legada de 1 a 10 sem confundir rating semântico", () => {
  assert.equal(selectTrainingAudioProfile({ difficulty: 2, timeProfileId: "calmo" }), "calm");
  assert.equal(selectTrainingAudioProfile({ difficulty: 6, timeProfileId: "calmo" }), "intense");
  assert.equal(selectTrainingAudioProfile({ difficulty: 9, timeProfileId: "calmo" }), "urgent");
  assert.equal(selectTrainingAudioProfile({ difficultyRating: 9, difficulty: 10 }), "calm");
});

test("todos os perfis têm parâmetros musicais finitos e padrões completos", () => {
  assert.deepEqual(Object.keys(TRAINING_AUDIO_PROFILES), ["calm", "focus", "intense", "urgent"]);
  for (const profile of Object.values(TRAINING_AUDIO_PROFILES)) {
    assert.ok(profile.bpm >= 60 && profile.bpm <= 160);
    assert.ok(profile.busGain > 0 && profile.busGain < 0.25);
    assert.equal(profile.melody.length, 8);
    assert.equal(profile.bass.length, 8);
    assert.ok(profile.scale.length >= 8);
  }
});

test("efeitos obrigatórios geram receitas independentes e válidas", () => {
  for (const effect of TRAINING_AUDIO_EFFECTS) {
    const recipe = getTrainingAudioEffectRecipe(effect, { combo: 20 });
    assert.ok(recipe.length > 0, effect);
    for (const instruction of recipe) {
      assert.equal(instruction.kind, "tone");
      assert.ok(Number.isFinite(instruction.frequency) && instruction.frequency > 0);
      assert.ok(Number.isFinite(instruction.duration) && instruction.duration > 0);
      assert.ok(Number.isFinite(instruction.gain) && instruction.gain > 0);
      assert.ok(instruction.delay >= 0);
    }
    recipe[0].frequency = 1;
    assert.notEqual(getTrainingAudioEffectRecipe(effect, { combo: 20 })[0].frequency, 1);
  }
  assert.deepEqual(getTrainingAudioEffectRecipe("desconhecido"), []);
  assert.notDeepEqual(
    getTrainingAudioEffectRecipe("finish", { success: true }),
    getTrainingAudioEffectRecipe("finish", { success: false }),
  );
});

test("manifest aceita URL, objeto e variações e herda calm/focus e intense/urgent", () => {
  const manifest = {
    music: {
      calm: { url: "calm.mp3", volume: 0.2 },
      intense: "action.mp3",
    },
    effects: { correct: ["correct-a.mp3", "correct-b.mp3"] },
  };
  assert.deepEqual(resolveTrainingAudioManifestAsset(manifest, "music", "focus"), {
    url: "calm.mp3",
    volume: 0.2,
  });
  assert.deepEqual(resolveTrainingAudioManifestAsset(manifest, "music", "urgent"), {
    url: "action.mp3",
  });
  assert.equal(resolveTrainingAudioManifestAsset(manifest, "effects", "correct", () => 0).url, "correct-a.mp3");
  assert.equal(resolveTrainingAudioManifestAsset(manifest, "effects", "correct", () => 0.99).url, "correct-b.mp3");
  assert.equal(resolveTrainingAudioManifestAsset(manifest, "voices", "ready"), null);
});

test("motor permanece inerte antes do gesto e separa música de efeitos", async () => {
  const timers = new Map();
  let timerSequence = 0;
  const engine = createTrainingAudioEngine({
    AudioContextClass: FakeAudioContext,
    setInterval(callback) {
      timerSequence += 1;
      timers.set(timerSequence, callback);
      return timerSequence;
    },
    clearInterval(id) { timers.delete(id); },
    random: () => 0.5,
  });

  engine.startSession({ timeProfileId: "calmo" });
  assert.deepEqual(engine.getSnapshot(), {
    available: true,
    unlocked: false,
    active: true,
    paused: false,
    musicEnabled: true,
    effectsEnabled: true,
    profileId: "calm",
    playingProfileId: "calm",
    schedulerActive: false,
    contextState: "uninitialized",
  });
  assert.equal(engine.playEffect("correct"), false);

  assert.equal(await engine.unlock(), true);
  assert.equal(engine.getSnapshot().schedulerActive, true);
  assert.equal(engine.playEffect("correct"), true);

  engine.configure({ musicEnabled: false, effectsEnabled: true });
  assert.equal(engine.getSnapshot().schedulerActive, false);
  assert.equal(engine.playEffect("wrong"), true);

  engine.configure({ musicEnabled: true, effectsEnabled: false });
  assert.equal(engine.getSnapshot().schedulerActive, true);
  assert.equal(engine.playEffect("correct"), false);

  engine.pause();
  assert.equal(engine.getSnapshot().paused, true);
  assert.equal(engine.getSnapshot().schedulerActive, false);
  engine.updateSession({ modeId: "sobrevivencia", lives: 1 });
  assert.equal(engine.getSnapshot().profileId, "urgent");
  engine.resume();
  assert.equal(engine.getSnapshot().schedulerActive, true);

  engine.configure({ effectsEnabled: true });
  assert.equal(engine.finishSession({ success: true }), true);
  assert.equal(engine.getSnapshot().active, false);
  assert.equal(engine.getSnapshot().schedulerActive, false);
  assert.equal(timers.size, 0);
  await engine.destroy();
  assert.equal(engine.getSnapshot().unlocked, false);
});

test("unlock é idempotente e não reinicia uma faixa já desbloqueada", async () => {
  const media = [];
  const timers = new Map();
  let sequence = 0;
  const engine = createTrainingAudioEngine({
    AudioContextClass: FakeAudioContext,
    manifest: { music: { calm: "calm.mp3" } },
    createAudioElement(url, kind) {
      const element = new FakeMediaElement(url, kind);
      media.push(element);
      return element;
    },
    setInterval(callback) {
      sequence += 1;
      timers.set(sequence, callback);
      return sequence;
    },
    clearInterval(id) { timers.delete(id); },
  });

  engine.startSession({ timeProfileId: "calmo" });
  await engine.unlock();
  const track = media.find((entry) => entry.url === "calm.mp3");
  assert.equal(track.playCalls, 1);

  await engine.unlock();
  assert.equal(track.playCalls, 1, "unlock repetido não chama play novamente");

  engine.startSession({ timeProfileId: "calmo" });
  assert.equal(track.playCalls, 2, "uma nova sessão pode retomar a faixa");
  await engine.unlock();
  assert.equal(track.playCalls, 2, "o unlock da nova sessão também permanece idempotente");

  await engine.destroy();
  assert.equal(timers.size, 0);
});

test("ausência de Web Audio degrada para silêncio sem lançar erro", async () => {
  const engine = createTrainingAudioEngine({ AudioContextClass: null });
  assert.equal(engine.getSnapshot().available, false);
  engine.startSession({ modeId: "sprint" });
  assert.equal(engine.getSnapshot().profileId, "intense");
  assert.equal(await engine.unlock(), false);
  assert.equal(engine.playEffect("tick"), false);
  assert.equal(engine.pause(), true);
  assert.equal(engine.resume(), true);
  assert.equal(engine.finishSession(), true);
  await engine.destroy();
});

test("assets HTMLAudio substituem o synth, respeitam controles e limitam as vozes", async () => {
  const media = [];
  const timers = new Map();
  let sequence = 0;
  let now = 0;
  const engine = createTrainingAudioEngine({
    AudioContextClass: FakeAudioContext,
    manifest: {
      music: { calm: "calm.mp3", intense: "action.mp3" },
      effects: { start: "start.mp3", correct: "correct.mp3", finish: "finish.mp3" },
      voices: {
        ready: "ready.mp3",
        correct: "good.mp3",
        newHighscore: "record.mp3",
      },
    },
    createAudioElement(url, kind) {
      const element = new FakeMediaElement(url, kind);
      media.push(element);
      return element;
    },
    now: () => now,
    setInterval(callback) {
      sequence += 1;
      timers.set(sequence, callback);
      return sequence;
    },
    clearInterval(id) { timers.delete(id); },
  });

  engine.startSession({ timeProfileId: "calmo", difficultyRating: 4 });
  assert.equal(media.length, 0, "nenhum asset toca antes do gesto");
  await engine.unlock();
  assert.ok(media.some((entry) => entry.url === "calm.mp3" && entry.loop));
  assert.ok(media.some((entry) => entry.url === "start.mp3"));
  assert.ok(media.some((entry) => entry.url === "ready.mp3"));
  assert.equal(engine.getSnapshot().schedulerActive, false, "track substitui o synth");

  engine.updateSession({ modeId: "sobrevivencia", lives: 1 });
  assert.ok(media.some((entry) => entry.url === "action.mp3" && entry.loop));

  now = 1_000;
  engine.playEffect("correct");
  assert.equal(media.filter((entry) => entry.url === "good.mp3").length, 0, "cooldown evita locução repetitiva");
  now = 3_000;
  engine.playEffect("correct");
  assert.equal(media.filter((entry) => entry.url === "good.mp3").length, 1);

  engine.configure({ effectsEnabled: false });
  assert.equal(engine.playEffect("correct"), false);
  assert.equal(engine.playVoice("correct", { force: true }), false);
  engine.configure({ effectsEnabled: true });
  now = 6_000;
  engine.finishSession({ isNewRecord: true });
  assert.ok(media.some((entry) => entry.url === "finish.mp3"));
  assert.ok(media.some((entry) => entry.url === "record.mp3"));

  await engine.destroy();
  assert.ok(media.every((entry) => entry.paused));
  assert.equal(timers.size, 0);
});

test("pausa imediata interrompe a mídia e resume o AudioContext com segurança", async () => {
  const media = [];
  const timers = new Map();
  let sequence = 0;
  let audioContext;
  class CapturedAudioContext extends FakeAudioContext {
    constructor() {
      super();
      audioContext = this;
    }
  }
  const engine = createTrainingAudioEngine({
    AudioContextClass: CapturedAudioContext,
    manifest: {
      music: { calm: "calm.mp3" },
      effects: { correct: "correct.mp3" },
      voices: { correct: "good.mp3" },
    },
    createAudioElement(url, kind) {
      const element = new FakeMediaElement(url, kind);
      media.push(element);
      return element;
    },
    setInterval(callback) {
      sequence += 1;
      timers.set(sequence, callback);
      return sequence;
    },
    clearInterval(id) { timers.delete(id); },
  });

  engine.startSession({ timeProfileId: "calmo" });
  await engine.unlock();
  const firstTrack = media.find((entry) => entry.url === "calm.mp3");
  engine.playEffect("correct", { voiceCue: "correct" });
  const activeEffect = media.find((entry) => entry.url === "correct.mp3");
  const activeVoice = media.find((entry) => entry.url === "good.mp3");
  assert.equal(firstTrack.paused, false);
  assert.equal(activeEffect.paused, false);
  assert.equal(activeVoice.paused, false);
  assert.equal(engine.pause({ immediate: true }), true);
  assert.equal(firstTrack.paused, true);
  assert.equal(activeEffect.paused, true);
  assert.equal(activeVoice.paused, true);
  assert.equal(timers.size, 0, "pausa imediata não deixa fades ou scheduler ativos");

  audioContext.state = "suspended";
  const previousResumeCalls = audioContext.resumeCalls;
  assert.equal(engine.resume(), true);
  assert.equal(audioContext.resumeCalls, previousResumeCalls + 1);
  assert.equal(audioContext.state, "running");
  assert.equal(media.at(-1).paused, false);

  await engine.destroy();
  assert.equal(timers.size, 0);
});

test("error e abort limpam one-shots e mantêm o fallback procedural disponível", async () => {
  const media = [];
  const engine = createTrainingAudioEngine({
    AudioContextClass: FakeAudioContext,
    manifest: {
      effects: {
        correct: "correct.mp3",
        wrong: "wrong.mp3",
      },
    },
    createAudioElement(url, kind) {
      const element = new FakeMediaElement(url, kind);
      media.push(element);
      return element;
    },
  });

  engine.startSession({ timeProfileId: "calmo" });
  await engine.unlock();
  assert.equal(engine.playEffect("correct", { voiceCue: false }), true);
  const correct = media.find((entry) => entry.url === "correct.mp3");
  correct.dispatch("error");
  assert.equal(correct.paused, true);

  assert.equal(engine.playEffect("wrong", { voiceCue: false }), true);
  const wrong = media.find((entry) => entry.url === "wrong.mp3");
  wrong.dispatch("abort");
  assert.equal(wrong.paused, true);

  await engine.destroy();
});

test("falha de autoplay ou mídia volta ao synth procedural", async () => {
  const timers = new Map();
  const media = [];
  let sequence = 0;
  let blockFirstPlay = true;
  let audioContext;
  class CapturedAudioContext extends FakeAudioContext {
    constructor() {
      super();
      audioContext = this;
    }
  }
  const engine = createTrainingAudioEngine({
    AudioContextClass: CapturedAudioContext,
    manifest: { music: { calm: "blocked.mp3" } },
    createAudioElement(url, kind) {
      const element = new FakeMediaElement(url, kind);
      media.push(element);
      element.play = () => {
        element.playCalls += 1;
        element.paused = false;
        if (!blockFirstPlay) return Promise.resolve();
        blockFirstPlay = false;
        const error = new Error("autoplay bloqueado");
        error.name = "NotAllowedError";
        return Promise.reject(error);
      };
      return element;
    },
    setInterval(callback) {
      sequence += 1;
      timers.set(sequence, callback);
      return sequence;
    },
    clearInterval(id) { timers.delete(id); },
  });
  engine.startSession({ timeProfileId: "calmo" });
  await engine.unlock();
  await Promise.resolve();
  assert.equal(engine.getSnapshot().schedulerActive, true);
  assert.ok(audioContext.gains[0].gain.value > 0, "fallback restaura o ganho do bus musical");

  engine.startSession({ timeProfileId: "calmo" });
  assert.equal(media.length, 2, "NotAllowedError transitório permite nova tentativa");
  assert.equal(media.at(-1).paused, false);
  assert.equal(engine.getSnapshot().schedulerActive, false, "asset recuperado substitui o synth");
  await engine.destroy();
  assert.equal(timers.size, 0);
});

test("falha tardia de uma faixa antiga não sobrepõe synth à faixa atual", async () => {
  const media = [];
  const timers = new Map();
  let sequence = 0;
  let rejectCalm;
  const engine = createTrainingAudioEngine({
    AudioContextClass: FakeAudioContext,
    manifest: {
      music: {
        calm: "calm.mp3",
        intense: "action.mp3",
      },
    },
    createAudioElement(url, kind) {
      const element = new FakeMediaElement(url, kind);
      media.push(element);
      if (url === "calm.mp3") {
        element.play = () => {
          element.playCalls += 1;
          element.paused = false;
          return new Promise((resolve, reject) => { rejectCalm = reject; });
        };
      }
      return element;
    },
    setInterval(callback) {
      sequence += 1;
      timers.set(sequence, callback);
      return sequence;
    },
    clearInterval(id) { timers.delete(id); },
  });

  engine.startSession({ timeProfileId: "calmo", difficultyRating: 4 });
  await engine.unlock();
  engine.updateSession({ modeId: "sobrevivencia", lives: 1 });
  const action = media.find((entry) => entry.url === "action.mp3");
  assert.equal(action.paused, false);
  assert.equal(engine.getSnapshot().schedulerActive, false);

  rejectCalm(new Error("falha tardia"));
  await Promise.resolve();
  assert.equal(engine.getSnapshot().schedulerActive, false);
  assert.equal(action.paused, false, "a faixa atual continua sendo a única trilha");

  await engine.destroy();
  assert.equal(timers.size, 0);
});

class FakeAudioParam {
  constructor(value = 0) { this.value = value; }
  cancelScheduledValues() {}
  setValueAtTime(value) { this.value = value; }
  linearRampToValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime(value) { this.value = value; }
}

class FakeNode {
  connect() { return this; }
  disconnect() {}
}

class FakeGain extends FakeNode {
  constructor() {
    super();
    this.gain = new FakeAudioParam();
  }
}

class FakeSource extends FakeNode {
  constructor() {
    super();
    this.frequency = new FakeAudioParam();
    this.listeners = {};
  }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  start() {}
  stop() {}
}

class FakeAudioContext {
  constructor() {
    this.currentTime = 0;
    this.destination = new FakeNode();
    this.gains = [];
    this.resumeCalls = 0;
    this.sampleRate = 48_000;
    this.state = "suspended";
  }
  async resume() {
    this.resumeCalls += 1;
    this.state = "running";
  }
  async close() { this.state = "closed"; }
  createGain() {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }
  createOscillator() { return new FakeSource(); }
  createBufferSource() { return new FakeSource(); }
  createBuffer(channels, frameCount) {
    return { getChannelData: () => new Float32Array(frameCount) };
  }
  createBiquadFilter() {
    const node = new FakeNode();
    node.frequency = new FakeAudioParam();
    return node;
  }
  createDynamicsCompressor() {
    const node = new FakeNode();
    node.threshold = new FakeAudioParam();
    node.knee = new FakeAudioParam();
    node.ratio = new FakeAudioParam();
    node.attack = new FakeAudioParam();
    node.release = new FakeAudioParam();
    return node;
  }
}

class FakeMediaElement {
  constructor(url, kind) {
    this.url = url;
    this.kind = kind;
    this.loop = false;
    this.paused = true;
    this.playCalls = 0;
    this.volume = 1;
    this.listeners = {};
  }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  dispatch(name) { this.listeners[name]?.(); }
  play() {
    this.playCalls += 1;
    this.paused = false;
    return Promise.resolve();
  }
  pause() { this.paused = true; }
}
