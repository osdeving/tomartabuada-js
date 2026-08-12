import { useCallback, useRef } from "react";

export function useGameAudio() {
  const audioContextRef = useRef(null);

  const ensureAudioContext = useCallback(() => {
    if (typeof window === "undefined") {
      return null;
    }

    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) {
        return null;
      }

      audioContextRef.current = new AudioContextClass();
    }

    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }

    return audioContextRef.current;
  }, []);

  const playTone = useCallback((frequency, durationMs, type, volume = 0.04) => {
    const context = ensureAudioContext();

    if (!context) {
      return;
    }

    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    const now = context.currentTime;
    const durationSeconds = durationMs / 1000;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    gainNode.gain.setValueAtTime(volume, now);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + durationSeconds);
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + durationSeconds);
  }, [ensureAudioContext]);

  const playGood = useCallback(() => {
    playTone(760, 110, "triangle", 0.045);
    window.setTimeout(() => playTone(980, 90, "sine", 0.04), 55);
  }, [playTone]);

  const playBad = useCallback(() => {
    playTone(180, 170, "sawtooth", 0.05);
  }, [playTone]);

  return {
    playGood,
    playBad,
    unlock: ensureAudioContext,
  };
}
