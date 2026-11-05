'use client';
import { useState } from 'react';
import {
  ABILITY_NAMES,
  BACKGROUNDS,
  CLASS_ITEMS,
  CLASSES,
  FEATS,
  ITEMS,
  LANGUAGES,
  SKILLS,
  SPECIES,
  SPELLS,
  STYLES,
  TOOLS,
  WEAPONS,
} from '@/game/catalog';
import {
  createCharacter,
  modifier,
  suggestCharacter,
  weaponProficient,
} from '@/game/character';
import { recommendChoices } from '@/game/creator-choices';
import {
  ABILITIES,
  type Ability,
  type CharacterDraft,
  type ClassId,
  type SkillId,
} from '@/game/types';
import { CharacterSheet } from './character-sheet';
import { Icon, type IconName } from './icons';

const CLASS_ICON: Record<ClassId, IconName> = {
  fighter: 'sword',
  rogue: 'feather',
  cleric: 'shield',
  wizard: 'spark',
};
function Choices({
  label,
  values,
  selected,
  count,
  onChange,
}: {
  label: string;
  values: { id: string; name: string; description?: string }[];
  selected: string[];
  count: number;
  onChange: (value: string[]) => void;
}) {
  return (
    <fieldset className="choice-group">
      <legend>
        {label}{' '}
        <small>
          {selected.length}/{count}
        </small>
      </legend>
      <div className="choice-grid">
        {values.map((v) => (
          <label className="check-choice" key={v.id}>
            <input
              type="checkbox"
              checked={selected.includes(v.id)}
              disabled={!selected.includes(v.id) && selected.length >= count}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...selected, v.id]
                    : selected.filter((s) => s !== v.id),
                )
              }
            />
            <span>
              {v.name}
              {v.description && <small>{v.description}</small>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
const skillOptions = (ids: readonly string[]) =>
  ids.map((id) => ({
    id,
    name: SKILLS[id as SkillId]?.name || TOOLS[id] || id,
  }));
const spellOptions = (list: 'cleric' | 'wizard', level: number) =>
  Object.entries(SPELLS)
    .filter(([, s]) => s.level === level && s.lists.includes(list))
    .map(([id, s]) => ({ id, name: s.name, description: s.description }));
export function CharacterCreator({
  busy,
  onStart,
  onCancel,
}: {
  busy: boolean;
  onStart: (draft: CharacterDraft) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(() => suggestCharacter('fighter')),
    [step, setStep] = useState(0);
  const set = <K extends keyof CharacterDraft>(
    key: K,
    value: CharacterDraft[K],
  ) => setDraft((d) => ({ ...d, [key]: value }));
  const structure = (patch: Partial<CharacterDraft>) =>
    setDraft((d) => recommendChoices({ ...d, ...patch }));
  let hero: ReturnType<typeof createCharacter> | undefined,
    problem = '';
  try {
    hero = createCharacter(draft, 'preview');
  } catch (e) {
    problem = e instanceof Error ? e.message : 'Revisa tus elecciones.';
  }
  const cls = CLASSES[draft.classId],
    background = BACKGROUNDS[draft.backgroundId],
    magicClass =
      draft.classId === 'cleric' || draft.classId === 'wizard'
        ? draft.classId
        : undefined;
  const feats = Object.entries(FEATS).filter(
    ([id]) => id !== background.feat || id === 'skilled',
  );
  const sources = [
    ...background.skills,
    ...draft.classSkills,
    ...(draft.speciesId === 'human'
      ? [draft.extraSkill]
      : draft.speciesId === 'high-elf'
        ? [draft.elfSkill]
        : []),
  ];
  const known = [...new Set(sources.concat(draft.replacements))];
  const boosts = background.abilities
    .flatMap((a) =>
      background.abilities
        .filter((b) => b !== a)
        .map((b) => ({
          value: `${a}:${b}`,
          name: `${ABILITY_NAMES[a]} +2, ${ABILITY_NAMES[b]} +1`,
          scores: { [a]: 2, [b]: 1 },
        })),
    )
    .concat([
      {
        value: 'all',
        name: 'Las tres características +1',
        scores: Object.fromEntries(background.abilities.map((a) => [a, 1])),
      },
    ]);
  const boostKey = Object.values(draft.boosts).every((v) => v === 1)
    ? 'all'
    : `${Object.keys(draft.boosts).find((a) => draft.boosts[a as Ability] === 2)}:${Object.keys(draft.boosts).find((a) => draft.boosts[a as Ability] === 1)}`;
  const summary = step === 3;
  return (
    <section className="creator" aria-labelledby="creator-title">
      <div className="creator-heading">
        <div>
          <p className="subtle">La última luz de Valdumbría</p>
          <h1 id="creator-title">
            {summary ? 'Tu personaje está listo' : 'Da forma a tu aventurero'}
          </h1>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Cerrar creador"
          onClick={onCancel}
        >
          <Icon name="close" />
        </button>
      </div>
      <nav className="creation-steps" aria-label="Creación de personaje">
        {['Identidad', 'Origen y atributos', 'Talentos', 'Revisión'].map(
          (title, index) => (
            <button
              key={title}
              type="button"
              aria-current={step === index ? 'step' : undefined}
              disabled={index > step}
              onClick={() => setStep(index)}
            >
              <span>{index + 1}</span>
              {title}
            </button>
          ),
        )}
      </nav>
      {step === 0 && (
        <>
          <div className="identity-fields">
            <label>
              Nombre
              <input
                autoComplete="off"
                maxLength={50}
                value={draft.name}
                onChange={(e) => set('name', e.target.value)}
              />
            </label>
            <p>
              Personaje de nivel 1. Las decisiones de esta ficha cambian lo que
              puedes hacer en la aventura.
            </p>
          </div>
          <fieldset className="class-options">
            <legend>Elige tu clase</legend>
            <div className="class-grid">
              {(Object.entries(CLASSES) as [ClassId, typeof cls][]).map(
                ([id, c]) => (
                  <button
                    type="button"
                    key={id}
                    aria-pressed={draft.classId === id}
                    className="class-choice"
                    onClick={() =>
                      setDraft((d) =>
                        recommendChoices({
                          ...suggestCharacter(id),
                          name: d.name,
                          speciesId: d.speciesId,
                          humanSize: d.humanSize,
                          personality: d.personality,
                          alignment: d.alignment,
                        }),
                      )
                    }
                  >
                    <Icon name={CLASS_ICON[id]} width="38" height="38" />
                    <h2>{c.name}</h2>
                    <p>{c.description}</p>
                    <small>{c.strength}</small>
                    <small className="muted">{c.limitation}</small>
                    {draft.classId === id && (
                      <span className="chosen">
                        <Icon name="check" />
                        Elegida
                      </span>
                    )}
                  </button>
                ),
              )}
            </div>
          </fieldset>
          <fieldset>
            <legend>Especie</legend>
            <div className="species-grid">
              {Object.entries(SPECIES).map(([id, s]) => (
                <label key={id} className="species-choice">
                  <input
                    type="radio"
                    name="species"
                    value={id}
                    checked={draft.speciesId === id}
                    onChange={() =>
                      structure({
                        speciesId: id as CharacterDraft['speciesId'],
                      })
                    }
                  />
                  <span>
                    <strong>{s.name}</strong>
                    <small>{s.description}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {draft.speciesId === 'human' && (
            <label className="compact-field">
              Tamaño
              <select
                value={draft.humanSize}
                onChange={(e) =>
                  set('humanSize', e.target.value as 'small' | 'medium')
                }
              >
                <option value="medium">Mediano</option>
                <option value="small">Pequeño</option>
              </select>
            </label>
          )}
        </>
      )}
      {step === 1 && (
        <div className="creator-columns">
          <div>
            <label>
              Trasfondo
              <select
                value={draft.backgroundId}
                onChange={(e) =>
                  structure({
                    backgroundId: e.target
                      .value as CharacterDraft['backgroundId'],
                  })
                }
              >
                {Object.entries(BACKGROUNDS).map(([id, b]) => (
                  <option value={id} key={id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="rule-note">
              {background.skills.map((s) => SKILLS[s].name).join(' y ')}.{' '}
              {TOOLS[background.tool]}. Dote: {FEATS[background.feat].name}.
            </p>
            <label>
              Mejoras del trasfondo
              <select
                value={boostKey}
                onChange={(e) =>
                  set(
                    'boosts',
                    boosts.find((b) => b.value === e.target.value)?.scores ||
                      {},
                  )
                }
              >
                {boosts.map((b) => (
                  <option value={b.value} key={b.value}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Personalidad e historia
              <textarea
                rows={3}
                maxLength={600}
                value={draft.personality}
                onChange={(e) => set('personality', e.target.value)}
                placeholder="¿Qué te mueve a ayudar a Valdumbría?"
              />
            </label>
            <label>
              Alineamiento
              <select
                value={draft.alignment}
                onChange={(e) => set('alignment', e.target.value)}
              >
                {[
                  'Legal bueno',
                  'Neutral bueno',
                  'Caótico bueno',
                  'Legal neutral',
                  'Neutral',
                  'Caótico neutral',
                  'Legal malvado',
                  'Neutral malvado',
                  'Caótico malvado',
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <h2>Características</h2>
            <p className="subtle">
              Distribución estándar: 15, 14, 13, 12, 10 y 8. Cambiar un valor lo
              intercambia con el anterior.
            </p>
            <div className="ability-editor">
              {ABILITIES.map((a) => (
                <label key={a}>
                  <span>{ABILITY_NAMES[a]}</span>
                  <select
                    aria-label={`Valor de ${ABILITY_NAMES[a]}`}
                    value={draft.baseAbilities[a]}
                    onChange={(e) => {
                      const value = Number(e.target.value),
                        other = ABILITIES.find(
                          (b) => draft.baseAbilities[b] === value,
                        );
                      setDraft((d) => ({
                        ...d,
                        baseAbilities: {
                          ...d.baseAbilities,
                          [a]: value,
                          ...(other ? { [other]: d.baseAbilities[a] } : {}),
                        },
                      }));
                    }}
                  >
                    {[15, 14, 13, 12, 10, 8].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                  <span className="final-score">
                    {draft.baseAbilities[a] + (draft.boosts[a] || 0)}{' '}
                    <small>
                      (
                      {modifier(
                        draft.baseAbilities[a] + (draft.boosts[a] || 0),
                      ) >= 0
                        ? '+'
                        : ''}
                      {modifier(
                        draft.baseAbilities[a] + (draft.boosts[a] || 0),
                      )}
                      )
                    </small>
                  </span>
                </label>
              ))}
            </div>
            <p className="rule-note">
              Las mejoras proceden del trasfondo, según el SRD actual; la
              especie aporta sus rasgos.
            </p>
          </div>
        </div>
      )}
      {step === 2 && (
        <div className="talent-form">
          <p className="rule-note">
            La propuesta ya está completa. Puedes ajustar cada elección; el
            contador indica cuántas necesitas.
          </p>
          <Choices
            label="Habilidades de clase"
            count={cls.skillCount}
            values={skillOptions(cls.skills)}
            selected={draft.classSkills}
            onChange={(v) => set('classSkills', v as SkillId[])}
          />
          {draft.speciesId === 'human' && (
            <div className="creator-columns">
              <label>
                Habilidad adicional humana
                <select
                  value={draft.extraSkill}
                  onChange={(e) => set('extraSkill', e.target.value as SkillId)}
                >
                  {skillOptions(Object.keys(SKILLS)).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Dote de origen humana
                <select
                  value={draft.humanFeat}
                  onChange={(e) =>
                    structure({
                      humanFeat: e.target.value as CharacterDraft['humanFeat'],
                    })
                  }
                >
                  {feats.map(([id, f]) => (
                    <option key={id} value={id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <small>{FEATS[draft.humanFeat].description}</small>
              </label>
            </div>
          )}
          {draft.speciesId === 'human' && draft.humanFeat === 'skilled' && (
            <Choices
              label="Habilidoso"
              count={3}
              values={skillOptions([
                ...Object.keys(SKILLS),
                ...Object.keys(TOOLS),
              ])}
              selected={draft.skilledChoices}
              onChange={(v) => set('skilledChoices', v)}
            />
          )}
          {draft.speciesId === 'high-elf' && (
            <div className="creator-columns">
              <label>
                Sentidos agudos
                <select
                  value={draft.elfSkill}
                  onChange={(e) =>
                    structure({
                      elfSkill: e.target.value as CharacterDraft['elfSkill'],
                    })
                  }
                >
                  {skillOptions(['perception', 'insight', 'survival']).map(
                    (s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label>
                Aptitud del linaje
                <select
                  value={draft.elfAbility}
                  onChange={(e) =>
                    set(
                      'elfAbility',
                      e.target.value as CharacterDraft['elfAbility'],
                    )
                  }
                >
                  {['int', 'wis', 'cha'].map((a) => (
                    <option key={a} value={a}>
                      {ABILITY_NAMES[a as Ability]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Truco del linaje
                <select
                  value={draft.elfCantrip}
                  onChange={(e) => set('elfCantrip', e.target.value)}
                >
                  {spellOptions('wizard', 0).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {sources
            .filter((s, i) => sources.indexOf(s) !== i)
            .map((skill, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: Controlled replacement slots are positional in the validated draft.
              <label key={`${skill}:${index}`}>
                Sustituir competencia repetida: {SKILLS[skill].name}
                <select
                  value={draft.replacements[index] || ''}
                  onChange={(e) => {
                    const replacements = [...draft.replacements];
                    replacements[index] = e.target.value as SkillId;
                    set('replacements', replacements);
                  }}
                >
                  <option value="">Elige otra habilidad</option>
                  {skillOptions(
                    Object.keys(SKILLS).filter(
                      (s) => !sources.includes(s as SkillId),
                    ),
                  ).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          {draft.classId === 'rogue' && (
            <Choices
              label="Pericia"
              count={2}
              values={skillOptions(known)}
              selected={draft.expertise}
              onChange={(v) => set('expertise', v as SkillId[])}
            />
          )}
          {draft.classId === 'fighter' && (
            <div className="creator-columns">
              <label>
                Estilo de combate
                <select
                  value={draft.fightingStyle}
                  onChange={(e) =>
                    set(
                      'fightingStyle',
                      e.target.value as CharacterDraft['fightingStyle'],
                    )
                  }
                >
                  {Object.entries(STYLES).map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Equipo de clase
                <select
                  value={draft.equipment}
                  onChange={(e) =>
                    set('equipment', e.target.value as 'A' | 'B')
                  }
                >
                  <option value="A">A · Cota de malla y armas de fuerza</option>
                  <option value="B">
                    B · Cuero tachonado y armas de destreza
                  </option>
                </select>
                <small>
                  {[...new Set(CLASS_ITEMS.fighter[draft.equipment].items)]
                    .map((i) => ITEMS[i]?.name || WEAPONS[i]?.name || i)
                    .join(', ')}
                </small>
              </label>
            </div>
          )}
          {(draft.classId === 'fighter' || draft.classId === 'rogue') && (
            <Choices
              label="Maestrías de armas"
              count={draft.classId === 'fighter' ? 3 : 2}
              values={Object.entries(WEAPONS)
                .filter(([id]) =>
                  weaponProficient(
                    { classId: draft.classId, features: [] },
                    id,
                  ),
                )
                .map(([id, w]) => ({
                  id,
                  name: w.name,
                  description: `${w.dice[0]}d${w.dice[1]} · ${w.mastery}`,
                }))}
              selected={draft.weaponMasteries}
              onChange={(v) => set('weaponMasteries', v)}
            />
          )}
          {draft.classId === 'cleric' && (
            <label>
              Orden divina
              <select
                value={draft.divineOrder}
                onChange={(e) =>
                  structure({
                    divineOrder: e.target
                      .value as CharacterDraft['divineOrder'],
                  })
                }
              >
                <option value="protector">
                  Protector · Armas marciales y armadura pesada
                </option>
                <option value="thaumaturge">
                  Taumaturgo · Un truco y saber sagrado
                </option>
              </select>
            </label>
          )}
          {magicClass && (
            <>
              <Choices
                label="Trucos de clase"
                count={
                  magicClass === 'cleric' && draft.divineOrder === 'thaumaturge'
                    ? 4
                    : 3
                }
                values={spellOptions(magicClass, 0)}
                selected={draft.cantrips}
                onChange={(v) => set('cantrips', v)}
              />
              {magicClass === 'wizard' && (
                <Choices
                  label="Libro de conjuros"
                  count={6}
                  values={spellOptions('wizard', 1)}
                  selected={draft.spellbook}
                  onChange={(v) => set('spellbook', v)}
                />
              )}
              <Choices
                label="Conjuros preparados"
                count={4}
                values={spellOptions(magicClass, 1).filter(
                  (s) =>
                    magicClass !== 'wizard' || draft.spellbook.includes(s.id),
                )}
                selected={draft.prepared}
                onChange={(v) => set('prepared', v)}
              />
            </>
          )}
          {draft.magic.map((m, index) => (
            <section className="origin-magic" key={m.source}>
              <h2>
                Magia de{' '}
                {m.source === 'human' ? 'la dote humana' : 'tu trasfondo'}
              </h2>
              <label>
                Aptitud mágica
                <select
                  value={m.ability}
                  onChange={(e) => {
                    const magic = structuredClone(draft.magic);
                    magic[index].ability = e.target.value as typeof m.ability;
                    set('magic', magic);
                  }}
                >
                  {['int', 'wis', 'cha'].map((a) => (
                    <option key={a} value={a}>
                      {ABILITY_NAMES[a as Ability]}
                    </option>
                  ))}
                </select>
              </label>
              <Choices
                label="Trucos de la dote"
                count={2}
                values={spellOptions(m.list, 0)}
                selected={m.cantrips}
                onChange={(v) => {
                  const magic = structuredClone(draft.magic);
                  magic[index].cantrips = v;
                  set('magic', magic);
                }}
              />
              <label>
                Conjuro de nivel 1
                <select
                  value={m.spell}
                  onChange={(e) => {
                    const magic = structuredClone(draft.magic);
                    magic[index].spell = e.target.value;
                    set('magic', magic);
                  }}
                >
                  {spellOptions(m.list, 1).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <small>
                  Un uso gratuito por descanso largo, separado de los espacios
                  de clase.
                </small>
              </label>
            </section>
          ))}
          <Choices
            label="Idiomas además de Común"
            count={2}
            values={LANGUAGES.map((id) => ({ id, name: id }))}
            selected={draft.languages}
            onChange={(v) => set('languages', v)}
          />
          {draft.classId === 'rogue' && (
            <label>
              Idioma adicional de pícaro
              <select
                value={draft.rogueLanguage}
                onChange={(e) => set('rogueLanguage', e.target.value)}
              >
                {LANGUAGES.filter((l) => !draft.languages.includes(l)).map(
                  (l) => (
                    <option key={l}>{l}</option>
                  ),
                )}
              </select>
            </label>
          )}
        </div>
      )}
      {summary && hero && (
        <>
          <p className="review-intro">
            {SPECIES[draft.speciesId].name} · {cls.name} · {background.name}.
            Revisa tu ficha: la aventura empezará únicamente al pulsar Iniciar
            partida.
          </p>
          <CharacterSheet hero={hero} review />
          <section className="adventure-review">
            <Icon name="book" />
            <div>
              <h2>La última luz de Valdumbría</h2>
              <p>
                Una lente desaparecida, una aprendiz en peligro y un faro que
                debe volver a brillar. Tendrás un objetivo definido y libertad
                para decidir cómo intentarlo.
              </p>
              <small>
                Una persona · Nivel 1 · Combate sin tablero. El mundo abierto
                estará disponible en una próxima etapa.
              </small>
            </div>
          </section>
        </>
      )}
      {problem && step >= 2 && (
        <p role="alert" className="error-banner">
          {problem}
        </p>
      )}
      <footer className="creator-footer">
        <button
          className="secondary-button"
          type="button"
          onClick={() => (step ? setStep((s) => s - 1) : onCancel())}
          disabled={busy}
        >
          {step ? 'Volver' : 'Cancelar'}
        </button>
        <span className="subtle">
          {summary
            ? 'Todo se guarda al iniciar la partida.'
            : 'Al cambiar clase, especie o trasfondo se ajusta la propuesta de talentos.'}
        </span>
        <button
          type="button"
          className="primary-button"
          disabled={busy || (step >= 2 && !hero) || !draft.name.trim()}
          onClick={() =>
            summary ? void onStart(draft) : setStep((s) => s + 1)
          }
        >
          {busy
            ? 'Preparando aventura…'
            : summary
              ? 'Iniciar partida'
              : step === 2
                ? 'Revisar personaje'
                : 'Continuar'}
          <Icon name="chevron" />
        </button>
      </footer>
    </section>
  );
}
