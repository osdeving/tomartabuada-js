const PROFILE_ORDER = ["calm", "focus", "intense", "urgent"];

export const TRAINING_AUDIO_PROFILES = Object.freeze({
  calm: Object.freeze({
    id: "calm",
    bpm: 66,
    busGain: 0.16,
    rootMidi: 50,
    scale: Object.freeze([0, 3, 7, 10, 12, 15, 19, 22]),
    melody: Object.freeze([0, null, 2, null, 1, null, 3, null]),
    bass: Object.freeze([0, null, null, null, 2, null, null, null]),
    oscillator: "sine",
    noteDuration: 0.72,
    noteGain: 0.055,
    bassGain: 0.038,
    percussion: "none",
  }),
  focus: Object.freeze({
    id: "focus",
    bpm: 92,
    busGain: 0.15,
    rootMidi: 50,
    scale: Object.freeze([0, 3, 5, 7, 10, 12, 15, 17]),
    melody: Object.freeze([0, null, 2, 1, 3, null, 2, 4]),
    bass: Object.freeze([0, null, 0, null, 3, null, 2, null]),
    oscillator: "triangle",
    noteDuration: 0.3,
    noteGain: 0.05,
    bassGain: 0.04,
    percussion: "pulse",
  }),
  intense: Object.freeze({
    id: "intense",
    bpm: 124,
    busGain: 0.14,
    rootMidi: 45,
    scale: Object.freeze([0, 3, 5, 7, 10, 12, 15, 17]),
    melody: Object.freeze([0, 2, 3, 2, 4, 3, 5, 3]),
    bass: Object.freeze([0, null, 0, 2, 3, null, 2, 4]),
    oscillator: "triangle",
    noteDuration: 0.18,
    noteGain: 0.046,
    bassGain: 0.045,
    percussion: "drive",
  }),
  urgent: Object.freeze({
    id: "urgent",
    bpm: 148,
    busGain: 0.135,
    rootMidi: 43,
    scale: Object.freeze([0, 2, 3, 7, 8, 10, 12, 15]),
    melody: Object.freeze([0, 2, 3, 5, 4, 6, 5, 7]),
    bass: Object.freeze([0, 0, 3, 2, 4, 3, 5, 4]),
    oscillator: "sawtooth",
    noteDuration: 0.12,
    noteGain: 0.034,
    bassGain: 0.046,
    percussion: "urgent",
  }),
});

export const TRAINING_AUDIO_EFFECTS = Object.freeze([
  "start",
  "correct",
  "wrong",
  "combo",
  "finish",
  "tick",
]);

export const TRAINING_AUDIO_VOICES = Object.freeze([
  "ready",
  "hurry",
  "correct",
  "wrong",
  "congratulations",
  "timeOver",
  "gameOver",
  "newHighscore",
]);

export const DEFAULT_TRAINING_AUDIO_MANIFEST = Object.freeze({
  music: Object.freeze({}),
  effects: Object.freeze({}),
  voices: Object.freeze({}),
});

/**
 * Manifest entries may be a URL, an array of URLs or { url, volume }. Focus
 * shares the calm track by default; urgent shares the intense/action track.
 */
export function resolveTrainingAudioManifestAsset(manifest, category, assetId, random = Math.random) {
  const collection = manifest?.[category];
  if (!collection || typeof collection !== "object") return null;
  const fallbackId = category === "music"
    ? assetId === "focus" ? "calm" : assetId === "urgent" ? "intense" : null
    : null;
  const raw = collection[assetId] ?? (fallbackId ? collection[fallbackId] : null);
  const candidate = Array.isArray(raw)
    ? raw[Math.min(raw.length - 1, Math.floor(clamp(random(), 0, 0.999999) * raw.length))]
    : raw;
  if (typeof candidate === "string" && candidate) return { url: candidate };
  if (!candidate || typeof candidate !== "object" || !candidate.url) return null;
  return {
    url: String(candidate.url),
    ...(Number.isFinite(Number(candidate.volume)) ? { volume: clamp(Number(candidate.volume), 0, 1) } : {}),
  };
}

/**
 * Maps session semantics to a soundtrack. Explicit high-pressure modes win
 * over the selected time profile; semantic difficulty then raises the floor.
 */
