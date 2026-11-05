import { type Speaker, VOICES } from '@/lib/speech-contract';
import type { useNarration } from '../hooks/use-narration';
export function VoiceControls({
  narration,
  cloudAvailable,
}: {
  narration: ReturnType<typeof useNarration>;
  cloudAvailable: boolean;
}) {
  return (
    <section className="voice-controls" aria-label="Narración de voz">
      <div className="voice-options">
        <label htmlFor="narrator-voice">Voz del narrador</label>
        <select
          id="narrator-voice"
          value={narration.voice}
          onChange={(event) =>
            narration.changeVoice(event.target.value as Speaker | 'device')
          }
        >
          {VOICES.map((voice) => (
            <option key={voice.id} value={voice.id} disabled={!cloudAvailable}>
              {voice.label}
            </option>
          ))}
          <option value="device" disabled={!narration.deviceSupported}>
            Voz del dispositivo
          </option>
        </select>
        <label className="image-toggle">
          <input
            type="checkbox"
            checked={narration.automatic}
            onChange={(event) =>
              narration.toggleAutomatic(event.target.checked)
            }
          />
          Leer nuevas escenas
        </label>
      </div>
      <div className="voice-player">
        {narration.status === 'loading' && (
          <span role="status">Preparando la voz…</span>
        )}
        {(narration.status === 'playing' || narration.status === 'paused') && (
          <button
            type="button"
            className="text-button"
            onClick={narration.pauseOrResume}
          >
            {narration.status === 'playing'
              ? 'Pausar narración'
              : 'Continuar narración'}
          </button>
        )}
        {narration.status !== 'idle' && (
          <button
            type="button"
            className="text-button"
            onClick={() => narration.stop()}
          >
            Detener narración
          </button>
        )}
        <audio
          ref={narration.audioRef}
          controls
          hidden={!narration.hasAudio}
          aria-label="Audio de la escena"
          onEnded={narration.ended}
          onPlay={narration.onPlay}
          onPause={narration.onPause}
          onError={narration.onAudioError}
        >
          <track kind="captions" />
        </audio>
        {narration.hint && (
          <p role="status" className="voice-hint">
            {narration.hint}
          </p>
        )}
      </div>
    </section>
  );
}
