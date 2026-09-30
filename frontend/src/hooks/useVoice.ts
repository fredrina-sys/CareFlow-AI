import { useCallback, useEffect, useRef, useState } from "react";

// Web Speech API interfaces
const getSR = (): any =>
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export const voiceSupported = () => !!getSR();
export type VoiceState = "idle" | "listening" | "error";

const ERRORS: Record<string, string> = {
  "not-allowed":
    "Microphone permission was denied. Please click the lock or camera icon in your browser address bar and set Microphone to 'Allow'.",
  "service-not-allowed": "Speech recognition is blocked by browser or system settings.",
  "audio-capture": "No microphone detected. Please plug in or enable your microphone.",
  "no-speech": "No speech was detected. Please speak closer to your microphone and try again.",
  network:
    "Speech service could not be reached. Chromium speech recognition requires an active internet connection to Google Speech servers.",
  "language-not-supported": "Selected language is not supported for voice input in this browser.",
  aborted: "",
};

// Voice caching
let cachedVoices: SpeechSynthesisVoice[] = [];
function updateVoices() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    cachedVoices = window.speechSynthesis.getVoices();
  }
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  updateVoices();
  window.speechSynthesis.onvoiceschanged = updateVoices;
}

export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (cachedVoices.length === 0) updateVoices();
  return cachedVoices;
}

export function hasKannadaVoice(): boolean {
  const vs = getAvailableVoices();
  return vs.some(
    (v) => v.lang.toLowerCase().startsWith("kn") || v.name.toLowerCase().includes("kannada")
  );
}

export function playChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.12); // E5
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.22);
  } catch {
    // Ignored if audio policy blocks autoplay before interaction
  }
}

