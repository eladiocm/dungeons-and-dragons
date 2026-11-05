'use client';
import { useState } from 'react';
import {
  ABILITY_NAMES,
  ARMOR,
  BACKGROUNDS,
  CLASSES,
  FEATS,
  SKILLS,
  SPECIES,
  SPELLS,
  STYLES,
  WEAPONS,
} from '@/game/catalog';
import { modifier } from '@/game/character';
import type { ActionPlan } from '@/game/session-types';
import { ABILITIES, type CharacterState } from '@/game/types';
import { Icon } from './icons';

const signed = (v: number) => `${v >= 0 ? '+' : ''}${v}`;
const FEATURES: Record<string, [string, string]> = {
  resourceful: [
    'Ingenioso',
    'Recuperas inspiración heroica tras un descanso largo.',
  ],
  skillful: ['Hábil', 'Una competencia adicional a tu elección.'],
  versatile: ['Versátil', 'Una dote de origen adicional.'],
  dwarvenToughness: [
    'Dureza enana',
    'Un punto de golpe máximo adicional por nivel.',
  ],
  dwarvenResilience: [
    'Resistencia enana',
    'Resistencia al daño por veneno y ventaja para evitar o terminar Envenenado.',
  ],
  stonecunning: [
    'Afinidad con la piedra',
    'Acción adicional: sentido sísmico 18 m sobre piedra durante 10 minutos; dos usos.',
  ],
  darkvision36: ['Visión en la oscuridad', 'Alcance de 36 m.'],
  darkvision18: ['Visión en la oscuridad', 'Alcance de 18 m.'],
  lucky: [
    'Fortuna',
    'Puedes repetir un 1 de una prueba d20 propia; debes conservar el nuevo resultado.',
  ],
  brave: [
    'Valiente',
    'Ventaja en salvaciones para evitar o terminar Asustado.',
  ],
  halflingNimbleness: [
    'Agilidad de mediano',
    'Puedes pasar por el espacio de una criatura de tamaño mayor.',
  ],
  naturallyStealthy: [
    'Sigiloso por naturaleza',
    'Puedes ocultarte tras una criatura de tamaño mayor.',
  ],
  feyAncestry: ['Linaje feérico', 'Ventaja para evitar o terminar Hechizado.'],
  trance: [
    'Trance',
    'Inmunidad al sueño mágico y descanso largo de cuatro horas de trance.',
  ],
  keenSenses: [
    'Sentidos agudos',
    'Competencia en Percepción, Perspicacia o Supervivencia.',
  ],
  elvenLineage: ['Linaje élfico', 'Un truco de mago con la aptitud elegida.'],
  secondWind: [
    'Tomar aliento',
    'Acción adicional: recupera 1d10 + 1 PG. Dos usos; descanso corto recupera uno.',
  ],
  weaponMastery: [
    'Maestría con armas',
    'Puedes aplicar la maestría de las armas elegidas.',
  ],
  sneakAttack: [
    'Ataque furtivo',
    'Una vez por turno, 1d6 adicional si se cumplen sus condiciones con arma sutil o a distancia.',
  ],
  expertise: [
    'Pericia',
    'Duplica tu bonificador de competencia en dos habilidades.',
  ],
  thievesCant: [
    'Jerga de ladrones',
    'Conoces la jerga de ladrones y un idioma adicional.',
  ],
  protector: [
    'Protector',
    'Competencia con armas marciales y entrenamiento con armaduras pesadas.',
  ],
  thaumaturge: [
    'Taumaturgo',
    'Un truco de clérigo adicional y saber sagrado en Conocimiento arcano y Religión.',
  ],
  ritualAdept: [
    'Adepto de los rituales',
    'Puedes lanzar rituales de tu libro sin prepararlos; requieren más tiempo.',
  ],
  arcaneRecovery: [
    'Recuperación arcana',
    'Una vez por descanso largo, recuperas un espacio durante un descanso corto.',
  ],
  arcaneFocus: [
    'Lanzamiento arcano',
    'Utilizas el libro y tus conjuros preparados.',
  ],
};
export function featureInfo(id: string): [string, string] {
  if (id in FEATS) {
    const f = FEATS[id as keyof typeof FEATS];
    return [f.name, f.description];
  }
  if (id in STYLES)
    return [STYLES[id as keyof typeof STYLES], 'Estilo de combate elegido.'];
  return FEATURES[id] || [id, 'Rasgo de tu personaje.'];
}
export function CharacterSheet({
  hero,
  onPlan,
  onSuggest,
  busy = false,
  review = false,
}: {
  hero: CharacterState;
  onPlan?: (plan: ActionPlan, text: string) => void;
  onSuggest?: (text: string) => void;
  busy?: boolean;
  review?: boolean;
}) {
  const [tab, setTab] = useState('rasgos');
  const spells = [
    ...new Set([
      ...(hero.spellcasting?.cantrips || []),
      ...(hero.spellcasting?.prepared || []),
      ...hero.innateMagic.flatMap((m) => [...m.cantrips, m.spell]),
      ...(hero.elfMagic ? [hero.elfMagic.cantrip] : []),
    ]),
  ];
  return (
    <section className="character-sheet" aria-label="Ficha del personaje">
      <div className="sheet-heading">
        <div>
          <h2>{hero.name}</h2>
          <p>
            {SPECIES[hero.speciesId].name} · {CLASSES[hero.classId].name} de
            nivel 1 · {BACKGROUNDS[hero.backgroundId].name}
          </p>
        </div>
        <span className="character-sigil">
          <Icon
            name={
              hero.classId === 'wizard'
                ? 'spark'
                : hero.classId === 'rogue'
                  ? 'feather'
                  : hero.classId === 'cleric'
                    ? 'shield'
                    : 'sword'
            }
            width="30"
            height="30"
          />
        </span>
      </div>
      <div className="vitals">
        <div className="health">
          <span>Puntos de golpe</span>
          <strong>
            {hero.hp.current}
            <small> / {hero.hp.max}</small>
          </strong>
          <div className="health-track">
            <span
              style={{
                width: `${Math.max(0, hero.hp.current / hero.hp.max) * 100}%`,
              }}
            />
          </div>
          {hero.hp.temp > 0 && <small>+{hero.hp.temp} temporales</small>}
        </div>
        <div>
          <span>Armadura</span>
          <strong>{hero.ac}</strong>
          <small>CA</small>
        </div>
        <div>
          <span>Iniciativa</span>
          <strong>{signed(hero.initiative)}</strong>
          <small>d20</small>
        </div>
        <div>
          <span>Velocidad</span>
          <strong>{hero.speed}</strong>
          <small>metros</small>
        </div>
      </div>
      {review && <AbilityScores hero={hero} />}
      <div
        className="sheet-tabs"
        role="tablist"
        aria-label="Secciones de la ficha"
      >
        {[
          ['rasgos', 'Rasgos'],
          ['skills', 'Habilidades'],
          ['inventory', 'Inventario'],
          ['magic', 'Magia'],
        ].map(([id, name]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`sheet-tab-${hero.id}-${id}`}
            aria-controls={`sheet-panel-${hero.id}`}
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            {name}
            {id === 'inventory' && (
              <small>
                {hero.inventory.filter((i) => i.quantity > 0).length}
              </small>
            )}
          </button>
        ))}
      </div>
      <div
        className="sheet-content"
        role="tabpanel"
        id={`sheet-panel-${hero.id}`}
        aria-labelledby={`sheet-tab-${hero.id}-${tab}`}
      >
        {tab === 'rasgos' && (
          <>
            <div className="resource-line">
              <span>
                Inspiración heroica{' '}
                <strong>{hero.inspiration ? 'Disponible' : 'Gastada'}</strong>
              </span>
              <span>
                Dado de golpe{' '}
                <strong>
                  {hero.hitDice.current} / {hero.hitDice.max} d{hero.hitDie}
                </strong>
              </span>
              {Object.entries(hero.resources).map(([id, r]) => (
                <span key={id}>
                  {featureInfo(id)[0]}{' '}
                  <strong>
                    {r.current}/{r.max}
                  </strong>
                </span>
              ))}
            </div>
            <div className="feature-list">
              {[...new Set(hero.features)].map((id) => {
                const [name, description] = featureInfo(id);
                return (
                  <details key={id}>
                    <summary>{name}</summary>
                    <p>{description}</p>
                  </details>
                );
              })}
            </div>
            {hero.personality && (
              <p className="personal-story">{hero.personality}</p>
            )}
            <p className="subtle">
              {hero.alignment}. Tamaño{' '}
              {hero.size === 'small' ? 'pequeño' : 'mediano'}.
            </p>
            {hero.conditions.length > 0 && (
              <p className="condition-note">
                Condiciones: {hero.conditions.map((c) => c.id).join(', ')}
              </p>
            )}
          </>
        )}
        {tab === 'skills' && (
          <>
            {!review && <AbilityScores hero={hero} />}

            <div className="skills-list">
              {Object.entries(SKILLS).map(([id, s]) => (
                <div key={id}>
                  <span>
                    {hero.expertise.includes(id as keyof typeof SKILLS)
                      ? '◆'
                      : hero.proficiencies.includes(id as keyof typeof SKILLS)
                        ? '●'
                        : '○'}{' '}
                    {s.name}
                  </span>
                  <strong>
                    {signed(hero.skills[id as keyof typeof SKILLS])}
                  </strong>
                </div>
              ))}
            </div>
            <p className="subtle">
              ● Competencia · ◆ Pericia · Bonificador de competencia +2
            </p>
            <h3>Salvaciones</h3>
            <div className="saving-throws">
              {ABILITIES.map((a) => (
                <span key={a}>
                  {ABILITY_NAMES[a]}{' '}
                  <strong>
                    {signed(
                      modifier(hero.abilities[a]) +
                        (hero.saves.includes(a) ? 2 : 0),
                    )}
                  </strong>
                </span>
              ))}
            </div>
            <p>Idiomas: {hero.languages.join(', ')}.</p>
            <p>Herramientas: {hero.tools.join(', ')}.</p>
          </>
        )}
        {tab === 'inventory' && (
          <>
            <div className="inventory-heading">
              <p>{hero.currency} piezas de oro</p>
              <small>
                {hero.inventory
                  .reduce((sum, i) => sum + i.weight * i.quantity, 0)
                  .toFixed(1)}{' '}
                kg
              </small>
            </div>
            <ul className="inventory-list">
              {hero.inventory
                .filter((i) => i.quantity > 0)
                .map((item) => (
                  <li key={item.id}>
                    <div>
                      <strong>{item.name}</strong>
                      <small>
                        {item.equipped
                          ? 'Equipado'
                          : item.mission
                            ? 'Objeto de misión'
                            : `${item.weight} kg por unidad`}
                        {item.conditions?.length ? ' · Efecto mágico' : ''}
                      </small>
                    </div>
                    <span>×{item.quantity}</span>
                    {onPlan &&
                      (WEAPONS[item.catalogId] ||
                        ARMOR[item.catalogId] ||
                        item.catalogId === 'shield') && (
                        <button
                          type="button"
                          className="text-button"
                          disabled={busy}
                          onClick={() =>
                            onPlan(
                              {
                                kind: 'equip',
                                itemId: item.id,
                                equipped: !item.equipped,
                              },
                              `${item.equipped ? 'Guardo' : 'Equipo'} ${item.name}`,
                            )
                          }
                        >
                          {item.equipped ? 'Guardar' : 'Equipar'}
                        </button>
                      )}
                    {onPlan && item.catalogId === 'healing-potion' && (
                      <button
                        type="button"
                        className="text-button"
                        disabled={busy}
                        onClick={() =>
                          onPlan(
                            { kind: 'item', itemId: item.id },
                            'Bebo una poción de curación',
                          )
                        }
                      >
                        Beber
                      </button>
                    )}
                  </li>
                ))}
            </ul>
            <p className="subtle">
              Provisiones de esta aventura en solitario: dos pociones y bolsa de
              componentes, además del equipo de creación.
            </p>
          </>
        )}
        {tab === 'magic' && (
          <>
            {hero.spellcasting && (
              <p className="magic-budget">
                Espacios de nivel 1{' '}
                <strong>
                  {hero.spellcasting.slots.current} /{' '}
                  {hero.spellcasting.slots.max}
                </strong>{' '}
                · CD{' '}
                {8 + 2 + modifier(hero.abilities[hero.spellcasting.ability])} ·
                Ataque{' '}
                {signed(
                  2 + modifier(hero.abilities[hero.spellcasting.ability]),
                )}
              </p>
            )}
            {hero.innateMagic.map((m) => (
              <p className="subtle" key={m.source}>
                Dote {m.source === 'human' ? 'humana' : 'de trasfondo'}:{' '}
                {SPELLS[m.spell].name}, uso gratuito {m.remaining}/1.
              </p>
            ))}
            {spells.length ? (
              <div className="spell-list">
                {spells.map((id) => (
                  <details key={id}>
                    <summary>
                      {SPELLS[id].name}
                      <small>
                        {SPELLS[id].level
                          ? `Nivel ${SPELLS[id].level}`
                          : 'Truco'}
                      </small>
                    </summary>
                    <p>{SPELLS[id].description}</p>
                    <small>
                      Alcance {SPELLS[id].range} m ·{' '}
                      {SPELLS[id].concentration ? 'Concentración · ' : ''}
                      {SPELLS[id].components}
                    </small>
                    {onSuggest && (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() =>
                          onSuggest(`Quiero lanzar ${SPELLS[id].name} sobre `)
                        }
                      >
                        Preparar en el chat
                      </button>
                    )}
                  </details>
                ))}
              </div>
            ) : (
              <p>
                No tienes magia elegida. Tus habilidades, equipo y acciones
                siguen ofreciendo formas de resolver la aventura.
              </p>
            )}
            {hero.spellcasting?.book.length ? (
              <p className="subtle">
                Libro:{' '}
                {hero.spellcasting.book.map((id) => SPELLS[id].name).join(', ')}
                .
              </p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function AbilityScores({ hero }: { hero: CharacterState }) {
  return (
    <div className="ability-scores">
      {ABILITIES.map((a) => (
        <div key={a}>
          <span>{ABILITY_NAMES[a]}</span>
          <strong>{signed(modifier(hero.abilities[a]))}</strong>
          <small>{hero.abilities[a]}</small>
        </div>
      ))}
    </div>
  );
}
