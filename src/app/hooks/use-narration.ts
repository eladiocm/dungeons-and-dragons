'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CampaignMessage } from '@/game/session-types';
import { isRecord } from '@/lib/game-contract';
import {
  narrationChunks,
  narrationWords,
  wordAtCharacter,
  wordAtTime,
} from '@/lib/narration-progress';
import { type Speaker, VOICES } from '@/lib/speech-contract';

type Voice = Speaker | 'device';
type Status = 'idle' | 'loading' | 'playing' | 'paused' | 'ready';
const SETTINGS = 'dnd-voice-v2';
export function useNarration(
  messages: CampaignMessage[],
  hydrated: boolean,
  cloudAvailable: boolean | undefined,
  sessionId?: string,
  ready = true,
) {
  const [voice, setVoice] = useState<Voice>('nestor'),
    [automatic, setAutomatic] = useState(true),
    [status, setStatus] = useState<Status>('idle'),
    [hint, setHint] = useState<string | null>(null),
    [hasAudio, setHasAudio] = useState(false),
    [deviceSupported, setDeviceSupported] = useState(false),
    [activeMessageId, setActiveMessageId] = useState<string | null>(null),
    [activeWord, setActiveWord] = useState(-1),
    [highlight, setHighlight] = useState(true),
    [rate, setRate] = useState(0.96),
    [volume, setVolume] = useState(0.9);
  const audioRef = useRef<HTMLAudioElement | null>(null),
    generation = useRef(0),
    controller = useRef<AbortController | null>(null),
    cache = useRef(new Map<string, string[]>()),
    armed = useRef(false),
    seen = useRef(''),
    autoRef = useRef(true),
    cloudRef = useRef(cloudAvailable),
    timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined),
    settingsReady = useRef(false),
    lastSession = useRef(sessionId),
    deviceClock = useRef({
      elapsed: 0,
      started: 0,
      duration: 1,
      text: '',
      run: 0,
      boundaries: false,
    }),
    currentSession = useRef(sessionId);
  cloudRef.current = cloudAvailable;
  currentSession.current = sessionId;
  const stop = useCallback(() => {
    generation.current++;
    controller.current?.abort();
    clearInterval(timer.current);
    const audio = audioRef.current;
    audio?.pause();
    audioRef.current = null;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setStatus('idle');
    setActiveMessageId(null);
    setActiveWord(-1);
    setHasAudio(false);
  }, []);
  const clear = useCallback(() => {
    for (const urls of cache.current.values())
      for (const url of urls) URL.revokeObjectURL(url);
    cache.current.clear();
  }, []);
  useEffect(() => {
    setDeviceSupported('speechSynthesis' in window);
    try {
      const raw =
          localStorage.getItem(SETTINGS) ||
          localStorage.getItem('dnd-voice-v1') ||
          '{}',
        value: unknown = JSON.parse(raw);
      if (isRecord(value)) {
        if (
          value.voice === 'device' ||
          VOICES.some((v) => v.id === value.voice)
        )
          setVoice(value.voice as Voice);
        if (typeof value.automatic === 'boolean') {
          autoRef.current = value.automatic;
          setAutomatic(value.automatic);
        }
        if (typeof value.highlight === 'boolean') setHighlight(value.highlight);
        if (
          typeof value.rate === 'number' &&
          value.rate >= 0.7 &&
          value.rate <= 1.3
        )
          setRate(value.rate);
        if (
          typeof value.volume === 'number' &&
          value.volume >= 0 &&
          value.volume <= 1
        )
          setVolume(value.volume);
      }
    } catch {}
    settingsReady.current = true;
    return () => {
      stop();
      clear();
    };
  }, [stop, clear]);
  useEffect(() => {
    if (settingsReady.current)
      try {
        localStorage.setItem(
          SETTINGS,
          JSON.stringify({ voice, automatic, highlight, rate, volume }),
        );
      } catch {}
  }, [voice, automatic, highlight, rate, volume]);
  useEffect(() => {
    if (cloudAvailable === false && deviceSupported && voice !== 'device')
      setVoice('device');
  }, [cloudAvailable, deviceSupported, voice]);
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
      audioRef.current.volume = volume;
    }
  }, [rate, volume]);
  const play = useCallback(async (audio: HTMLAudioElement, run: number) => {
    try {
      await audio.play();
      if (run !== generation.current) {
        audio.pause();
        return;
      }
      setStatus('playing');
      setHint(null);
    } catch {
      if (run !== generation.current) {
        audio.pause();
        return;
      }
      setStatus('ready');
      setHint(
        'El navegador espera una pulsación. Pulsa reproducir para escuchar la escena.',
      );
    }
  }, []);
  const listen = useCallback(
    async (message: CampaignMessage) => {
      if (message.role !== 'assistant') return;
      stop();
      armed.current = true;
      setHint(null);
      const run = generation.current;
      setActiveMessageId(message.id);
      setActiveWord(-1);
      if (voice === 'device') {
        if (!('speechSynthesis' in window)) {
          setHint(
            'Este navegador no ofrece voz del dispositivo. Puedes seguir leyendo.',
          );
          return;
        }
        const utterance = new SpeechSynthesisUtterance(message.content);
        utterance.lang = 'es';
        utterance.rate = rate;
        utterance.volume = volume;
        const voices = window.speechSynthesis.getVoices();
        utterance.voice =
          voices.find((v) => v.lang.startsWith('es') && v.localService) ||
          voices.find((v) => v.lang.startsWith('es')) ||
          null;
        const clock = {
          elapsed: 0,
          started: 0,
          duration: Math.max(
            1,
            (narrationWords(message.content).length * 0.43) / rate,
          ),
          text: message.content,
          run,
          boundaries: false,
        };
        deviceClock.current = clock;
        utterance.onstart = () => {
          if (run !== generation.current) return;
          setStatus('playing');
          clock.started = performance.now();
          setActiveWord(0);
          timer.current = setInterval(() => {
            if (
              clock.boundaries ||
              run !== generation.current ||
              !clock.started
            )
              return;
            setActiveWord(
              wordAtTime(
                clock.text,
                clock.elapsed + (performance.now() - clock.started) / 1000,
                clock.duration,
              ),
            );
          }, 120);
        };
        utterance.onboundary = (e) => {
          if (run !== generation.current || !clock.started) return;
          clock.boundaries = true;
          setActiveWord(wordAtCharacter(message.content, e.charIndex));
        };
        utterance.onend = () => {
          if (run === generation.current) {
            clearInterval(timer.current);
            setStatus('idle');
            setActiveWord(-1);
          }
        };
        utterance.onerror = () => {
          if (run === generation.current) {
            clearInterval(timer.current);
            setStatus('idle');
            setHint(
              'La voz del dispositivo no pudo completarse. Puedes volver a reproducir.',
            );
          }
        };
        setStatus('loading');
        window.speechSynthesis.speak(utterance);
        return;
      }
      if (cloudRef.current !== true || !sessionId) {
        setStatus('idle');
        setHint(
          'La voz natural no está disponible. Elige la voz del dispositivo en el menú.',
        );
        return;
      }
      const key = `${sessionId}:${message.id}:${voice}:${message.content}`,
        chunks = narrationChunks(message.content);
      let urls = cache.current.get(key);
      if (!urls) {
        const abort = new AbortController();
        controller.current = abort;
        setStatus('loading');
        const created: string[] = [];
        try {
          for (const [chunkIndex] of chunks.entries()) {
            const response = await fetch(`/api/sessions/${sessionId}/speech`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                messageId: message.id,
                chunkIndex,
                speaker: voice,
              }),
              signal: AbortSignal.any([
                abort.signal,
                AbortSignal.timeout(70000),
              ]),
            });
            if (!response.ok) {
              const data = await response.json();
              throw new Error(data.error || 'No se pudo preparar la voz.');
            }
            const blob = await response.blob();
            if (run !== generation.current || abort.signal.aborted) break;
            created.push(URL.createObjectURL(blob));
          }
          if (run !== generation.current || abort.signal.aborted) {
            for (const url of created) URL.revokeObjectURL(url);
            return;
          }
          urls = created;
          while (cache.current.size >= 4) {
            const oldest = cache.current.entries().next().value;
            if (!oldest) break;
            oldest[1].forEach((url) => {
              URL.revokeObjectURL(url);
            });
            cache.current.delete(oldest[0]);
          }
          cache.current.set(key, urls);
        } catch (e) {
          created.forEach((url) => {
            URL.revokeObjectURL(url);
          });
          if (run === generation.current && !abort.signal.aborted) {
            setStatus('idle');
            setHint(
              e instanceof Error
                ? e.message
                : 'No se pudo preparar la narración.',
            );
          }
          return;
        }
      }
      if (run !== generation.current || !urls.length) return;
      const audio = new Audio();
      audioRef.current = audio;
      audio.preload = 'auto';
      audio.playbackRate = rate;
      audio.volume = volume;
      let index = 0;
      const progress = () => {
        // Browsers can dispatch a final queued timeupdate after pause().
        if (run !== generation.current || audio.paused) return;
        const chunk = chunks[index],
          word = wordAtTime(chunk.text, audio.currentTime, audio.duration);
        setActiveWord(word < 0 ? -1 : chunk.firstWord + word);
      };
      audio.ontimeupdate = progress;
      audio.onloadedmetadata = progress;
      audio.onended = () => {
        if (run !== generation.current) return;
        index++;
        if (urls?.[index]) {
          audio.src = urls[index];
          void play(audio, run);
        } else {
          setStatus('idle');
          setActiveWord(-1);
        }
      };
      audio.onerror = () => {
        if (run === generation.current) {
          setStatus('idle');
          setHint(
            'El audio no pudo reproducirse. Puedes volver a escuchar la escena.',
          );
        }
      };
      audio.src = urls[0];
      setHasAudio(true);
      setActiveWord(0);
      await play(audio, run);
    },
    [voice, rate, volume, sessionId, stop, play],
  );
  useEffect(() => {
    if (lastSession.current !== sessionId) {
      stop();
      clear();
      seen.current = '';
      lastSession.current = sessionId;
    }
  }, [sessionId, stop, clear]);
  useEffect(() => {
    if (!hydrated || !ready || !settingsReady.current) return;
    const latest = messages.findLast((m) => m.role === 'assistant');
    if (!latest) return;
    const key = `${latest.id}:${latest.content}`;
    if (key === seen.current) return;
    if (!autoRef.current || !armed.current) return;
    seen.current = key;
    void listen(latest);
  }, [messages, hydrated, ready, listen]);
  const changeVoice = (next: Voice) => {
    stop();
    setHint(null);
    setVoice(next);
  };
  const toggleAutomatic = (enabled: boolean) => {
    autoRef.current = enabled;
    setAutomatic(enabled);
    if (!enabled) {
      stop();
      return;
    }
    armed.current = true;
    const latest = messages.findLast((m) => m.role === 'assistant');
    if (latest && ready) {
      seen.current = `${latest.id}:${latest.content}`;
      void listen(latest);
    }
  };
  const pauseOrResume = () => {
    if (voice === 'device') {
      const clock = deviceClock.current;
      if (status === 'paused') {
        clock.started = performance.now();
        window.speechSynthesis.resume();
        setStatus('playing');
      } else if (status === 'playing') {
        if (clock.started)
          clock.elapsed += (performance.now() - clock.started) / 1000;
        clock.started = 0;
        window.speechSynthesis.pause();
        setStatus('paused');
      }
    } else {
      const audio = audioRef.current;
      if (!audio) return;
      if (status === 'paused' || status === 'ready')
        void play(audio, generation.current);
      else {
        audio.pause();
        setStatus('paused');
      }
    }
  };
  return {
    voice,
    automatic,
    status,
    hint,
    audioRef,
    hasAudio,
    deviceSupported,
    listen,
    stop,
    changeVoice,
    toggleAutomatic,
    pauseOrResume,
    activeMessageId,
    activeWord,
    highlight,
    setHighlight,
    rate,
    volume,
    changeRate: (next: number) => {
      if (voice === 'device') stop();
      setRate(next);
    },
    changeVolume: (next: number) => {
      if (voice === 'device') stop();
      setVolume(next);
    },
    arm: () => {
      armed.current = true;
      seen.current = '';
    },
    ended: () => {},
    onPlay: () => {},
    onPause: () => {},
    onAudioError: () => {},
  };
}