export function useVoice(
  lang: string,
  onFinal: (text: string) => void,
  onInterim?: (text: string) => void
) {
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);
  const [isSpeakingSound, setIsSpeakingSound] = useState(false);
  const [currentLang, setCurrentLang] = useState(lang === "kn" ? "kn-IN" : "en-IN");

  const rec = useRef<any>(null);
  const cancelled = useRef(false);
  const cb = useRef(onFinal);
  cb.current = onFinal;
  const interimCb = useRef(onInterim);
  interimCb.current = onInterim;

  const accumulatedTextRef = useRef("");
  const latestTranscriptRef = useRef("");
  const pulseTimerRef = useRef<any>(null);

  // Dynamic audio level indicator while listening
  const startVolumePulse = () => {
    if (pulseTimerRef.current) clearInterval(pulseTimerRef.current);
    let tick = 0;
    pulseTimerRef.current = setInterval(() => {
      tick++;
      // Natural oscillating audio pulse between 35 and 85
      const wave = Math.round(55 + 25 * Math.sin(tick * 0.45));
      setAudioLevel(wave);
    }, 120);
  };

  const stopVolumePulse = () => {
    if (pulseTimerRef.current) {
      clearInterval(pulseTimerRef.current);
      pulseTimerRef.current = null;
    }
    setAudioLevel(0);
    setIsSpeakingSound(false);
  };

  const start: (overrideLang?: string) => void = useCallback(
    (overrideLang?: string) => {
      // 1. Immediately stop any active TTS prompt so mic doesn't hear computer's speaker
      stopSpeaking();

      const SR = getSR();
      if (!SR) {
        setError(
          "Voice input requires Google Chrome, Microsoft Edge, or a Web Speech API compatible browser."
        );
        setState("error");
        return;
      }

      try {
        rec.current?.abort();
      } catch {}

      cancelled.current = false;
      setError("");
      setTranscript("");
      accumulatedTextRef.current = "";
      latestTranscriptRef.current = "";

      const r = new SR();
      const l = overrideLang ?? (lang === "kn" ? "kn-IN" : "en-IN");
      setCurrentLang(l);
      r.lang = l;
      r.interimResults = true;
      r.continuous = true;
      r.maxAlternatives = 1;

      r.onstart = () => {
        setState("listening");
        startVolumePulse();
      };

      r.onsoundstart = () => {
        setIsSpeakingSound(true);
      };

      r.onspeechstart = () => {
        setIsSpeakingSound(true);
      };

      r.onspeechend = () => {
        setIsSpeakingSound(false);
      };

      r.onsoundend = () => {
        setIsSpeakingSound(false);
      };

      r.onresult = (e: any) => {
        let interimText = "";
        let finalChunk = "";

        for (let i = e.resultIndex; i < e.results.length; i++) {
          const item = e.results[i];
          const spoken = item[0]?.transcript || "";
          if (item.isFinal) {
            finalChunk += (finalChunk ? " " : "") + spoken.trim();
          } else {
            interimText += (interimText ? " " : "") + spoken.trim();
          }
        }

        if (finalChunk) {
          accumulatedTextRef.current = (
            accumulatedTextRef.current + " " + finalChunk
          ).trim();
          latestTranscriptRef.current = accumulatedTextRef.current;
          setTranscript(accumulatedTextRef.current);
          if (cb.current && !cancelled.current) {
            cb.current(accumulatedTextRef.current);
          }
        } else if (interimText) {
          const currentCombined = (
            accumulatedTextRef.current + " " + interimText
          ).trim();
          latestTranscriptRef.current = currentCombined;
          setTranscript(currentCombined);
          if (interimCb.current && !cancelled.current) {
            interimCb.current(currentCombined);
          }
        }
      };

      r.onerror = (e: any) => {
        console.warn("Speech recognition error:", e.error);
        if (e.error === "language-not-supported" && l !== "en-IN") {
          console.warn("Language not supported by recognizer, falling back to en-IN");
          setError("Switched voice recognition to English (en-IN). Please speak now.");
          start("en-IN");
          return;
        }

        if (e.error === "no-speech") {
          // If already caught some text, silently finish without reporting error
          if (latestTranscriptRef.current) {
            stopVolumePulse();
            setState("idle");
            return;
          }
          // Do not lock into permanent error on silence; allow easy retry
          setError("No speech was detected. Tap the microphone and speak clearly.");
          stopVolumePulse();
          setState("idle");
          return;
        }

        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          setError(
            "Microphone permission blocked. Please click the lock or settings icon in your browser address bar and allow Microphone access for this site."
          );
          setState("error");
        } else if (e.error !== "aborted") {
          setError(
            ERRORS[e.error] ||
              `Microphone error (${e.error}). Please check microphone permissions.`
          );
          setState("error");
        }
        stopVolumePulse();
      };

      r.onend = () => {
        stopVolumePulse();
        setState((s) => (s === "error" ? s : "idle"));
        // Guarantee final text commit
        const textToCommit = latestTranscriptRef.current || accumulatedTextRef.current;
        if (textToCommit && cb.current && !cancelled.current) {
          cb.current(textToCommit);
        }
      };

      rec.current = r;
      try {
        r.start();
      } catch (err: any) {
        console.error("SpeechRecognition start exception:", err);
        setError("Could not start microphone. Please check browser microphone permissions.");
        setState("error");
        stopVolumePulse();
      }
    },
    [lang]
  );

  const stop = useCallback(() => {
    try {
      rec.current?.stop();
    } catch {}
    stopVolumePulse();
    setState("idle");
    const textToCommit = latestTranscriptRef.current || accumulatedTextRef.current;
    if (textToCommit && cb.current && !cancelled.current) {
      cb.current(textToCommit);
    }
  }, []);

  const cancel = useCallback(() => {
    cancelled.current = true;
    try {
      rec.current?.abort();
    } catch {}
    stopVolumePulse();
    setState("idle");
    setTranscript("");
    accumulatedTextRef.current = "";
    latestTranscriptRef.current = "";
  }, []);

  const clear = useCallback(() => {
    setTranscript("");
    setError("");
    accumulatedTextRef.current = "";
    latestTranscriptRef.current = "";
    if (state === "error") setState("idle");
  }, [state]);

  useEffect(() => {
    return () => {
      try {
        rec.current?.abort();
      } catch {}
      stopVolumePulse();
    };
  }, []);

  return {
    state,
    transcript,
    error,
    audioLevel,
    isSpeakingSound,
    currentLang,
    start,
    stop,
    cancel,
    clear,
    supported: voiceSupported(),
  };
}