export function selectTrainingAudioProfile(input = {}) {
  const modeId = normalizeId(input.modeId ?? input.mode);
  const groupId = normalizeId(input.groupId ?? input.group);
  const timeProfileId = normalizeId(input.timeProfileId ?? input.timeProfile);
  const rating = semanticDifficultyRating(input);
  const wave = positiveInteger(input.wave ?? input.modeState?.wave, 1);
  const lives = positiveInteger(input.lives ?? input.modeState?.lives, 3);
  const remainingRatio = finiteNumber(input.remainingRatio, 1);

  let level = timeProfileId === "reflexo"
    ? 2
    : timeProfileId === "ritmo"
      ? 1
      : 0;

  if (rating >= 80) level = Math.max(level, 3);
  else if (rating >= 52) level = Math.max(level, 2);
  else if (rating >= 24) level = Math.max(level, 1);

  if (groupId.includes("insan")) {
    level = Math.max(level, rating >= 72 ? 3 : 2);
  }

  if (groupId.includes("brut") || modeId.includes("brut") || modeId.includes("insan")) {
    level = 3;
  }

  if (["sobrevivencia", "survival"].includes(modeId)) {
    level = Math.max(level, wave >= 4 || lives <= 1 ? 3 : 2);
  }

  if (modeId === "sprint") {
    level = Math.max(level, remainingRatio <= 0.25 ? 3 : 2);
  }

  return PROFILE_ORDER[clamp(level, 0, PROFILE_ORDER.length - 1)];
}

export function getTrainingAudioEffectRecipe(effectName, options = {}) {
  const effect = normalizeId(effectName);
  const combo = positiveInteger(options.combo, 1);
  const failure = options.outcome === "failure" || options.success === false;
  let recipe;

  switch (effect) {
    case "start":
      recipe = [
        tone(392, 0, 0.09, "triangle", 0.038),
        tone(523.25, 0.07, 0.11, "sine", 0.034),
      ];
      break;
    case "correct":
      recipe = [
        tone(659.25, 0, 0.09, "triangle", 0.045),
        tone(880, 0.055, 0.1, "sine", 0.039),
      ];
      break;
    case "wrong":
      recipe = [
        sweep(225, 155, 0, 0.17, "sawtooth", 0.035),
      ];
      break;
    case "combo": {
      const lift = Math.min(7, Math.floor(combo / 5));
      const root = midiToFrequency(67 + lift);
      recipe = [
        tone(root, 0, 0.12, "triangle", 0.045),
        tone(root * 1.25, 0.045, 0.14, "triangle", 0.041),
        tone(root * 1.5, 0.09, 0.18, "sine", 0.038),
      ];
      break;
    }
    case "finish":
      recipe = failure
        ? [sweep(293.66, 196, 0, 0.28, "triangle", 0.037)]
        : [
            tone(523.25, 0, 0.14, "triangle", 0.042),
            tone(659.25, 0.09, 0.16, "triangle", 0.04),
            tone(783.99, 0.18, 0.24, "sine", 0.04),
          ];
      break;
    case "tick":
      recipe = [tone(1046.5, 0, 0.035, "sine", 0.018)];
      break;
    default:
      recipe = [];
  }

  return recipe.map((entry) => ({ ...entry }));
}

/**
 * Imperative Web Audio engine. It is intentionally inert until unlock() is
 * called from a user gesture, which keeps autoplay behavior browser-safe.
 */
