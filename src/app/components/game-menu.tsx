'use client';
import { useEffect, useRef, useState } from 'react';
import { VOICES } from '@/lib/speech-contract';
import { PwaControls } from '../componentes/pwa-controls';
import type { Campaign } from '../hooks/use-campaign';
import type { useNarration } from '../hooks/use-narration';
import { Icon } from './icons';
export type Narrator = ReturnType<typeof useNarration>;
export function GameMenu({
  game,
  narration,
  images,
  setImages,
  onNew,
}: {
  game: Campaign;
  narration: Narrator;
  images: boolean;
  setImages: (value: boolean) => void;
  onNew: () => void;
}) {
  const menu = useRef<HTMLDetailsElement>(null),
    file = useRef<HTMLInputElement>(null),
    [confirm, setConfirm] = useState(false),
    [hint, setHint] = useState('');
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node) && menu.current)
        menu.current.open = false;
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && menu.current) {
        menu.current.open = false;
        menu.current.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', onEscape);
    };
  }, []);
  const download = async () => {
    if (!game.session) return;
    setHint('');
    try {
      const res = await fetch(`/api/sessions/${game.session.id}/export`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const blob = await res.blob(),
        url = URL.createObjectURL(blob),
        a = document.createElement('a');
      a.href = url;
      a.download = `valdumbria-${game.session.id.slice(0, 8)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setHint(
        'Copia descargada. Para restaurarla conserva también la clave del servidor.',
      );
    } catch (e) {
      setHint(
        e instanceof Error ? e.message : 'No se pudo descargar la copia.',
      );
    }
  };
  return (
    <details className="game-menu" ref={menu}>
      <summary aria-label="Menú de partida" title="Menú de partida">
        <Icon name="more" />
      </summary>
      <div className="menu-dropdown">
        <h2>Tu aventura</h2>
        {confirm ? (
          <div className="new-game-confirm">
            <p>
              La partida actual seguirá guardada. ¿Quieres crear otro personaje?
            </p>
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                setConfirm(false);
                if (menu.current) menu.current.open = false;
                narration.stop();
                onNew();
              }}
            >
              Crear otra partida
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => setConfirm(false)}
            >
              Seguir aquí
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="menu-item"
            disabled={game.busy}
            onClick={() => (game.session ? setConfirm(true) : onNew())}
          >
            <Icon name="book" />
            Nueva partida
          </button>
        )}
        {game.saves.length > 0 && (
          <details>
            <summary>Continuar una partida</summary>
            <div className="saved-list">
              {game.saves.slice(0, 10).map((s) => (
                <button
                  type="button"
                  key={s.id}
                  disabled={game.busy}
                  onClick={() => {
                    narration.stop();
                    narration.arm();
                    void game.resume(s.id);
                    if (menu.current) menu.current.open = false;
                  }}
                >
                  {s.character}
                  <small>
                    {s.status === 'ended' ? 'Finalizada' : 'En curso'}
                  </small>
                </button>
              ))}
            </div>
          </details>
        )}
        <details className="settings-group">
          <summary>Narración</summary>
          <label className="toggle-setting">
            <input
              type="checkbox"
              checked={narration.automatic}
              onChange={(e) => narration.toggleAutomatic(e.target.checked)}
            />
            Narrar automáticamente
          </label>
          <label>
            Voz
            <select
              value={narration.voice}
              onChange={(e) =>
                narration.changeVoice(e.target.value as typeof narration.voice)
              }
            >
              {VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
              <option value="device">Voz del dispositivo</option>
            </select>
          </label>
          <label>
            Velocidad
            <select
              aria-label="Velocidad de narración"
              value={narration.rate}
              onChange={(e) => narration.changeRate(Number(e.target.value))}
            >
              {[0.7, 0.85, 0.96, 1.1, 1.3].map((v) => (
                <option value={v} key={v}>
                  {v}×
                </option>
              ))}
            </select>
          </label>
          <label>
            Volumen
            <input
              aria-label="Volumen de narración"
              type="range"
              min="0"
              max="1"
              step=".05"
              value={narration.volume}
              onChange={(e) => narration.changeVolume(Number(e.target.value))}
            />
          </label>
          <label className="toggle-setting">
            <input
              type="checkbox"
              checked={narration.highlight}
              onChange={(e) => narration.setHighlight(e.target.checked)}
            />
            Resaltar el texto narrado
          </label>
          <p>
            El seguimiento con voz natural es aproximado. La voz del dispositivo
            usa sus marcas de palabra cuando están disponibles.
          </p>
          <small>
            La voz natural y las ilustraciones comparten la cuota gratuita del
            servicio.
          </small>
        </details>
        <details className="settings-group">
          <summary>Ilustraciones y accesibilidad</summary>
          <label className="toggle-setting">
            <input
              type="checkbox"
              checked={images}
              onChange={(e) => setImages(e.target.checked)}
            />
            Ilustrar cambios de escena
          </label>
          <p>
            Al desactivar se conserva la ilustración disponible. Siempre habrá
            una imagen local del lugar.
          </p>
          <p>
            Las animaciones respetan la preferencia de movimiento reducido del
            dispositivo.
          </p>
        </details>
        {game.session && (
          <button
            type="button"
            className="menu-item"
            onClick={() => void download()}
          >
            <Icon name="download" />
            Descargar copia privada
          </button>
        )}
        <button
          type="button"
          className="menu-item"
          disabled={game.busy}
          onClick={() => file.current?.click()}
        >
          <Icon name="bag" />
          Importar copia
        </button>
        <input
          ref={file}
          className="sr-only"
          type="file"
          accept="application/json,.json"
          aria-label="Archivo de partida"
          onChange={async (e) => {
            const chosen = e.target.files?.[0];
            if (!chosen) return;
            try {
              if (chosen.size > 11001000)
                throw new Error('La copia supera el tamaño permitido.');
              await game.importSave(JSON.parse(await chosen.text()));
            } catch (error) {
              setHint(
                error instanceof Error
                  ? error.message
                  : 'No se pudo abrir esa copia.',
              );
            }
            e.target.value = '';
          }}
        />
        <PwaControls />
        {hint && (
          <p role="status" className="menu-hint">
            {hint}
          </p>
        )}
        <a
          className="rules-link"
          href="https://www.dndbeyond.com/srd"
          target="_blank"
          rel="noreferrer"
        >
          Reglas SRD 5.2.1
        </a>
      </div>
    </details>
  );
}
