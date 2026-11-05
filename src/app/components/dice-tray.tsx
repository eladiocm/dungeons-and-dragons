'use client';
import { useState } from 'react';
import type { PublicSession } from '@/game/session-types';
import type { Campaign } from '../hooks/use-campaign';
import { Icon } from './icons';
export function DiceTray({
  session,
  game,
}: {
  session: PublicSession;
  game: Campaign;
}) {
  const p = session.pending,
    [die, setDie] = useState(0),
    actorId = session.participants[0].characterId;
  const eligible =
      p?.dice
        .map((d, index) => ({ ...d, index }))
        .filter((d) => d.actorId === actorId) || [],
    selected = eligible.find((d) => d.index === die) || eligible[0];
  const rolls = p?.rolls.length
    ? p.rolls
    : session.events.findLast((e) => e.rolls.length)?.rolls || [];
  return (
    <section
      className={`dice-tray ${p ? 'has-pending' : ''}`}
      aria-label="Dados y resolución"
    >
      <header>
        <Icon name="dice" />
        <div>
          <h2>{p ? p.label : 'La suerte está en tus manos'}</h2>
          <p>
            {p?.stage === 'unrolled'
              ? 'Esta acción necesita dados. Puedes cancelarla antes de tirar.'
              : p
                ? 'Los efectos se aplicarán cuando confirmes el resultado.'
                : 'El Master pedirá una tirada cuando el resultado sea incierto.'}
          </p>
        </div>
      </header>
      <div
        className="dice-field"
        key={p?.dice.map((d) => d.value).join('-') || session.events.length}
      >
        {rolls.length ? (
          rolls.map((r) => (
            <div className="roll-group" key={r.groupId || r.label}>
              <div className="dice-row">
                {r.values.map((value, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: A die is a fixed slot within a persisted roll group, including equal values.
                  <div className="die" key={`${r.groupId}:${i}`}>
                    <Icon name="dice" width="70" height="70" />
                    <strong>{value}</strong>
                    <small>d{r.sides}</small>
                  </div>
                ))}
              </div>
              <span>{r.label}</span>
            </div>
          ))
        ) : (
          <div className="empty-die">
            <Icon name="dice" width="80" height="80" />
            <span>Sin tiradas todavía</span>
          </div>
        )}
      </div>
      {p && (
        <div className="dice-actions">
          {p.stage === 'unrolled' ? (
            <>
              <button
                type="button"
                className="primary-button"
                disabled={game.busy || !game.online}
                onClick={() =>
                  void game.command({ type: 'roll', pendingId: p.id })
                }
              >
                <Icon name="dice" />
                Tirar dados
              </button>
              <button
                type="button"
                className="text-button"
                disabled={game.busy}
                onClick={() =>
                  void game.command({ type: 'cancel', pendingId: p.id })
                }
              >
                Cancelar acción
              </button>
            </>
          ) : (
            <>
              {(p.canInspire || p.canLucky) && selected && (
                <div className="reroll-options">
                  <label>
                    Dado propio
                    <select
                      value={selected.index}
                      onChange={(e) => setDie(Number(e.target.value))}
                    >
                      {eligible.map((d) => (
                        <option value={d.index} key={d.index}>
                          {d.label}: {d.value} (d{d.sides})
                        </option>
                      ))}
                    </select>
                  </label>
                  {p.canInspire && (
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={game.busy}
                      onClick={() =>
                        void game.command({
                          type: 'reroll',
                          pendingId: p.id,
                          dieIndex: selected.index,
                          source: 'inspiration',
                        })
                      }
                    >
                      Gastar inspiración
                    </button>
                  )}
                  {p.canLucky && (
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={
                        game.busy ||
                        selected.sides !== 20 ||
                        selected.value !== 1
                      }
                      onClick={() =>
                        void game.command({
                          type: 'reroll',
                          pendingId: p.id,
                          dieIndex: selected.index,
                          source: 'lucky',
                        })
                      }
                    >
                      Usar Fortuna
                    </button>
                  )}
                </div>
              )}
              <button
                type="button"
                className="primary-button"
                disabled={game.busy || !game.online}
                onClick={() =>
                  void game.command({ type: 'accept', pendingId: p.id })
                }
              >
                <Icon name="check" />
                Confirmar resultado
              </button>
              <p className="subtle">
                Una tirada hecha se conserva. Repetirla requiere un recurso
                válido.
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