export function createTrainingAudioEngine(options = {}) {
  const AudioContextClass = resolveAudioContextClass(options);
  const manifest = mergeTrainingAudioManifest(options.manifest);
  const createAudioElement = resolveAudioElementFactory(options);
  const scheduleInterval = options.setInterval ?? globalThis.setInterval?.bind(globalThis);
  const cancelInterval = options.clearInterval ?? globalThis.clearInterval?.bind(globalThis);
  const random = typeof options.random === "function" ? options.random : Math.random;
  const wallClock = typeof options.now === "function" ? options.now : Date.now;
  const lookAheadSeconds = positiveNumber(options.lookAheadSeconds, 0.2);
  const schedulerIntervalMs = positiveNumber(options.schedulerIntervalMs, 75);
  const voiceCooldownMs = positiveNumber(options.voiceCooldownMs, 2_400);
  const sources = new Map();
  const mediaElements = new Set();
  const mediaKinds = new Map();
  const mediaFadeTimers = new Map();
  const failedMediaUrls = new Set();
  let context = null;
  let graph = null;
  let schedulerId = null;
  let destroyed = false;
  let unlocked = false;
  let active = false;
  let paused = false;
  let musicEnabled = options.musicEnabled !== false;
  let effectsEnabled = options.effectsEnabled !== false;
  let currentProfileId = "calm";
  let desiredProfileId = "calm";
  let nextStepTime = 0;
  let stepIndex = 0;
  let pendingStartEffect = false;
  let currentMusic = null;
  let lastVoiceAt = Number.NEGATIVE_INFINITY;

  async function unlock() {
    if (destroyed) return false;
    const wasUnlocked = unlocked;
    if (!AudioContextClass) {
      unlocked = Boolean(createAudioElement);
      if (!wasUnlocked && unlocked && active && !paused && musicEnabled) startSoundtrack(true);
      if (!wasUnlocked && unlocked && pendingStartEffect) {
        pendingStartEffect = false;
        playEffect("start");
      }
      return unlocked;
    }
    if (!context) {
      try {
        context = new AudioContextClass();
        graph = createAudioGraph(context, { musicEnabled, effectsEnabled });
      } catch {
        context = null;
        graph = null;
        return false;
      }
    }

    let resumePromise = null;
    if (context.state !== "running" && context.state !== "closed" && typeof context.resume === "function") {
      try { resumePromise = context.resume(); } catch { resumePromise = null; }
    }
    unlocked = context.state !== "closed";
    if (!unlocked) return false;
    if (!wasUnlocked) {
      applyBusGains(0.08);
      if (active && !paused && musicEnabled) startSoundtrack(true);
      if (pendingStartEffect) {
        pendingStartEffect = false;
        playEffect("start");
      }
    }
    if (resumePromise && typeof resumePromise.then === "function") {
      try {
        await resumePromise;
      } catch {
        if (!createAudioElement) {
          unlocked = false;
          return false;
        }
      }
    }
    return true;
  }

  function configure(patch = {}) {
    if (typeof patch.musicEnabled === "boolean") musicEnabled = patch.musicEnabled;
    if (typeof patch.effectsEnabled === "boolean") effectsEnabled = patch.effectsEnabled;
    if (!effectsEnabled) {
      for (const element of [...mediaElements]) {
        if (mediaKinds.get(element) !== "music") disposeMediaElement(element);
      }
    }
    applyBusGains(0.16);

    if (!musicEnabled) {
      stopScheduler();
      fadeMusicAssetTo(0, 0.35, true);
    } else if (unlocked && active && !paused) {
      startSoundtrack(true);
    }

    return getSnapshot();
  }

  function startSession(session = {}) {
    desiredProfileId = selectTrainingAudioProfile(session);
    currentProfileId = desiredProfileId;
    active = true;
    paused = false;
    stepIndex = 0;
    nextStepTime = context ? context.currentTime + 0.05 : 0;
    applyBusGains(0.65);

    if (unlocked) {
      if (musicEnabled) startSoundtrack(true);
      playEffect("start");
    } else {
      pendingStartEffect = true;
    }
    return desiredProfileId;
  }

  function updateSession(session = {}) {
    const previousProfileId = desiredProfileId;
    desiredProfileId = selectTrainingAudioProfile(session);
    applyBusGains(0.45);
    if (unlocked && active && !paused && musicEnabled && previousProfileId !== desiredProfileId) {
      startSoundtrack(false);
    }
    return desiredProfileId;
  }

  function pause(options = {}) {
    if (!active || paused) return false;
    const immediate = options?.immediate === true;
    paused = true;
    stopScheduler();
    if (immediate) {
      stopSources("music");
      stopSources("effect");
      for (const element of [...mediaElements]) {
        if (mediaKinds.get(element) !== "music") disposeMediaElement(element);
      }
      fadeMusicTo(0, 0);
      fadeMusicAssetTo(0, 0, true);
    } else {
      fadeMusicTo(0, 0.32);
      fadeMusicAssetTo(0, 0.32, true);
    }
    return true;
  }

  function resume(session) {
    if (!active) return false;
    if (session) updateSession(session);
    paused = false;
    safelyResumeAudioContext();
    if (unlocked && musicEnabled) startSoundtrack(true);
    applyBusGains(0.55);
    return true;
  }

  function finishSession(options = {}) {
    if (!active && !options.force) return false;
    active = false;
    paused = false;
    pendingStartEffect = false;
    stopScheduler();
    fadeMusicTo(0, 0.65);
    fadeMusicAssetTo(0, 0.65, true);
    playEffect("finish", options);
    return true;
  }

  function stop() {
    active = false;
    paused = false;
    pendingStartEffect = false;
    stopScheduler();
    fadeMusicTo(0, 0.25);
    fadeMusicAssetTo(0, 0.25, true);
  }

  function startSoundtrack(resetSequence) {
    const asset = resolveTrainingAudioManifestAsset(manifest, "music", desiredProfileId, random);
    if (asset && playMusicAsset(asset, desiredProfileId)) {
      stopScheduler();
      fadeMusicTo(0, 0.18);
      return "asset";
    }
    fadeMusicAssetTo(0, 0.18, true);
    startScheduler(resetSequence);
    applyBusGains(0.55);
    return "procedural";
  }

  function playMusicAsset(asset, profileId) {
    if (!createAudioElement || failedMediaUrls.has(asset.url)) return false;
    if (currentMusic?.url === asset.url) {
      currentMusic.profileId = profileId;
      currentMusic.element.loop = true;
      fadeMediaElement(currentMusic.element, asset.volume ?? 0.18, 0.5);
      const element = currentMusic.element;
      const playing = attemptMediaPlay(element, asset.url, () => handleMusicAssetFailure(element));
      return playing;
    }

    const previous = currentMusic;
    const element = makeAudioElement(asset.url, "music");
    if (!element) return false;
    element.loop = true;
    element.volume = 0;
    currentMusic = { element, profileId, url: asset.url };
    if (previous) fadeMediaElement(previous.element, 0, 0.4, true);
    fadeMediaElement(element, asset.volume ?? 0.18, 0.55);
    const playing = attemptMediaPlay(element, asset.url, () => handleMusicAssetFailure(element));
    if (!playing) {
      if (currentMusic?.element === element) currentMusic = null;
      disposeMediaElement(element);
    }
    return playing;
  }

  function handleMusicAssetFailure(element) {
    const wasCurrentMusic = currentMusic?.element === element;
    if (wasCurrentMusic) currentMusic = null;
    disposeMediaElement(element);
    if (!wasCurrentMusic || !active || paused || !musicEnabled) return;
    startScheduler(true);
    applyBusGains(0.08);
  }

  function playEffect(effectName, effectOptions = {}) {
    if (!unlocked || destroyed || !effectsEnabled) return false;
    const recipe = getTrainingAudioEffectRecipe(effectName, effectOptions);
    const asset = resolveTrainingAudioManifestAsset(manifest, "effects", canonicalEffectId(effectName), random);
    const playedAsset = asset ? playOneShotAsset(asset, "effect", () => {
      if (context && graph) {
        for (const instruction of recipe) scheduleTone(instruction, context.currentTime, "effect");
      }
    }) : false;
    const synthesized = !playedAsset && recipe.length > 0 && context && graph;
    if (synthesized) {
      for (const instruction of recipe) scheduleTone(instruction, context.currentTime, "effect");
    }
    const voiceCue = effectOptions.voiceCue ?? defaultVoiceCue(effectName, effectOptions);
    const playedVoice = voiceCue ? playVoice(voiceCue, effectOptions) : false;
    return Boolean(playedAsset || synthesized || playedVoice);
  }

  function playVoice(voiceCue, voiceOptions = {}) {
    if (!unlocked || destroyed || !effectsEnabled || !createAudioElement) return false;
    const canonicalCue = canonicalVoiceId(voiceCue);
    if (!canonicalCue) return false;
    const now = wallClock();
    if (!voiceOptions.force && now - lastVoiceAt < voiceCooldownMs) return false;
    const asset = resolveTrainingAudioManifestAsset(manifest, "voices", canonicalCue, random);
    if (!asset || failedMediaUrls.has(asset.url)) return false;
    const played = playOneShotAsset(
      { ...asset, volume: asset.volume ?? 0.68 },
      "voice",
    );
    if (played) lastVoiceAt = now;
    return played;
  }

  function playOneShotAsset(asset, kind, onFailure) {
    if (!createAudioElement || failedMediaUrls.has(asset.url)) return false;
    const element = makeAudioElement(asset.url, kind);
    if (!element) return false;
    element.loop = false;
    element.volume = asset.volume ?? (kind === "voice" ? 0.68 : 0.52);
    let settled = false;
    const settle = (failed = false) => {
      if (settled) return;
      settled = true;
      const wasTracked = mediaElements.has(element);
      disposeMediaElement(element);
      if (failed && wasTracked) onFailure?.();
    };
    element.addEventListener?.("ended", () => settle(false), { once: true });
    element.addEventListener?.("error", () => settle(true), { once: true });
    element.addEventListener?.("abort", () => settle(true), { once: true });
    const playing = attemptMediaPlay(element, asset.url, () => settle(true));
    if (!playing) settle(false);
    return playing;
  }

  function makeAudioElement(url, kind) {
    try {
      const element = createAudioElement(url, kind);
      if (!element) return null;
      element.preload = "auto";
      element.playsInline = true;
      mediaElements.add(element);
      mediaKinds.set(element, kind);
      return element;
    } catch {
      failedMediaUrls.add(url);
      return null;
    }
  }

  function attemptMediaPlay(element, url, onFailure) {
    if (typeof element.play !== "function") {
      failedMediaUrls.add(url);
      return false;
    }
    try {
      const result = element.play();
      if (result && typeof result.catch === "function") {
        result.catch((error) => {
          if (!isTransientMediaPlayError(error)) failedMediaUrls.add(url);
          onFailure?.();
        });
      }
      return true;
    } catch (error) {
      if (!isTransientMediaPlayError(error)) failedMediaUrls.add(url);
      return false;
    }
  }

  function safelyResumeAudioContext() {
    if (!context || context.state === "running" || context.state === "closed" || typeof context.resume !== "function") return;
    try {
      const result = context.resume();
      result?.catch?.(() => {});
    } catch {
      // Audio remains a progressive enhancement if the browser rejects resume.
    }
  }

  function fadeMusicAssetTo(target, durationSeconds, pauseAfter = false) {
    if (!currentMusic) return;
    const music = currentMusic;
    if (pauseAfter) currentMusic = null;
    fadeMediaElement(music.element, target, durationSeconds, pauseAfter);
  }

  function fadeMediaElement(element, target, durationSeconds, pauseAfter = false) {
    cancelMediaFade(element);
    const start = clamp(Number(element.volume) || 0, 0, 1);
    const destination = clamp(target, 0, 1);
    const steps = Math.max(1, Math.round(durationSeconds * 20));
    if (!scheduleInterval || !cancelInterval || steps === 1) {
      element.volume = destination;
      if (pauseAfter) disposeMediaElement(element);
      return;
    }
    let completed = 0;
    const intervalId = scheduleInterval(() => {
      completed += 1;
      element.volume = start + (destination - start) * (completed / steps);
      if (completed < steps) return;
      cancelInterval(intervalId);
      mediaFadeTimers.delete(element);
      if (pauseAfter) disposeMediaElement(element);
    }, 50);
    mediaFadeTimers.set(element, intervalId);
  }

  function cancelMediaFade(element) {
    const intervalId = mediaFadeTimers.get(element);
    if (intervalId != null && cancelInterval) cancelInterval(intervalId);
    mediaFadeTimers.delete(element);
  }

  function disposeMediaElement(element) {
    cancelMediaFade(element);
    try { element.pause?.(); } catch { /* Already stopped. */ }
    mediaElements.delete(element);
    mediaKinds.delete(element);
  }

  function startScheduler(resetSequence = false) {
    if (!unlocked || destroyed || !active || paused || !musicEnabled || !context || !scheduleInterval) return;
    if (resetSequence) {
      stopScheduler();
      stopSources("music");
      stepIndex = 0;
      currentProfileId = desiredProfileId;
      nextStepTime = context.currentTime + 0.04;
    } else if (schedulerId != null) {
      return;
    }

    schedulerTick();
    schedulerId = scheduleInterval(schedulerTick, schedulerIntervalMs);
  }

  function schedulerTick() {
    if (!context || paused || !active || !musicEnabled) return;
    let guard = 0;
    while (nextStepTime < context.currentTime + lookAheadSeconds && guard < 24) {
      if (stepIndex > 0 && stepIndex % 8 === 0 && currentProfileId !== desiredProfileId) {
        currentProfileId = desiredProfileId;
      }
      const profile = TRAINING_AUDIO_PROFILES[currentProfileId];
      scheduleMusicStep(profile, stepIndex, nextStepTime);
      const stepDuration = 60 / profile.bpm / 2;
      nextStepTime += stepDuration;
      stepIndex += 1;
      guard += 1;
    }
  }

  function scheduleMusicStep(profile, absoluteStep, startTime) {
    const patternStep = absoluteStep % 8;
    const melodyDegree = profile.melody[patternStep];
    const bassDegree = profile.bass[patternStep];

    if (melodyDegree != null) {
      const frequency = midiToFrequency(profile.rootMidi + 12 + profile.scale[melodyDegree]);
      scheduleTone({
        kind: "tone",
        frequency,
        delay: 0,
        duration: profile.noteDuration,
        oscillator: profile.oscillator,
        gain: profile.noteGain,
        lowpassHz: profile.id === "urgent" ? 1850 : 2600,
      }, startTime, "music");
    }

    if (bassDegree != null) {
      scheduleTone({
        kind: "tone",
        frequency: midiToFrequency(profile.rootMidi - 12 + profile.scale[bassDegree]),
        delay: 0,
        duration: Math.max(0.12, profile.noteDuration * 0.82),
        oscillator: profile.id === "urgent" ? "square" : "triangle",
        gain: profile.bassGain,
        lowpassHz: 720,
      }, startTime, "music");
    }

    if (profile.percussion !== "none") {
      if (patternStep % 2 === 0) scheduleKick(startTime, profile.percussion === "urgent" ? 0.042 : 0.03);
      if (["drive", "urgent"].includes(profile.percussion) && patternStep % 2 === 1) {
        scheduleNoise(startTime, profile.percussion === "urgent" ? 0.018 : 0.012);
      }
      if (profile.percussion === "urgent" && patternStep === 7) scheduleNoise(startTime, 0.024);
    }
  }

  function scheduleKick(startTime, gainValue) {
    if (!context || !graph) return;
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    const endTime = startTime + 0.1;
    oscillator.type = "sine";
    setAudioParam(oscillator.frequency, 118, startTime);
    exponentialAudioParam(oscillator.frequency, 48, endTime);
    envelopeGain(gainNode.gain, gainValue, startTime, endTime);
    oscillator.connect(gainNode);
    gainNode.connect(graph.musicBus);
    registerSource(oscillator, [gainNode], "music");
    oscillator.start(startTime);
    oscillator.stop(endTime + 0.01);
  }

  function scheduleNoise(startTime, gainValue) {
    if (!context || !graph || typeof context.createBuffer !== "function" || typeof context.createBufferSource !== "function") return;
    const frameCount = Math.max(1, Math.round(context.sampleRate * 0.045));
    const buffer = context.createBuffer(1, frameCount, context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < channel.length; index += 1) channel[index] = random() * 2 - 1;
    const source = context.createBufferSource();
    const gainNode = context.createGain();
    const filter = typeof context.createBiquadFilter === "function" ? context.createBiquadFilter() : null;
    source.buffer = buffer;
    envelopeGain(gainNode.gain, gainValue, startTime, startTime + 0.04);
    if (filter) {
      filter.type = "highpass";
      setAudioParam(filter.frequency, 3_200, startTime);
      source.connect(filter);
      filter.connect(gainNode);
    } else {
      source.connect(gainNode);
    }
    gainNode.connect(graph.musicBus);
    registerSource(source, filter ? [filter, gainNode] : [gainNode], "music");
    source.start(startTime);
    source.stop(startTime + 0.05);
  }

  function scheduleTone(instruction, baseTime, sourceKind) {
    if (!context || !graph) return;
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    const filter = instruction.lowpassHz && typeof context.createBiquadFilter === "function"
      ? context.createBiquadFilter()
      : null;
    const startTime = baseTime + instruction.delay;
    const endTime = startTime + instruction.duration;
    oscillator.type = instruction.oscillator;
    setAudioParam(oscillator.frequency, instruction.frequency, startTime);
    if (instruction.endFrequency) exponentialAudioParam(oscillator.frequency, instruction.endFrequency, endTime);
    envelopeGain(gainNode.gain, instruction.gain, startTime, endTime);
    if (filter) {
      filter.type = "lowpass";
      setAudioParam(filter.frequency, instruction.lowpassHz, startTime);
      oscillator.connect(filter);
      filter.connect(gainNode);
    } else {
      oscillator.connect(gainNode);
    }
    gainNode.connect(sourceKind === "music" ? graph.musicBus : graph.effectsBus);
    registerSource(oscillator, filter ? [filter, gainNode] : [gainNode], sourceKind);
    oscillator.start(startTime);
    oscillator.stop(endTime + 0.015);
  }

  function registerSource(source, nodes, kind) {
    sources.set(source, kind);
    const cleanup = () => {
      sources.delete(source);
      safeDisconnect(source);
      for (const node of nodes) safeDisconnect(node);
    };
    if (typeof source.addEventListener === "function") source.addEventListener("ended", cleanup, { once: true });
    else source.onended = cleanup;
  }

  function stopSources(kind = null) {
    for (const [source, sourceKind] of sources) {
      if (kind && sourceKind !== kind) continue;
      try { source.stop(); } catch { /* A source may already have ended. */ }
      sources.delete(source);
      safeDisconnect(source);
    }
  }

  function stopScheduler() {
    if (schedulerId == null) return;
    if (cancelInterval) cancelInterval(schedulerId);
    schedulerId = null;
  }

  function applyBusGains(durationSeconds) {
    if (!context || !graph) return;
    const profile = TRAINING_AUDIO_PROFILES[desiredProfileId];
    rampAudioParam(
      graph.musicBus.gain,
      musicEnabled && active && !paused ? profile.busGain : 0,
      context.currentTime,
      durationSeconds,
    );
    rampAudioParam(
      graph.effectsBus.gain,
      effectsEnabled ? 0.72 : 0,
      context.currentTime,
      durationSeconds,
    );
  }

  function fadeMusicTo(value, durationSeconds) {
    if (!context || !graph) return;
    rampAudioParam(graph.musicBus.gain, value, context.currentTime, durationSeconds);
  }

  function getSnapshot() {
    return {
      available: Boolean(AudioContextClass),
      unlocked,
      active,
      paused,
      musicEnabled,
      effectsEnabled,
      profileId: desiredProfileId,
      playingProfileId: currentProfileId,
      schedulerActive: schedulerId != null,
      contextState: context?.state ?? "uninitialized",
    };
  }

  async function destroy() {
    if (destroyed) return;
    destroyed = true;
    active = false;
    stopScheduler();
    stopSources();
    for (const element of [...mediaElements]) disposeMediaElement(element);
    currentMusic = null;
    if (context && context.state !== "closed" && typeof context.close === "function") {
      try { await context.close(); } catch { /* Progressive enhancement only. */ }
    }
    context = null;
    graph = null;
    unlocked = false;
  }

  return Object.freeze({
    configure,
    destroy,
    finishSession,
    getSnapshot,
    pause,
    playEffect,
    playVoice,
    resume,
    startSession,
    stop,
    unlock,
    updateSession,
  });
}

