import type { GameMessage as Message } from '@/lib/game-contract';

export function GameMessage({
  message,
  imagesEnabled,
  onRetryImage,
  onListen,
}: {
  message: Message;
  imagesEnabled: boolean;
  onRetryImage: (id: string, prompt: string) => void;
  onListen?: (message: Message) => void;
}) {
  return (
    <article
      className={`game-message ${message.role === 'user' ? 'player-message' : ''}`}
      aria-label={message.role === 'user' ? 'Tu acción' : 'Escena del narrador'}
    >
      <p className="speaker">
        {message.role === 'user' ? 'TÚ' : 'EL NARRADOR'}
      </p>
      {message.role === 'assistant' && message.image && (
        // biome-ignore lint/performance/noImgElement: Generated inline data URI requires no Next image optimization.
        <img
          src={`data:${message.image.mediaType};base64,${message.image.base64Data}`}
          alt={message.imagePrompt || 'Escena de fantasía en pixel art'}
          className="scene-image"
        />
      )}
      <p className="narrative">{message.content}</p>
      {message.role === 'assistant' && onListen && (
        <button
          type="button"
          className="text-button listen-button"
          onClick={() => onListen(message)}
        >
          Escuchar escena
        </button>
      )}
      {message.role === 'assistant' &&
        message.illustration !== 'reuse' &&
        imagesEnabled &&
        !message.image && (
          <div className="image-status">
            {message.imageLoading ? (
              <p role="status">
                <span className="loading-dot" /> Dibujando la escena…
              </p>
            ) : (
              <>
                {message.imageError && <p>{message.imageError}</p>}
                {message.imagePrompt && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      onRetryImage(message.id, message.imagePrompt || '')
                    }
                  >
                    {message.imageError
                      ? 'Reintentar imagen'
                      : 'Ilustrar esta escena'}
                  </button>
                )}
              </>
            )}
          </div>
        )}
    </article>
  );
}
