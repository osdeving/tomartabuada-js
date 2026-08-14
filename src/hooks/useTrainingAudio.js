import { useCallback, useEffect, useRef } from "react";
import { createTrainingAudioEngine } from "../lib/platform/trainingAudio";
import { APP_TRAINING_AUDIO_MANIFEST } from "../lib/platform/trainingAudioManifest";

/**
 * React lifecycle wrapper for the imperative audio engine. Creating the hook
 * does not create an AudioContext; callers must invoke unlock() synchronously
 * from a click, pointer or keyboard gesture before starting audible playback.
 */
export function useTrainingAudio({ effectsEnabled = true, musicEnabled = true } = {}) {
  const engineRef = useRef(null);
  const initialOptionsRef = useRef({ effectsEnabled, musicEnabled });
  const ensureEngine = useCallback(() => {
    if (!engineRef.current) {
      engineRef.current = createTrainingAudioEngine({
        ...initialOptionsRef.current,
        manifest: APP_TRAINING_AUDIO_MANIFEST,
      });
    }
    return engineRef.current;
  }, []);
  ensureEngine();

  useEffect(() => {
    ensureEngine().configure({ effectsEnabled, musicEnabled });
  }, [effectsEnabled, ensureEngine, musicEnabled]);

  useEffect(() => {
    ensureEngine();
    return () => {
      const engine = engineRef.current;
      engineRef.current = null;
      void engine?.destroy();
    };
  }, [ensureEngine]);

  const unlock = useCallback(() => ensureEngine().unlock(), [ensureEngine]);
  const startSession = useCallback((session) => ensureEngine().startSession(session), [ensureEngine]);
  const updateSession = useCallback((session) => ensureEngine().updateSession(session), [ensureEngine]);
  const pause = useCallback((options) => ensureEngine().pause(options), [ensureEngine]);
  const resume = useCallback((session) => ensureEngine().resume(session), [ensureEngine]);
  const finishSession = useCallback((options) => ensureEngine().finishSession(options), [ensureEngine]);
  const stop = useCallback(() => ensureEngine().stop(), [ensureEngine]);
  const playEffect = useCallback((effectName, options) => ensureEngine().playEffect(effectName, options), [ensureEngine]);
  const playVoice = useCallback((voiceCue, options) => ensureEngine().playVoice(voiceCue, options), [ensureEngine]);
  const getSnapshot = useCallback(() => ensureEngine().getSnapshot(), [ensureEngine]);

  return {
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
  };
}