export function speak(
  text: string,
  lang: string,
  onEnd?: () => void,
  fallbackSpokenText?: string
) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    if (onEnd) onEnd();
    return;
  }

  // Audio cue before playback
  playChime();

  try {
    speechSynthesis.cancel();
    speechSynthesis.resume();
  } catch {}

  const voices = getAvailableVoices();
  const isKn = lang === "kn";

  const knVoice = voices.find(
    (v) =>
      v.lang.toLowerCase().startsWith("kn") ||
      v.name.toLowerCase().includes("kannada")
  );

  const inVoice = voices.find(
    (v) =>
      v.lang.toLowerCase().startsWith("en-in") ||
      v.lang.toLowerCase().startsWith("hi") ||
      v.name.toLowerCase().includes("india") ||
      v.name.toLowerCase().includes("ravi") ||
      v.name.toLowerCase().includes("heera")
  );

  let textToSpeak = text;
  let voiceToUse: SpeechSynthesisVoice | undefined = undefined;
  let targetLang = "en-IN";

  if (isKn) {
    if (knVoice) {
      voiceToUse = knVoice;
      targetLang = knVoice.lang;
      textToSpeak = text;
    } else {
      // Fallback: If OS lacks native Kannada voice, speak fallback prompt with Indian accent
      textToSpeak = fallbackSpokenText || text;
      voiceToUse =
        inVoice ||
        voices.find((v) => v.lang.toLowerCase().startsWith("en")) ||
        voices[0];
      targetLang = voiceToUse ? voiceToUse.lang : "en-IN";
    }
  } else {
    voiceToUse =
      inVoice ||
      voices.find((v) => v.lang.toLowerCase().startsWith("en")) ||
      voices[0];
    targetLang = voiceToUse ? voiceToUse.lang : "en-IN";
    textToSpeak = text;
  }

  const u = new SpeechSynthesisUtterance(textToSpeak);
  if (voiceToUse) u.voice = voiceToUse;
  u.lang = targetLang;
  u.rate = isKn && knVoice ? 0.9 : 0.95;
  u.pitch = 1.0;

  if (onEnd) {
    u.onend = () => onEnd();
    u.onerror = () => onEnd();
  }

  try {
    speechSynthesis.speak(u);
  } catch (err) {
    console.warn("SpeechSynthesis error:", err);
    if (onEnd) onEnd();
  }
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      speechSynthesis.cancel();
    } catch {}
  }
}

export function useDictation(lang: string = "en", onAppend?: (text: string) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const rec = useRef<any>(null);

  const start = useCallback(() => {
    stopSpeaking();
    const SR = getSR();
    if (!SR) return;
    try {
      rec.current?.abort();
    } catch {}
    setTranscript("");
    const r = new SR();
    r.lang = lang === "kn" ? "kn-IN" : "en-IN";
    r.interimResults = true;
    r.continuous = true;
    r.onstart = () => setIsRecording(true);
    r.onresult = (e: any) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      setTranscript(t);
      if (e.results[e.results.length - 1].isFinal && t.trim()) {
        if (onAppend) onAppend(t.trim());
      }
    };
    r.onend = () => setIsRecording(false);
    r.onerror = () => setIsRecording(false);
    rec.current = r;
    try {
      r.start();
    } catch {
      setIsRecording(false);
    }
  }, [lang, onAppend]);

  const stop = useCallback(() => {
    try {
      rec.current?.stop();
    } catch {}
    setIsRecording(false);
  }, []);

  return { isRecording, transcript, start, stop, supported: voiceSupported() };
}
