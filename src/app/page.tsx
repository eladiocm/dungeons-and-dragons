'use client';
import { useEffect, useState } from 'react';
import type { CampaignMessage } from '@/game/session-types';
import { CharacterCreator } from './components/character-creator';
import { GameMenu } from './components/game-menu';
import { GameTable } from './components/game-table';
import { Icon } from './components/icons';
import { useCampaign } from './hooks/use-campaign';
import { useNarration } from './hooks/use-narration';

const EMPTY: CampaignMessage[] = [];
export default function Home() {
  const game = useCampaign(),
    [creating, setCreating] = useState(false),
    [images, setImagesState] = useState(true),
    [showLegacy, setShowLegacy] = useState(false);
  const narration = useNarration(
    game.session?.messages || EMPTY,
    game.hydrated,
    game.config?.voiceEnabled,
    game.session?.id,
  );
  useEffect(() => {
    try {
      setImagesState(localStorage.getItem('dnd-images-v2') !== 'false');
    } catch {}
  }, []);
  const setImages = (enabled: boolean) => {
    setImagesState(enabled);
    try {
      localStorage.setItem('dnd-images-v2', String(enabled));
    } catch {}
  };
  const newGame = () => {
    narration.stop();
    game.newGame();
    setCreating(true);
  };
  return (
    <main
      className={`app ${game.session ? 'in-game' : ''}`}
      aria-busy={game.busy}
    >
      <a className="skip-link" href="#main-content">
        Saltar al contenido
      </a>
      <header className="app-header">
        <div className="brand">
          <Icon name="dice" width="32" height="32" />
          <div>
            <span>Calabozos y Dragones</span>
            {game.session && <small>La última luz de Valdumbría</small>}
          </div>
        </div>
        <div className="header-state">
          {game.session && (
            <span className={game.online ? 'save-state' : 'offline-state'}>
              {game.online ? 'Partida guardada' : 'Sin conexión'}
            </span>
          )}
          <GameMenu
            game={game}
            narration={narration}
            images={images}
            setImages={setImages}
            onNew={newGame}
          />
        </div>
      </header>
      <div id="main-content" className="main-content">
        {!game.hydrated ? (
          <div className="loading-screen" role="status">
            <Icon name="dice" width="48" height="48" />
            <p>Abriendo el libro de aventuras…</p>
          </div>
        ) : game.session ? (
          <GameTable
            key={game.session.id}
            game={game}
            narration={narration}
            images={images}
          />
        ) : creating ? (
          <CharacterCreator
            busy={game.busy}
            onCancel={() => setCreating(false)}
            onStart={async (draft) => {
              const ok = await game.create(draft);
              if (ok) setCreating(false);
              return ok;
            }}
          />
        ) : (
          <>
            <section className="adventure-intro">
              <div
                className="intro-art"
                role="img"
                aria-label="Un faro apagado domina el valle cubierto de niebla"
              />
              <div className="intro-copy">
                <Icon name="spark" width="36" height="36" />
                <p className="intro-subtitle">
                  Una aventura de fantasía para una persona
                </p>
                <h1>
                  La última luz
                  <br />
                  de Valdumbría
                </h1>
                <p>
                  El faro se ha apagado. Una niebla que nadie recuerda empieza a
                  bajar al valle. Antes de la noche, alguien tendrá que
                  devolverle la luz.
                </p>
                <p className="intro-invitation">
                  Tú eliges el camino. El Master da vida al mundo.
                </p>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => setCreating(true)}
                  disabled={!game.online}
                >
                  Crear personaje
                  <Icon name="chevron" />
                </button>
                <div className="intro-rules">
                  <span>Nivel 1</span>
                  <span>Reglas SRD 5.2.1</span>
                  <span>Acciones libres</span>
                </div>
              </div>
            </section>
            <section className="journey-options">
              <div>
                <h2>Una historia con propósito</h2>
                <p>
                  Explora, habla, usa tus habilidades o enfréntate al peligro.
                  Los dados resuelven la incertidumbre; tus decisiones cambian
                  la misión y su desenlace.
                </p>
              </div>
              <div className="future-mode">
                <Icon name="book" />
                <div>
                  <h2>Mundo abierto</h2>
                  <p>
                    Una segunda modalidad para construir tu propio camino.
                    Próximamente.
                  </p>
                </div>
              </div>
            </section>
            {game.saves.length > 0 && (
              <section className="continue-section">
                <h2>Continúa tu historia</h2>
                <div>
                  {game.saves.slice(0, 5).map((s) => (
                    <button
                      type="button"
                      className="saved-adventure"
                      key={s.id}
                      onClick={() => void game.resume(s.id)}
                    >
                      <Icon name="book" />
                      <span>
                        <strong>{s.character}</strong>
                        <small>
                          {s.status === 'ended'
                            ? 'Aventura finalizada'
                            : 'La última luz de Valdumbría'}
                        </small>
                      </span>
                      <Icon name="chevron" />
                    </button>
                  ))}
                </div>
              </section>
            )}
            {game.legacy && (
              <section className="legacy-section">
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setShowLegacy((v) => !v)}
                >
                  {showLegacy ? 'Cerrar archivo' : 'Leer tu aventura anterior'}
                </button>
                {showLegacy && (
                  <div className="legacy-story">
                    <p className="subtle">
                      Archivo de lectura. Su historia se conserva sin asignarle
                      una ficha o tiradas retroactivamente.
                    </p>
                    {game.legacy.messages.map((m) => (
                      <p key={m.id}>{m.content}</p>
                    ))}
                  </div>
                )}
              </section>
            )}
            <footer className="intro-footer">
              Aventura original basada en el SRD 5.2.1, bajo CC BY 4.0.{' '}
              <a href="/attribution.txt">Atribución y alcance</a>
            </footer>
          </>
        )}
        {game.error && !game.session && (
          <div className="error-banner app-error" role="alert">
            <p>{game.error}</p>
            {game.canRetry && (
              <button
                type="button"
                className="text-button"
                disabled={game.busy}
                onClick={game.retry}
              >
                Reintentar
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
