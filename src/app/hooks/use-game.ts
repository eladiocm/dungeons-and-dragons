'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  conversationForRequest,
  createSceneMessage,
  decodeSave,
  encodeSave,
  type GameMessage,
  type GeneratedImage,
  isRecord,
  type PublicConfig,
  SAVE_KEY,
  type StoryRequest,
  type StoryResponse,
} from '@/lib/game-contract';

async function request<T>(
  path: string,
  body: unknown,
  signal: AbortSignal,
): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.any([signal, AbortSignal.timeout(140000)]),
  });
  const value: unknown = await response.json();
  if (!response.ok)
    throw new Error(
      isRecord(value) && typeof value.error === 'string'
        ? value.error
        : 'No se pudo completar la generación.',
    );
  return value as T;
}
interface Pending {
  input: StoryRequest;
}
export function useGame() {
  const [messages, setMessages] = useState<GameMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [imagesEnabled, setImagesEnabled] = useState(true);
  const [online, setOnline] = useState(true);
  const messageRef = useRef<GameMessage[]>([]);
  const busyRef = useRef(false);
  const epoch = useRef(0);
  const pending = useRef<Pending | null>(null);
  const started = useRef(false);
  const storyController = useRef<AbortController | null>(null);
  const imageControllers = useRef(new Map<string, AbortController>());
  const imageSetting = useRef(true);
  const mounted = useRef(false);
  const imagesAvailable = config?.imagesEnabled === true;

  const update = useCallback(
    (transform: (prev: GameMessage[]) => GameMessage[]) => {
      messageRef.current = transform(messageRef.current);
      setMessages(messageRef.current);
    },
    [],
  );
  const abortAll = useCallback(() => {
    storyController.current?.abort();
    for (const controller of imageControllers.current.values())
      controller.abort();
    imageControllers.current.clear();
  }, []);

  useEffect(() => {
    mounted.current = true;
    setOnline(navigator.onLine);
    const controller = new AbortController();
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      const saved = raw ? decodeSave(raw) : null;
      if (saved) {
        update(() => saved.messages);
        setImagesEnabled(saved.imagesEnabled);
        imageSetting.current = saved.imagesEnabled;
        if (saved.messages.at(-1)?.role === 'user') {
          const last = saved.messages.at(-1);
          pending.current = {
            input: {
              isStart: false,
              userMessage: last?.content || '',
              conversationHistory: conversationForRequest(
                saved.messages.slice(0, -1),
              ),
              currentScene: saved.messages.findLast(
                (message) =>
                  message.role === 'assistant' && message.imagePrompt,
              )?.imagePrompt,
            },
          };
          setError('La última escena quedó pendiente. Puedes reintentarla.');
        }
      } else if (raw)
        setStorageWarning(
          'No se pudo recuperar la partida guardada. Puedes comenzar una nueva.',
        );
    } catch {
      setStorageWarning(
        'El navegador no permite guardar la partida. Puedes seguir jugando en esta pestaña.',
      );
    }
    setHydrated(true);
    fetch('/api/config', { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const value: PublicConfig = await response.json();
        if (!controller.signal.aborted) setConfig(value);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setConfig({
            provider: 'Sin conexión',
            configured: false,
            imagesEnabled: false,
            message: navigator.onLine
              ? 'No se pudo comprobar la configuración. Recarga la página para reintentar.'
              : 'Estás sin conexión. Puedes leer tu partida guardada; vuelve a conectarte para continuar.',
          });
      });
    return () => {
      mounted.current = false;
      controller.abort();
      abortAll();
    };
  }, [abortAll, update]);

  useEffect(() => {
    const controller = new AbortController();
    const onOnline = () => {
      setOnline(true);
      fetch('/api/config', { signal: controller.signal, cache: 'no-store' })
        .then((response) => response.json())
        .then((value: PublicConfig) => {
          if (!controller.signal.aborted) setConfig(value);
        })
        .catch(() => {});
    };
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      controller.abort();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(SAVE_KEY, encodeSave(messages, imagesEnabled));
    } catch {
      setStorageWarning(
        'No se pudo guardar la partida en este navegador. La conversación sigue disponible en esta pestaña.',
      );
    }
  }, [messages, imagesEnabled, hydrated]);

  const generateImage = useCallback(
    async (messageId: string, prompt: string) => {
      if (
        !imagesAvailable ||
        !imageSetting.current ||
        imageControllers.current.has(messageId)
      )
        return;
      const currentEpoch = epoch.current;
      const controller = new AbortController();
      imageControllers.current.set(messageId, controller);
      update((previous) =>
        previous.map((message) =>
          message.id === messageId
            ? { ...message, imageLoading: true, imageError: undefined }
            : message,
        ),
      );
      try {
        const value = await request<{ image: GeneratedImage }>(
          '/api/generate-image',
          { imagePrompt: prompt },
          controller.signal,
        );
        if (
          mounted.current &&
          !controller.signal.aborted &&
          currentEpoch === epoch.current
        )
          update((previous) =>
            previous.map((message) =>
              message.id === messageId
                ? { ...message, image: value.image, imageLoading: false }
                : message,
            ),
          );
      } catch (failure) {
        if (
          mounted.current &&
          !controller.signal.aborted &&
          currentEpoch === epoch.current
        )
          update((previous) =>
            previous.map((message) =>
              message.id === messageId
                ? {
                    ...message,
                    imageLoading: false,
                    imageError:
                      failure instanceof Error
                        ? failure.message
                        : 'No se pudo generar la imagen.',
                  }
                : message,
            ),
          );
      } finally {
        if (imageControllers.current.get(messageId) === controller)
          imageControllers.current.delete(messageId);
      }
    },
    [imagesAvailable, update],
  );

  const generateStory = useCallback(
    async (story: StoryRequest) => {
      if (busyRef.current || !config?.configured) return;
      busyRef.current = true;
      setLoading(true);
      setError(null);
      pending.current = { input: story };
      const currentEpoch = epoch.current;
      const controller = new AbortController();
      storyController.current = controller;
      try {
        const value = await request<StoryResponse>(
          '/api/generate-story',
          story,
          controller.signal,
        );
        if (
          !mounted.current ||
          controller.signal.aborted ||
          currentEpoch !== epoch.current
        )
          return;
        const message = createSceneMessage(
          crypto.randomUUID(),
          value,
          messageRef.current,
        );
        update((previous) => [...previous, message]);
        pending.current = null;
        if (message.illustration === 'new')
          void generateImage(
            message.id,
            message.imagePrompt || value.imagePrompt,
          );
      } catch (failure) {
        if (
          mounted.current &&
          !controller.signal.aborted &&
          currentEpoch === epoch.current
        )
          setError(
            failure instanceof Error
              ? failure.message
              : 'No se pudo generar la escena.',
          );
      } finally {
        if (mounted.current && currentEpoch === epoch.current) {
          busyRef.current = false;
          setLoading(false);
        }
      }
    },
    [config?.configured, generateImage, update],
  );

  useEffect(() => {
    if (
      !hydrated ||
      !config?.configured ||
      messageRef.current.length ||
      started.current
    )
      return;
    const timer = setTimeout(() => {
      started.current = true;
      void generateStory({
        isStart: true,
        userMessage: '',
        conversationHistory: [],
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [hydrated, config?.configured, generateStory]);

  const submit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const action = input.trim();
      if (
        !action ||
        action.length > 2000 ||
        busyRef.current ||
        pending.current ||
        !config?.configured ||
        !online
      )
        return;
      const history = conversationForRequest(messageRef.current);
      update((previous) => [
        ...previous,
        { id: crypto.randomUUID(), role: 'user', content: action },
      ]);
      setInput('');
      void generateStory({
        isStart: false,
        userMessage: action,
        conversationHistory: history,
        currentScene: messageRef.current.findLast(
          (message) => message.role === 'assistant' && message.imagePrompt,
        )?.imagePrompt,
      });
    },
    [input, config?.configured, generateStory, update, online],
  );

  const newGame = useCallback(() => {
    epoch.current++;
    abortAll();
    busyRef.current = false;
    pending.current = null;
    started.current = true;
    setError(null);
    setInput('');
    update(() => []);
    void generateStory({
      isStart: true,
      userMessage: '',
      conversationHistory: [],
    });
  }, [abortAll, generateStory, update]);
  const retry = () => {
    if (pending.current) void generateStory(pending.current.input);
  };
  const editAction = () => {
    if (!pending.current || pending.current.input.isStart) return;
    setInput(pending.current.input.userMessage);
    update((previous) =>
      previous.at(-1)?.role === 'user' ? previous.slice(0, -1) : previous,
    );
    pending.current = null;
    setError(null);
  };
  const toggleImages = (enabled: boolean) => {
    imageSetting.current = enabled;
    setImagesEnabled(enabled);
    if (!enabled) {
      for (const controller of imageControllers.current.values())
        controller.abort();
      imageControllers.current.clear();
      update((previous) =>
        previous.map((message) => ({ ...message, imageLoading: false })),
      );
    }
  };
  return {
    messages,
    input,
    setInput,
    isLoading,
    error,
    storageWarning,
    config,
    hydrated,
    imagesEnabled,
    imagesAvailable,
    submit,
    newGame,
    retry,
    editAction,
    toggleImages,
    generateImage,
    canEdit: Boolean(pending.current && !pending.current.input.isStart),
    online,
  };
}
