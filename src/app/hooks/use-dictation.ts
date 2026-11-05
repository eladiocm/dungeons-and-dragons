'use client';
import { useEffect, useRef, useState } from 'react';
import {
  DictationController,
  type DictationState,
  type RecognitionLike,
  type RecorderLike,
} from '@/lib/dictation';
import { recordingToWav } from '@/lib/recording';

type SpeechWindow = Window & {
  SpeechRecognition?: new () => RecognitionLike;
  webkitSpeechRecognition?: new () => RecognitionLike;
};
export function useDictation(
  sessionId: string,
  draft: string,
  setDraft: (value: string) => void,
  stopNarration: () => void,
) {
  const [state, setState] = useState<DictationState>({
      phase: 'idle',
      hint: '',
    }),
    [available, setAvailable] = useState(false),
    controller = useRef<DictationController | null>(null),
    draftRef = useRef(draft),
    writeRef = useRef(setDraft);
  draftRef.current = draft;
  writeRef.current = setDraft;
  useEffect(() => {
    const win = window as SpeechWindow,
      Recognition = win.SpeechRecognition || win.webkitSpeechRecognition,
      recording = Boolean(
        typeof navigator.mediaDevices?.getUserMedia === 'function' &&
          typeof MediaRecorder !== 'undefined',
      );
    setAvailable(Boolean(Recognition || recording));
    const current = new DictationController(
      {
        ...(Recognition ? { recognition: () => new Recognition() } : {}),
        ...(recording
          ? {
              stream: () =>
                navigator.mediaDevices.getUserMedia({
                  audio: {
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                  },
                }),
              recorder: (stream: MediaStream) => {
                const mime = [
                  'audio/webm;codecs=opus',
                  'audio/mp4',
                  'audio/webm',
                ].find((v) => MediaRecorder.isTypeSupported(v));
                return new MediaRecorder(
                  stream,
                  mime ? { mimeType: mime } : {},
                ) as unknown as RecorderLike;
              },
            }
          : {}),
        encode: recordingToWav,
        transcribe: async (audio, signal) => {
          const response = await fetch(
            `/api/sessions/${sessionId}/transcribe`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audio }),
              signal,
            },
          );
          const result = await response.json();
          if (!response.ok)
            throw new Error(result.error || 'No se pudo transcribir.');
          return result.text;
        },
      },
      (text) => writeRef.current(text),
      setState,
    );
    controller.current = current;
    const stop = () => current.cancel(),
      hidden = () => {
        if (document.hidden) stop();
      };
    window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      current.cancel();
      controller.current = null;
      window.removeEventListener('blur', stop);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [sessionId]);
  return {
    ...state,
    available,
    start: () => {
      stopNarration();
      void controller.current?.start(draftRef.current);
    },
    stop: () => controller.current?.stop(),
    cancel: () => controller.current?.cancel(),
  };
}
