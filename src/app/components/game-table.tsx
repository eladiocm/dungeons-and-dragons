'use client';
import { useEffect, useRef, useState } from 'react';
import type { CharacterState } from '@/game/types';
import type { Campaign } from '../hooks/use-campaign';
import { useDictation } from '../hooks/use-dictation';
import { CharacterSheet } from './character-sheet';
import { DiceTray } from './dice-tray';
import type { Narrator } from './game-menu';
import { Icon } from './icons';
import { NarratedText } from './narrated-text';
import { ScenePanel } from './scene-panel';
export function GameTable({
  game,
  narration,
  images,
}: {
  game: Campaign;
  narration: Narrator;
  images: boolean;
}) {
  const session = game.session;
  if (!session) throw new Error('La mesa necesita una partida.');
  const hero = session.battle.actors[
    session.participants[0].characterId
  ] as CharacterState;
  const [tab, setTab] = useState('diario'),
    [unread, setUnread] = useState(false),
    scroll = useRef<HTMLDivElement>(null),
    follow = useRef(true),
    composer = useRef<HTMLTextAreaElement>(null);
  const dictation = useDictation(
    session.id,
    game.draft,
    game.setDraft,
    narration.stop,
  );
  const dictating = dictation.phase !== 'idle';
  const latest = session.messages.findLast((m) => m.role === 'assistant');
  // biome-ignore lint/correctness/useExhaustiveDependencies: Message content and pending phase change the scroll height.
  useEffect(() => {
    if (follow.current && scroll.current) {
      const last = scroll.current.querySelector<HTMLElement>(
        'article:last-of-type',
      );
      scroll.current.scrollTop =
        session.messages.length === 1
          ? 0
          : Math.max(0, (last?.offsetTop || 0) - scroll.current.offsetTop - 12);
    } else setUnread(true);
  }, [session.messages, session.phase, game.notice, game.busy]);
  const pendingId = session.pending?.id;
  useEffect(() => {
    if (pendingId) setTab('dados');
  }, [pendingId]);
  const blocked =
    game.busy ||
    !game.online ||
    Boolean(session.pending) ||
    session.status === 'ended' ||
    dictating;
  return (
    <div className="game-table">
      <ScenePanel
        session={session}
        enabled={images && game.config?.imagesEnabled === true}
        online={game.online}
      />
      <div className="mobile-vitals">
        <span>
          <strong>{hero.name}</strong>
        </span>
        <span>
          PG{' '}
          <strong>
            {hero.hp.current}/{hero.hp.max}
          </strong>
        </span>
        <span>
          CA <strong>{hero.ac}</strong>
        </span>
        {session.battle.inCombat && <span>Asalto {session.battle.round}</span>}
      </div>
      <div
        className="mobile-tabs"
        role="tablist"
        aria-label="Paneles de la partida"
      >
        {[
          ['diario', 'Diario'],
          ['ficha', 'Ficha'],
          ['dados', 'Dados'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`table-tab-${id}`}
            aria-controls={`table-${id}`}
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
            {id === 'dados' && session.pending && (
              <span className="pending-dot" />
            )}
          </button>
        ))}
      </div>
      <section
        className={`chat-panel mobile-panel ${tab === 'diario' ? 'mobile-active' : ''}`}
        id="table-diario"
        aria-label="Diario de aventura"
      >
        <header className="chat-header">
          <div>
            <Icon name="book" />
            <h2>Diario de aventura</h2>
          </div>
          <fieldset
            className="narration-controls"
            aria-label="Controles del narrador"
          >
            <button
              type="button"
              className="icon-button"
              disabled={!latest || narration.status === 'loading'}
              aria-label={
                narration.status === 'playing'
                  ? 'Pausar narración'
                  : 'Reproducir narración'
              }
              title={narration.status === 'playing' ? 'Pausar' : 'Reproducir'}
              onClick={() =>
                narration.status === 'playing' ||
                narration.status === 'paused' ||
                narration.status === 'ready'
                  ? narration.pauseOrResume()
                  : latest && void narration.listen(latest)
              }
            >
              <Icon name={narration.status === 'playing' ? 'pause' : 'play'} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Detener narración"
              title="Detener"
              onClick={narration.stop}
            >
              <Icon name="stop" />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Repetir narración"
              title="Repetir"
              disabled={!latest}
              onClick={() => latest && void narration.listen(latest)}
            >
              <Icon name="repeat" />
            </button>
          </fieldset>
        </header>
        <div
          className="conversation"
          ref={scroll}
          onScroll={(e) => {
            const el = e.currentTarget;
            follow.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < 70;
            if (follow.current) setUnread(false);
          }}
        >
          {session.messages.map((message) => (
            <article
              className={`chat-message ${message.role}`}
              key={message.id}
            >
              <div className="message-speaker">
                {message.role === 'assistant' ? (
                  <>
                    <Icon name="spark" />
                    El Master
                  </>
                ) : (
                  hero.name
                )}
              </div>
              <NarratedText
                text={message.content}
                activeWord={
                  narration.highlight &&
                  narration.activeMessageId === message.id
                    ? narration.activeWord
                    : -1
                }
              />
            </article>
          ))}
          {session.events.at(-1)?.facts.length ? (
            <details className="event-record">
              <summary>Hechos y resultados confirmados</summary>
              <ul>
                {[...new Set(session.events.at(-1)?.facts || [])].map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </details>
          ) : null}
          {session.ending && (
            <section className="ending">
              <Icon name="spark" width="32" height="32" />
              <h2>{session.ending.title}</h2>
              <p>{session.ending.epilogue}</p>
              <p className="subtle">
                El diario queda guardado. Puedes crear otra aventura desde el
                menú.
              </p>
            </section>
          )}
          {session.pending && (
            <div className="pending-card">
              <Icon name="dice" />
              <div>
                <strong>{session.pending.label}</strong>
                <p>
                  {session.pending.stage === 'unrolled'
                    ? 'Hay una tirada pendiente.'
                    : 'Los dados están guardados. Revisa y confirma el resultado.'}
                </p>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setTab('dados');
                    document
                      .getElementById('table-dados')
                      ?.scrollIntoView({ block: 'nearest' });
                  }}
                >
                  Ver dados y resolver
                </button>
              </div>
            </div>
          )}
          {game.busy && (
            <p role="status" className="thinking">
              <span />
              El Master prepara la respuesta…
            </p>
          )}
          {game.notice && (
            <p className="notice-banner" role="status">
              {game.notice}
            </p>
          )}
          {game.error && (
            <div className="error-banner" role="alert">
              <p>{game.error}</p>
              {game.canRetry && (
                <button
                  type="button"
                  className="text-button"
                  onClick={game.retry}
                  disabled={game.busy}
                >
                  Reintentar la misma acción
                </button>
              )}
              <button
                type="button"
                className="text-button"
                onClick={() => void game.refresh()}
                disabled={game.busy}
              >
                Actualizar partida
              </button>
            </div>
          )}
          {narration.hint && (
            <p className="subtle" role="status">
              {narration.hint}
            </p>
          )}
        </div>
        {unread && (
          <button
            type="button"
            className="unread-button"
            onClick={() => {
              follow.current = true;
              setUnread(false);
              scroll.current?.scrollTo({ top: scroll.current.scrollHeight });
            }}
          >
            Ir al último mensaje
          </button>
        )}
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            if (!blocked) {
              narration.stop();
              game.send();
            }
          }}
        >
          <label htmlFor="action-draft">Tu acción</label>
          <textarea
            ref={composer}
            id="action-draft"
            rows={2}
            value={game.draft}
            maxLength={2000}
            disabled={session.status === 'ended'}
            readOnly={dictating}
            onChange={(e) => game.setDraft(e.target.value)}
            placeholder={
              session.pending
                ? 'Resuelve primero los dados…'
                : 'Describe lo que quieres hacer…'
            }
            onKeyDown={(e) => {
              if (
                e.key === 'Enter' &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                if (!blocked && game.draft.trim()) {
                  narration.stop();
                  game.send();
                }
              }
            }}
          />
          <div className="composer-bottom">
            <span>
              {session.status === 'ended'
                ? 'Aventura finalizada'
                : !game.online
                  ? 'Sin conexión · Solo lectura'
                  : session.battle.inCombat
                    ? `Asalto ${session.battle.round} · Decide tu acción y finaliza el turno`
                    : 'Acciones libres · Tú decides el siguiente paso'}
            </span>
            <div className="composer-buttons">
              {dictation.phase === 'transcribing' ? (
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Cancelar transcripción"
                  onClick={dictation.cancel}
                >
                  <Icon name="close" />
                </button>
              ) : (
                <button
                  type="button"
                  className={`icon-button microphone ${dictating ? 'listening' : ''}`}
                  aria-label="Mantén pulsado para dictar"
                  aria-pressed={dictating}
                  title="Mantén pulsado para dictar; suelta y revisa"
                  disabled={
                    !dictation.available ||
                    game.busy ||
                    !game.online ||
                    Boolean(session.pending) ||
                    session.status === 'ended'
                  }
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    e.preventDefault();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    dictation.start();
                  }}
                  onPointerUp={dictation.stop}
                  onPointerCancel={dictation.cancel}
                  onLostPointerCapture={() => {
                    if (
                      dictation.phase === 'listening' ||
                      dictation.phase === 'requesting'
                    )
                      dictation.stop();
                  }}
                  onKeyDown={(e) => {
                    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
                      e.preventDefault();
                      dictation.start();
                    }
                  }}
                  onKeyUp={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      dictation.stop();
                    }
                  }}
                  onBlur={dictation.cancel}
                >
                  <Icon name="mic" />
                </button>
              )}
              <button
                type="submit"
                className="send-button"
                aria-label="Enviar acción"
                title="Enviar acción"
                disabled={blocked || !game.draft.trim()}
              >
                <Icon name="send" />
              </button>
            </div>
          </div>
          {dictation.hint && (
            <p className="dictation-hint" role="status">
              {dictation.hint}
            </p>
          )}
          {!dictation.available && (
            <p className="dictation-hint">
              El dictado no está disponible en este navegador. Puedes escribir
              tu acción.
            </p>
          )}
        </form>
        {session.battle.inCombat &&
          !session.pending &&
          session.status === 'active' && (
            <div className="combat-actions">
              <button
                type="button"
                className="text-button"
                disabled={game.busy}
                onClick={() =>
                  void game.plan(
                    { kind: 'maneuver', maneuver: 'dodge' },
                    'Me preparo para esquivar',
                  )
                }
              >
                Esquivar
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={game.busy}
                onClick={() =>
                  void game.plan({ kind: 'endTurn' }, 'Finalizo mi turno')
                }
              >
                Finalizar turno
              </button>
            </div>
          )}
        {hero.hp.current === 0 && !hero.dead && (
          <div className="death-warning">
            <p>
              Estás a 0 PG. Salvaciones de muerte: {hero.deathSaves.successes}{' '}
              éxitos, {hero.deathSaves.failures} fallos.
            </p>
            <button
              type="button"
              disabled={game.busy || Boolean(session.pending)}
              className="secondary-button"
              onClick={() =>
                void game.plan({ kind: 'death' }, 'Intento aferrarme a la vida')
              }
            >
              Salvación de muerte
            </button>
          </div>
        )}
      </section>
      <div
        className={`sheet-panel mobile-panel ${tab === 'ficha' ? 'mobile-active' : ''}`}
        id="table-ficha"
      >
        <CharacterSheet
          hero={hero}
          busy={
            game.busy ||
            Boolean(session.pending) ||
            !game.online ||
            session.status === 'ended'
          }
          onPlan={(plan, text) => {
            narration.stop();
            void game.plan(plan, text);
          }}
          onSuggest={(text) => {
            game.setDraft(text);
            setTab('diario');
            setTimeout(() => composer.current?.focus(), 0);
          }}
        />
      </div>
      <div
        className={`dice-panel mobile-panel ${tab === 'dados' ? 'mobile-active' : ''}`}
        id="table-dados"
      >
        <DiceTray session={session} game={game} />
      </div>
    </div>
  );
}