function createAudioGraph(context, settings) {
  const musicBus = context.createGain();
  const effectsBus = context.createGain();
  const limiter = typeof context.createDynamicsCompressor === "function"
    ? context.createDynamicsCompressor()
    : context.createGain();
  setAudioParam(musicBus.gain, settings.musicEnabled ? 0 : 0, context.currentTime);
  setAudioParam(effectsBus.gain, settings.effectsEnabled ? 0.72 : 0, context.currentTime);
  if (limiter.threshold) setAudioParam(limiter.threshold, -12, context.currentTime);
  if (limiter.knee) setAudioParam(limiter.knee, 12, context.currentTime);
  if (limiter.ratio) setAudioParam(limiter.ratio, 8, context.currentTime);
  if (limiter.attack) setAudioParam(limiter.attack, 0.003, context.currentTime);
  if (limiter.release) setAudioParam(limiter.release, 0.18, context.currentTime);
  musicBus.connect(limiter);
  effectsBus.connect(limiter);
  limiter.connect(context.destination);
  return { musicBus, effectsBus, limiter };
}

function semanticDifficultyRating(input) {
  const explicitRating = finiteNumber(
    input.difficultyRating ?? input.question?.difficultyRating,
    Number.NaN,
  );
  if (Number.isFinite(explicitRating)) return clamp(explicitRating, 1, 100);
  const legacyDifficulty = finiteNumber(
    input.currentDifficulty ?? input.difficulty ?? input.question?.difficulty,
    1,
  );
  return clamp(legacyDifficulty * 10, 1, 100);
}

