export type Role = 'user' | 'assistant';
export interface ConversationMessage {
  role: Role;
  content: string;
}
export interface GeneratedImage {
  base64Data: string;
  mediaType: 'image/jpeg' | 'image/png';
}
export interface GameMessage extends ConversationMessage {
  id: string;
  image?: GeneratedImage;
  imagePrompt?: string;
  imageLoading?: boolean;
  imageError?: string;
  sceneId?: string;
  illustration?: 'new' | 'reuse';
}
export interface StoryRequest {
  isStart: boolean;
  userMessage: string;
  conversationHistory: ConversationMessage[];
  currentScene?: string;
}
export interface StoryResponse {
  narrative: string;
  imagePrompt: string;
  question?: string;
  shouldIllustrate?: boolean;
}
export interface PublicConfig {
  provider: string;
  configured: boolean;
  imagesEnabled: boolean;
  voiceEnabled?: boolean;
  message?: string;
}
export const SAVE_KEY = 'dnd-adventure-v1';

export class GameError extends Error {
  status: number;
  retryAfter?: string;
  constructor(message: string, status = 400, retryAfter?: string) {
    super(message);
    this.name = 'GameError';
    this.status = status;
    this.retryAfter = retryAfter;
  }
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function text(value: unknown, limit: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > limit) {
    throw new GameError(
      `El texto debe contener entre 1 y ${limit} caracteres.`,
    );
  }
  return value.trim();
}
export function conversationForRequest(
  messages: readonly unknown[],
): ConversationMessage[] {
  const clean = messages.map((message): ConversationMessage => {
    if (
      !isRecord(message) ||
      (message.role !== 'user' && message.role !== 'assistant')
    )
      throw new GameError('Historial inválido.');
    return { role: message.role, content: text(message.content, 6500) };
  });
  if (clean.length <= 1) return clean;
  const first = clean[0];
  let budget = 16000 - first.content.length;
  const recent: ConversationMessage[] = [];
  for (let i = clean.length - 1; i > 0 && recent.length < 20; i--) {
    if (clean[i].content.length > budget) break;
    recent.unshift(clean[i]);
    budget -= clean[i].content.length;
  }
  return [first, ...recent];
}
export function validateStoryRequest(value: unknown): StoryRequest {
  if (!isRecord(value) || typeof value.isStart !== 'boolean')
    throw new GameError('Solicitud de aventura inválida.');
  if (value.isStart)
    return { isStart: true, userMessage: '', conversationHistory: [] };
  if (
    !Array.isArray(value.conversationHistory) ||
    value.conversationHistory.length > 200
  )
    throw new GameError('Historial inválido.');
  return {
    isStart: false,
    userMessage: text(value.userMessage, 2000),
    conversationHistory: conversationForRequest(value.conversationHistory),
    ...(value.currentScene === undefined
      ? {}
      : { currentScene: text(value.currentScene, 1200) }),
  };
}
export function validateImagePrompt(value: unknown): string {
  if (!isRecord(value)) throw new GameError('Solicitud de imagen inválida.');
  return text(value.imagePrompt, 1200);
}
export function parseStoryResponse(raw: unknown): StoryResponse {
  try {
    const value: unknown =
      typeof raw === 'string'
        ? JSON.parse(
            raw
              .trim()
              .replace(/^```(?:json)?\s*/i, '')
              .replace(/\s*```$/, ''),
          )
        : raw;
    if (!isRecord(value)) throw new Error();
    return {
      narrative: composeNarrative(
        text(value.narrative, 5500),
        value.question === undefined ? undefined : text(value.question, 400),
      ),
      imagePrompt: text(value.imagePrompt, 1200),
      shouldIllustrate:
        value.shouldIllustrate === undefined
          ? true
          : typeof value.shouldIllustrate === 'boolean'
            ? value.shouldIllustrate
            : (() => {
                throw new Error();
              })(),
    };
  } catch {
    throw new GameError(
      'La IA devolvió una escena incompleta. Puedes reintentar.',
      502,
    );
  }
}
export function encodeSave(
  messages: GameMessage[],
  imagesEnabled: boolean,
): string {
  return JSON.stringify({
    version: 1,
    imagesEnabled,
    messages: (messages.length > 200
      ? [messages[0], ...messages.slice(-199)]
      : messages
    ).map(({ id, role, content, imagePrompt, sceneId, illustration }) => ({
      id,
      role,
      content,
      imagePrompt,
      sceneId,
      illustration,
    })),
  });
}
export function decodeSave(
  raw: string,
): { messages: GameMessage[]; imagesEnabled: boolean } | null {
  try {
    if (raw.length > 1600000) return null;
    const value: unknown = JSON.parse(raw);
    if (
      !isRecord(value) ||
      value.version !== 1 ||
      !Array.isArray(value.messages) ||
      value.messages.length > 200 ||
      typeof value.imagesEnabled !== 'boolean'
    )
      return null;
    const ids = new Set<string>();
    const messages: GameMessage[] = value.messages.map((message: unknown) => {
      if (
        !isRecord(message) ||
        (message.role !== 'user' && message.role !== 'assistant')
      )
        throw new Error();
      const id = text(message.id, 100);
      if (ids.has(id)) throw new Error();
      ids.add(id);
      return {
        id,
        role: message.role,
        content:
          message.role === 'assistant'
            ? composeNarrative(text(message.content, 6500))
            : text(message.content, 6000),
        imagePrompt:
          message.imagePrompt === undefined
            ? undefined
            : text(message.imagePrompt, 1200),
        imageLoading: false,
        sceneId:
          message.sceneId === undefined ? id : text(message.sceneId, 100),
        illustration: message.illustration === 'reuse' ? 'reuse' : 'new',
      };
    });
    return { messages, imagesEnabled: value.imagesEnabled };
  } catch {
    return null;
  }
}

export function composeNarrative(narrative: string, question?: string): string {
  const clean = narrative.trim();
  const contextualQuestion = question?.trim();
  if (contextualQuestion?.endsWith('?')) {
    return clean.endsWith(contextualQuestion)
      ? clean
      : `${clean}\n\n${contextualQuestion}`;
  }
  if (/\?\s*[”"'»]*$/.test(clean)) return clean;
  return `${clean}\n\n¿Qué decides hacer?`;
}

export function createSceneMessage(
  id: string,
  story: StoryResponse,
  history: GameMessage[],
): GameMessage {
  const previous = history.findLast(
    (message) => message.role === 'assistant' && message.imagePrompt,
  );
  const isNew = !previous || story.shouldIllustrate !== false;
  return {
    id,
    role: 'assistant',
    content: composeNarrative(story.narrative, story.question),
    imagePrompt: isNew ? story.imagePrompt : previous.imagePrompt,
    sceneId: isNew ? id : previous.sceneId || previous.id,
    illustration: isNew ? 'new' : 'reuse',
  };
}
