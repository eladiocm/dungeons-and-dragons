'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ActionPlan,
  GameCommand,
  PublicSession,
} from '@/game/session-types';
import type { CharacterDraft } from '@/game/types';
import { cached, cacheProjection } from '@/lib/client-cache';
import { decodeSave, type PublicConfig } from '@/lib/game-contract';

type Summary = {
  id: string;
  character: string;
  scene: string;
  status: string;
  updatedAt: number;
};
type Operation = { url: string; body: unknown; clearDraft?: boolean };
type CommandInput<T = GameCommand> = T extends unknown
  ? Omit<T, 'id' | 'actorId'>
  : never;
class RequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
async function api(url: string, body?: unknown) {
  const response = await fetch(url, {
    ...(body === undefined
      ? {}
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
    cache: 'no-store',
    signal: AbortSignal.timeout(135000),
  });
  const value = await response.json();
  if (!response.ok)
    throw new RequestError(
      value.error || 'No se pudo completar la operación.',
      response.status,
    );
  return value;
}
export function useCampaign() {
  const [session, setSession] = useState<PublicSession | null>(null),
    [saves, setSaves] = useState<Summary[]>([]),
    [hydrated, setHydrated] = useState(false),
    [busy, setBusy] = useState(false),
    [online, setOnline] = useState(true),
    [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState<string | null>(null),
    [draft, setDraft] = useState(''),
    [config, setConfig] = useState<PublicConfig | null>(null),
    [legacy, setLegacy] = useState<ReturnType<typeof decodeSave>>(null);
  const stateRef = useRef(session),
    lock = useRef(false),
    retryOp = useRef<Operation | null>(null),
    draftRef = useRef(draft);
  stateRef.current = session;
  draftRef.current = draft;
  const adopt = useCallback((next: PublicSession) => {
    setSession(next);
    stateRef.current = next;
    try {
      localStorage.setItem('dnd-current-v2', next.id);
    } catch {}
    void cacheProjection(next).catch(() => {});
  }, []);
  const refresh = useCallback(async () => {
    const current = stateRef.current;
    if (!current) return;
    try {
      adopt((await api(`/api/sessions/${current.id}`)).session);
      setOnline(true);
    } catch (e) {
      setOnline(false);
      setError(e instanceof Error ? e.message : 'No se pudo actualizar.');
    }
  }, [adopt]);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        setDraft(localStorage.getItem('dnd-draft-v2') || '');
        setLegacy(decodeSave(localStorage.getItem('dnd-adventure-v1') || ''));
      } catch {}
      try {
        const list = await api('/api/sessions');
        if (!active) return;
        setSaves(list.sessions);
        const id = localStorage.getItem('dnd-current-v2');
        if (id && list.sessions.some((s: Summary) => s.id === id)) {
          const result = await api(`/api/sessions/${id}`);
          if (active) adopt(result.session);
        }
      } catch {
        const saved = await cached<PublicSession>('last-session').catch(
          () => undefined,
        );
        if (active) {
          if (saved) adopt(saved);
          setOnline(false);
          setError(
            'Sin conexión con el servidor. Puedes consultar tu partida; las acciones esperan a recuperar la conexión.',
          );
        }
      } finally {
        if (active) setHydrated(true);
      }
      try {
        const value = await api('/api/config');
        if (active) setConfig(value);
      } catch {}
    })();
    const connected = () => void refresh(),
      disconnected = () => setOnline(false);
    window.addEventListener('online', connected);
    window.addEventListener('offline', disconnected);
    return () => {
      active = false;
      window.removeEventListener('online', connected);
      window.removeEventListener('offline', disconnected);
    };
  }, [adopt, refresh]);
  useEffect(() => {
    if (hydrated)
      try {
        localStorage.setItem('dnd-draft-v2', draft);
      } catch {}
  }, [draft, hydrated]);
  const perform = useCallback(
    async (op: Operation, clearDraft = op.clearDraft || false) => {
      if (lock.current) return false;
      lock.current = true;
      setBusy(true);
      setError(null);
      setNotice(null);
      retryOp.current = { ...op, clearDraft };
      try {
        const result = await api(op.url, op.body);
        setOnline(true);
        adopt(result.session);
        retryOp.current = null;
        if (result.clarification) {
          setNotice(result.clarification);
          return false;
        }
        if (
          clearDraft &&
          typeof op.body === 'object' &&
          op.body &&
          'text' in op.body &&
          draftRef.current.trim() === op.body.text
        )
          setDraft('');
        const latest = result.session.messages.findLast(
          (m: { role: string }) => m.role === 'assistant',
        );
        if (latest?.narrationPending && !result.session.pending) {
          try {
            const narrated = await api(
              `/api/sessions/${result.session.id}/narrative`,
              { messageId: latest.id },
            );
            adopt(narrated.session);
            if (narrated.warning) setNotice(narrated.warning);
          } catch {
            setNotice(
              'Los resultados están guardados. La narración ampliada está pendiente.',
            );
          }
        }
        return true;
      } catch (e) {
        if (e instanceof RequestError && e.status === 409) {
          retryOp.current = null;
          await refresh();
        }
        setError(
          e instanceof Error
            ? e.message
            : 'No se pudo conectar. Tu borrador se conserva.',
        );
        return false;
      } finally {
        lock.current = false;
        setBusy(false);
      }
    },
    [adopt, refresh],
  );
  const create = (character: CharacterDraft) =>
    perform({
      url: '/api/sessions',
      body: { id: crypto.randomUUID(), character },
    });
  const command = (payload: CommandInput) => {
    const s = stateRef.current;
    if (!s) return Promise.resolve(false);
    return perform({
      url: `/api/sessions/${s.id}/commands`,
      body: {
        expectedVersion: s.version,
        command: {
          ...payload,
          id: crypto.randomUUID(),
          actorId: s.participants[0].characterId,
        },
      },
    });
  };
  const plan = (plan: ActionPlan, text: string) =>
    command({ type: 'propose', plan, text });
  const send = () => {
    const s = stateRef.current,
      text = draftRef.current.trim();
    if (!s || !text || !online) return;
    void perform(
      {
        url: `/api/sessions/${s.id}/intent`,
        body: {
          expectedVersion: s.version,
          id: crypto.randomUUID(),
          actorId: s.participants[0].characterId,
          text,
        },
      },
      true,
    );
  };
  const resume = async (id: string) => {
    try {
      adopt((await api(`/api/sessions/${id}`)).session);
      setError(null);
      setOnline(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo continuar.');
    }
  };
  const newGame = () => {
    setSession(null);
    stateRef.current = null;
    setNotice(null);
    setError(null);
    try {
      localStorage.removeItem('dnd-current-v2');
    } catch {}
    void api('/api/sessions')
      .then((result) => setSaves(result.sessions))
      .catch(() => {});
  };
  return {
    session,
    saves,
    hydrated,
    busy,
    online,
    error,
    notice,
    draft,
    setDraft,
    config,
    legacy,
    create,
    command,
    plan,
    send,
    resume,
    newGame,
    refresh,
    retry: () => {
      if (retryOp.current) void perform(retryOp.current);
    },
    canRetry: Boolean(retryOp.current),
    importSave: (save: unknown) =>
      perform({
        url: '/api/sessions/import',
        body: { id: crypto.randomUUID(), save },
      }),
  };
}
export type Campaign = ReturnType<typeof useCampaign>;
