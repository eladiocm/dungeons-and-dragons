'use client';
import { useEffect, useRef, useState } from 'react';
import type { PublicSession } from '@/game/session-types';
import { cached, cacheValue } from '@/lib/client-cache';
import { Icon } from './icons';

type Picture = { src: string; title: string; revision: number };
export function ScenePanel({
  session,
  enabled,
  online,
}: {
  session: PublicSession;
  enabled: boolean;
  online: boolean;
}) {
  const [picture, setPicture] = useState<Picture | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
  const attempted = useRef(new Set<string>());
  const id = session.id,
    revision = session.world.sceneRevision,
    title = session.scene.title;
  // biome-ignore lint/correctness/useExhaustiveDependencies: Explicit retry restarts this request after clearing the attempted key.
  useEffect(() => {
    let live = true;
    const controller = new AbortController(),
      key = `${id}:${revision}`;
    void (async () => {
      const previous = await cached<Picture>(`image:${id}`).catch(
        () => undefined,
      );
      if (!live) return;
      if (previous) setPicture(previous);
      else setPicture((current) => current || null);
      if (
        previous?.revision === revision ||
        !enabled ||
        !online ||
        attempted.current.has(key)
      )
        return;
      attempted.current.add(key);
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/sessions/${id}/image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sceneRevision: revision }),
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || 'No se pudo ilustrar esta escena.');
        const image = data.image,
          img = new Image();
        const src = `data:${image.mediaType};base64,${image.base64Data}`;
        img.src = src;
        await img.decode();
        if (!live) return;
        const next = { src, title, revision };
        setPicture(next);
        void cacheValue(`image:${id}`, next).catch(() => {});
      } catch (e) {
        if (live)
          setError(
            e instanceof Error
              ? e.message
              : 'La ilustración no está disponible.',
          );
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
      controller.abort();
    };
  }, [id, revision, title, enabled, online, retry]);
  const active = session.world.objectives.find((o) => !o.complete);
  return (
    <section className="scene-panel" aria-label="Escena actual">
      <div className="scene-image-wrap">
        {/* biome-ignore lint/performance/noImgElement: Data URLs and offline local scene art do not need an image optimizer. */}
        <img
          className="scene-image"
          src={picture?.src || session.scene.fallback}
          alt={`Ilustración de ${picture?.title || title}`}
          width="1280"
          height="800"
          onError={() => setPicture(null)}
        />
        <div className="scene-vignette" />
        <div className="scene-caption">
          <span className="chapter-label">La última luz de Valdumbría</span>
          <h2>{title}</h2>
          <p>{session.scene.description}</p>
        </div>
        {loading && (
          <span className="scene-status" role="status">
            Preparando ilustración…
          </span>
        )}
        {error && (
          <div className="image-error">
            <button
              type="button"
              className="icon-button"
              title="Reintentar ilustración"
              aria-label="Reintentar ilustración"
              onClick={() => {
                attempted.current.delete(`${id}:${revision}`);
                setRetry((r) => r + 1);
              }}
            >
              <Icon name="repeat" />
            </button>
            <span>{error}</span>
          </div>
        )}
      </div>
      <div className="quest-line">
        <Icon name="spark" />
        <div>
          <span>{session.ending ? 'Misión concluida' : 'Tu objetivo'}</span>
          <strong>
            {session.ending?.title || active?.title || 'Volver a Valdumbría'}
          </strong>
        </div>
        <small>
          {Math.max(
            0,
            Math.ceil((session.world.deadline - session.world.time) / 600),
          )}{' '}
          h hasta la niebla
        </small>
      </div>
    </section>
  );
}
