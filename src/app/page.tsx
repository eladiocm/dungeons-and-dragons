'use client';
import { useEffect, useRef, useState } from 'react';
import { GameMessage } from './componentes/game-message';
import { PwaControls } from './componentes/pwa-controls';
import { VoiceControls } from './componentes/voice-controls';
import { useColorExtractor } from './hooks/color-extractor';
import { useGame } from './hooks/use-game';
import { useNarration } from './hooks/use-narration';

export default function Home() {
  const game = useGame();
  const narration = useNarration(
    game.messages,
    game.hydrated,
    game.config?.voiceEnabled,
  );
  const scrollArea = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const [showScroll, setShowScroll] = useState(false);
  const lastImage = [...game.messages]
    .reverse()
    .find((message) => message.image)?.image;
  useColorExtractor(lastImage);
  // biome-ignore lint/correctness/useExhaustiveDependencies: New content changes scrollHeight even though the DOM ref is stable.
  useEffect(() => {
    if (follow.current && scrollArea.current)
      scrollArea.current.scrollTop = scrollArea.current.scrollHeight;
  }, [game.messages, game.isLoading]);
  return (
    <main className="adventure">
      <header className="game-header">
        <div>
          <p className="eyebrow">UNA HISTORIA QUE DECIDES TÚ</p>
          <h1>Calabozos y Dragones</h1>
        </div>
        <button
          className="secondary-button"
          type="button"
          disabled={!game.config?.configured}
          onClick={() => {
            if (
              !game.messages.length ||
              window.confirm(
                '¿Empezar una nueva aventura? La conversación actual se sustituirá.',
              )
            ) {
              narration.stop();
              game.newGame();
            }
          }}
        >
          Nueva aventura
        </button>
      </header>
      <div className="game-toolbar">
        <PwaControls />
        <label className="image-toggle">
          <input
            type="checkbox"
            checked={game.imagesEnabled && game.imagesAvailable}
            disabled={!game.imagesAvailable}
            onChange={(event) => game.toggleImages(event.target.checked)}
          />{' '}
          Ilustraciones según la escena
        </label>
      </div>
      <VoiceControls
        narration={narration}
        cloudAvailable={game.config?.voiceEnabled === true}
      />
      {!game.online && (
        <p className="offline-notice" role="status">
          Sin conexión · Puedes leer tu partida guardada.
        </p>
      )}
      <div
        className="conversation"
        ref={scrollArea}
        onScroll={() => {
          const element = scrollArea.current;
          if (!element) return;
          follow.current =
            element.scrollHeight - element.scrollTop - element.clientHeight <
            120;
          setShowScroll(!follow.current);
        }}
      >
        <div className="conversation-inner">
          {(!game.hydrated || !game.config) && (
            <p role="status" className="empty-state">
              Preparando tu aventura…
            </p>
          )}
          {game.config && !game.config.configured && (
            <div role="alert" className="notice">
              <h2>Prepara al narrador</h2>
              <p>{game.config.message}</p>
            </div>
          )}
          {game.storageWarning && (
            <p className="storage-warning" role="status">
              {game.storageWarning}
            </p>
          )}
          {game.messages.map((message) => (
            <GameMessage
              key={message.id}
              message={message}
              imagesEnabled={game.imagesEnabled && game.imagesAvailable}
              onRetryImage={(id, prompt) => {
                void game.generateImage(id, prompt);
              }}
              onListen={(message) => {
                void narration.listen(message);
              }}
            />
          ))}
          {game.isLoading && (
            <p className="story-loading" role="status">
              <span className="loading-dot" /> El narrador prepara la siguiente
              escena…
            </p>
          )}
          {game.error && (
            <div className="notice" role="alert">
              <p>{game.error}</p>
              <div className="error-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={game.retry}
                  disabled={game.isLoading}
                >
                  Reintentar escena
                </button>
                {game.canEdit && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={game.editAction}
                  >
                    Cambiar acción
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {showScroll && (
        <button
          type="button"
          className="scroll-button"
          onClick={() => {
            if (scrollArea.current)
              scrollArea.current.scrollTop = scrollArea.current.scrollHeight;
          }}
        >
          Ir al último mensaje ↓
        </button>
      )}
      <footer className="game-footer">
        <form
          onSubmit={(event) => {
            narration.stop();
            game.submit(event);
          }}
          className="action-form"
        >
          <label htmlFor="action" className="action-label">
            Tu próxima acción
          </label>
          <div className="action-row">
            <textarea
              id="action"
              value={game.input}
              maxLength={2000}
              rows={2}
              placeholder="¿Qué haces? Explora, pregunta o toma una decisión…"
              disabled={
                game.isLoading ||
                Boolean(game.error) ||
                !game.config?.configured ||
                !game.online
              }
              onChange={(event) => game.setInput(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === 'Enter' &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <button
              className="send-button"
              type="submit"
              aria-label="Enviar acción"
              disabled={
                game.isLoading ||
                Boolean(game.error) ||
                !game.input.trim() ||
                !game.config?.configured ||
                !game.online
              }
            >
              Enviar <span aria-hidden="true">↗</span>
            </button>
          </div>
        </form>
        <p className="footer-note">
          Partida guardada en este navegador · Las ilustraciones no se guardan ·
          La IA puede equivocarse
        </p>
      </footer>
    </main>
  );
}