function tone(frequency, delay, duration, oscillator, gain) {
  return { kind: "tone", frequency, delay, duration, oscillator, gain };
}

function sweep(frequency, endFrequency, delay, duration, oscillator, gain) {
  return { ...tone(frequency, delay, duration, oscillator, gain), endFrequency };
}

function midiToFrequency(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

function envelopeGain(param, peak, startTime, endTime) {
  if (!param) return;
  param.cancelScheduledValues?.(startTime);
  param.setValueAtTime?.(0.0001, startTime);
  param.exponentialRampToValueAtTime?.(Math.max(0.0001, peak), startTime + Math.min(0.025, (endTime - startTime) / 3));
  param.exponentialRampToValueAtTime?.(0.0001, endTime);
}

function rampAudioParam(param, target, now, duration) {
  if (!param) return;
  const current = Number.isFinite(param.value) ? param.value : 0;
  param.cancelScheduledValues?.(now);
  param.setValueAtTime?.(current, now);
  if (duration > 0 && typeof param.linearRampToValueAtTime === "function") {
    param.linearRampToValueAtTime(target, now + duration);
  } else {
    setAudioParam(param, target, now);
  }
}

function setAudioParam(param, value, atTime) {
  if (!param) return;
  if (typeof param.setValueAtTime === "function") param.setValueAtTime(value, atTime);
  else param.value = value;
}

function exponentialAudioParam(param, value, atTime) {
  if (typeof param?.exponentialRampToValueAtTime === "function") {
    param.exponentialRampToValueAtTime(Math.max(0.0001, value), atTime);
  } else if (param) {
    param.value = value;
  }
}

function safeDisconnect(node) {
  try { node?.disconnect?.(); } catch { /* Already disconnected. */ }
}

function resolveAudioContextClass(options) {
  if (Object.hasOwn(options, "AudioContextClass")) return options.AudioContextClass;
  if (typeof globalThis === "undefined") return null;
  return globalThis.AudioContext ?? globalThis.webkitAudioContext ?? null;
}

function resolveAudioElementFactory(options) {
  if (Object.hasOwn(options, "createAudioElement")) return options.createAudioElement;
  if (typeof globalThis?.Audio !== "function") return null;
  return (url) => new globalThis.Audio(url);
}

function mergeTrainingAudioManifest(manifest) {
  const candidate = manifest && typeof manifest === "object" ? manifest : {};
  return {
    music: { ...DEFAULT_TRAINING_AUDIO_MANIFEST.music, ...(candidate.music ?? {}) },
    effects: { ...DEFAULT_TRAINING_AUDIO_MANIFEST.effects, ...(candidate.effects ?? {}) },
    voices: { ...DEFAULT_TRAINING_AUDIO_MANIFEST.voices, ...(candidate.voices ?? {}) },
  };
}

function canonicalEffectId(value) {
  const normalized = normalizeId(value).replace(/[^a-z]/g, "");
  return TRAINING_AUDIO_EFFECTS.find((effect) => effect.toLowerCase() === normalized) ?? normalized;
}

function canonicalVoiceId(value) {
  const normalized = normalizeId(value).replace(/[^a-z]/g, "");
  return TRAINING_AUDIO_VOICES.find(
    (voice) => voice.toLowerCase() === normalized,
  ) ?? null;
}

function defaultVoiceCue(effectName, options) {
  const effect = canonicalEffectId(effectName);
  if (effect === "start") return "ready";
  if (effect === "correct") return "correct";
  if (effect === "wrong") return "wrong";
  if (effect === "combo" && positiveInteger(options.combo, 1) >= 5) return "congratulations";
  if (effect === "tick" && options.hurry) return "hurry";
  if (effect !== "finish") return null;
  if (options.newHighscore || options.isNewRecord) return "newHighscore";
  if (options.gameOver) return "gameOver";
  if (options.timedOut || options.timeOver) return "timeOver";
  return options.success === false ? "gameOver" : "congratulations";
}

function isTransientMediaPlayError(error) {
  const name = normalizeId(error?.name);
  const message = normalizeId(error?.message);
  return ["notallowederror", "aborterror"].includes(name)
    || message.includes("autoplay")
    || message.includes("user gesture")
    || message.includes("user interaction");
}

function normalizeId(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function finiteNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function positiveNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function positiveInteger(value, fallback) {
  return Math.max(1, Math.round(positiveNumber(value, fallback)));
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}
