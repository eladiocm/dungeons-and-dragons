'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameMessage } from '@/lib/game-contract';
import { isRecord } from '@/lib/game-contract';
import { type Speaker, splitSpeechText, VOICES } from '@/lib/speech-contract';

type Voice = Speaker | 'device';
type Status = 'idle' | 'loading' | 'playing' | 'paused' | 'ready';
const SETTINGS_KEY = 'dnd-voice-v1';
export function useNarration(
  messages: GameMessage[],
  hydrated: boolean,
  cloudAvailable: boolean | undefined,
  sessionId?: string,
) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [voice, setVoice] = useState<Voice>('nestor');
  const [automatic, setAutomatic] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [hint, setHint] = useState<string | null>(null);
  const [hasAudio, setHasAudio] = useState(false);
  const [deviceSupported, setDeviceSupported] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const cache = useRef(new Map<string, string[]>());
  const queue = useRef<string[]>([]);
  const queueIndex = useRef(0);
  const autoRef = useRef(false);
  const interacted = useRef(false);
  const seen = useRef<string | null>(null);
  const firstScene = useRef<string | undefined>(undefined);
  const cloudRef = useRef(cloudAvailable);
  cloudRef.current = cloudAvailable;

  const stop = useCallback(() => {
    generation.current++;
    controller.current?.abort();
    const audio = audioRef.current;
    if (audio) audio.pause();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    queue.current = [];
    setStatus('idle');
  }, []);
  const clear = useCallback(() => {
    for (const urls of cache.current.values())
      for (const url of urls) URL.revokeObjectURL(url);
    cache.current.clear();
    audioRef.current?.removeAttribute('src');
    setHasAudio(false);
  }, []);
  useEffect(() => {
    setDeviceSupported('speechSynthesis' in window);
    try {
      const value: unknown = JSON.parse(
        localStorage.getItem(SETTINGS_KEY) || '{}',
      );
      if (isRecord(value)) {
        if (
          value.voice === 'device' ||
          VOICES.some((option) => option.id === value.voice)
        )
          setVoice(value.voice as Voice);
        if (value.automatic === true) {
          setAutomatic(true);
          autoRef.current = true;
        }
      }
    } catch {
      /* Voice preferences must not affect the saved game. */
    }
    return () => {
      stop();
      clear();
    };
  }, [stop, clear]);
  useEffect(() => {
    if (cloudAvailable === false && deviceSupported && voice !== 'device')
      setVoice('device');
  }, [cloudAvailable, deviceSupported, voice]);
  const remember = (nextVoice: Voice, nextAuto: boolean) => {
    try {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({ voice: nextVoice, automatic: nextAuto }),
      );
    } catch {
      /* Optional preference. */
    }
  };
  const playCurrent = useCallback(async () => {
    const audio = audioRef.current;
    const run = generation.current;
    if (!audio) return;
    try {
      await audio.play();
      if (run !== generation.current) return;
      setStatus('playing');
      setHint(null);
    } catch {
      if (run !== generation.current) return;
      setStatus('ready');
      setHint('Pulsa reproducir en el audio para comenzar.');
    }
  }, []);
  const listen = useCallback(
    async (message: GameMessage) => {
      if (message.role !== 'assistant') return;
      stop();
      interacted.current = true;
      setHint(null);
      const run = generation.current;
      if (voice === 'device') {
        if (!('speechSynthesis' in window)) {
          setHint('Este navegador no ofrece una voz del dispositivo.');
          return;
        }
        const utterance = new SpeechSynthesisUtterance(message.content);
        utterance.lang = 'es';
        utterance.rate = 0.92;
        utterance.voice =
          window.speechSynthesis
            .getVoices()
            .find(
              (option) => option.lang.startsWith('es') && option.localService,
            ) ||
          window.speechSynthesis
            .getVoices()
            .find((option) => option.lang.startsWith('es')) ||
          null;
        utterance.onstart = () => {
          if (run === generation.current) setStatus('playing');
        };
        utterance.onend = () => {
          if (run === generation.current) setStatus('idle');
        };
        utterance.onerror = () => {
          if (run === generation.current) {
            setStatus('idle');
            setHint('No se pudo usar la voz del dispositivo. Prueba otra voz.');
          }
        };
        setHasAudio(false);
        window.speechSynthesis.speak(utterance);
        return;
      }
      if (cloudRef.current !== true) {
        setHint(
          'La voz natural no está disponible. Puedes elegir la voz del dispositivo.',
        );
        return;
      }
      const key = `${voice}\n${message.content}`;
      let urls = cache.current.get(key);
      if (!urls) {
        const currentController = new AbortController();
        controller.current = currentController;
        setStatus('loading');
        const created: string[] = [];
        try {
          for (const [chunkIndex, text] of splitSpeechText(
            message.content,
          ).entries()) {
            const response = await fetch(
              sessionId ? `/api/sessions/${sessionId}/speech` : '/api/narrate',
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(
                  sessionId
                    ? { messageId: message.id, chunkIndex, speaker: voice }
                    : { text, speaker: voice },
                ),
                signal: AbortSignal.any([
                  currentController.signal,
                  AbortSignal.timeout(70000),
                ]),
              },
            );
            if (!response.ok) {
              const result: unknown = await response.json();
              throw new Error(
                isRecord(result) && typeof result.error === 'string'
                  ? result.error
                  : 'No se pudo preparar la voz.',
              );
            }
            const blob = await response.blob();
            if (run !== generation.current || currentController.signal.aborted)
              return;
            created.push(URL.createObjectURL(blob));
          }
          urls = created;
          while (cache.current.size >= 4) {
            const oldest = cache.current.entries().next().value;
            if (!oldest) break;
            for (const url of oldest[1]) URL.revokeObjectURL(url);
            cache.current.delete(oldest[0]);
          }
          cache.current.set(key, urls);
        } catch (error) {
          for (const url of created) URL.revokeObjectURL(url);
          if (run === generation.current && !currentController.signal.aborted) {
            setStatus('idle');
            setHint(
              error instanceof Error
                ? error.message
                : 'No se pudo preparar la voz.',
            );
          }
          return;
        } finally {
          if (run !== generation.current)
            for (const url of created) URL.revokeObjectURL(url);
        }
      }
      if (run !== generation.current || !urls.length || !audioRef.current)
        return;
      queue.current = urls;
      queueIndex.current = 0;
      audioRef.current.src = urls[0];
      audioRef.current.playbackRate = 0.96;
      setHasAudio(true);
      await playCurrent();
    },
    [voice, stop, playCurrent, sessionId],
  );

  useEffect(() => {
    const current = messages[0]?.id;
    if (firstScene.current && firstScene.current !== current) {
      stop();
      clear();
      seen.current = null;
    }
    firstScene.current = current;
  }, [messages, stop, clear]);
  useEffect(() => {
    if (!hydrated) return;
    const latest = messages.findLast((message) => message.role === 'assistant');
    if (!latest || latest.id === seen.current) return;
    seen.current = latest.id;
    if (autoRef.current && interacted.current) void listen(latest);
  }, [messages, hydrated, listen]);

  const changeVoice = (value: Voice) => {
    stop();
    audioRef.current?.removeAttribute('src');
    audioRef.current?.load();
    setHasAudio(false);
    setVoice(value);
    remember(value, autoRef.current);
    setHint(null);
  };
  const toggleAutomatic = (enabled: boolean) => {
    autoRef.current = enabled;
    setAutomatic(enabled);
    remember(voice, enabled);
    if (enabled) {
      const latest = messages.findLast(
        (message) => message.role === 'assistant',
      );
      if (latest) {
        seen.current = latest.id;
        void listen(latest);
      } else interacted.current = true;
    } else stop();
  };
  const pauseOrResume = () => {
    if (voice === 'device') {
      if (status === 'paused') {
        window.speechSynthesis.resume();
        setStatus('playing');
      } else {
        window.speechSynthesis.pause();
        setStatus('paused');
      }
    } else if (status === 'paused' || status === 'ready') void playCurrent();
    else {
      audioRef.current?.pause();
      setStatus('paused');
    }
  };
  const ended = () => {
    if (!audioRef.current?.ended || !queue.current.length) return;
    queueIndex.current++;
    const next = queue.current[queueIndex.current];
    if (next && audioRef.current) {
      audioRef.current.src = next;
      void playCurrent();
    } else setStatus('idle');
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
    ended,
    onPlay: () => {
      if (!audioRef.current?.paused && audioRef.current?.getAttribute('src'))
        setStatus('playing');
    },
    onPause: () => {
      if (audioRef.current?.paused && queue.current.length)
        setStatus((previous) => (previous === 'playing' ? 'paused' : previous));
    },
    onAudioError: () => {
      if (!audioRef.current?.getAttribute('src')) return;
      setStatus('idle');
      setHint(
        'El audio no pudo reproducirse. Puedes volver a escuchar la escena.',
      );
    },
  };
}
