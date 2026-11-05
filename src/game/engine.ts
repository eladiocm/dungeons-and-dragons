import {
  ADVENTURE,
  adventureNpcs,
  initialWorld,
  OPENING,
  SCENES,
} from './adventure.ts';
import { SKILLS, SPELLS, WEAPONS } from './catalog.ts';
import { createBattle } from './combat.ts';
import { validatePlan } from './plan-contract.ts';
import { createTapeRoller } from './rng-tape.ts';
import { executePlan } from './session-actions.ts';
import type {
  ActionPlan,
  ActionResult,
  GameCommand,
  GameSession,
  PendingAction,
  PublicSession,
} from './session-types.ts';
import {
  checkEnding,
  currentNpcIds,
  getHero,
  giveItem,
  setScene,
} from './session-utils.ts';
import { type CharacterState, type Roller, RuleError } from './types.ts';

class NeedsDice extends Error {}
const QUESTIONS = {
  square: '¿Qué quieres averiguar o preparar antes de salir?',
  road: '¿Cómo quieres seguir el camino hacia el molino?',
  mill: '¿Cómo vas a conseguir acceso a la cámara?',
  chamber: '¿Qué harás con el mecanismo y con Sira?',
  beacon: '¿Cómo quieres devolver la luz al faro?',
};
export function actionLabel(plan: ActionPlan): string {
  switch (plan.kind) {
    case 'travel':
      return `Ir a ${SCENES[plan.destination].title}`;
    case 'escape':
      return 'Escapar hacia el camino sin abandonar la misión';
    case 'attack':
      return `Atacar con ${WEAPONS[plan.weaponId]?.name || plan.weaponId}`;
    case 'cast':
      return `Lanzar ${SPELLS[plan.spellId]?.name || plan.spellId}`;
    case 'creative':
      return `${plan.description}${plan.skill ? ` · ${SKILLS[plan.skill].name}, CD ${plan.dc ?? 15}` : ''}`;
    case 'interact':
      return plan.method === 'persuade'
        ? 'Convencer a Bram · Persuasión, CD 12'
        : plan.method === 'sneak'
          ? 'Entrar por la ventana · Sigilo, CD 12'
          : plan.method === 'force'
            ? 'Forzar la puerta · Atletismo, CD 13'
            : `Interactuar: ${plan.method}`;
    case 'death':
      return 'Salvación contra muerte';
    case 'feature':
      return plan.feature === 'secondWind'
        ? 'Tomar aliento'
        : 'Afinidad con la piedra';
    case 'rest':
      return `Descanso ${plan.rest === 'short' ? 'corto' : 'largo'}`;
    case 'item':
      return 'Utilizar objeto';
    case 'equip':
      return plan.equipped ? 'Equipar objeto' : 'Guardar objeto';
    case 'move':
      return 'Desplazarse';
    case 'maneuver':
      return `Acción: ${plan.maneuver}`;
    case 'endTurn':
      return 'Finalizar turno';
    case 'retreat':
      return 'Retirarse de la aventura';
  }
}
export function startSession(
  id: string,
  participantId: string,
  character: CharacterState,
): GameSession {
  const hero = structuredClone(character);
  giveItem(hero, 'healing-potion', 2);
  giveItem(hero, 'component-pouch');
  const battle = createBattle([hero, ...adventureNpcs()], hero.id);
  battle.inCombat = false;
  const state: GameSession = {
    id,
    schemaVersion: 2,
    rulesetVersion: 'SRD-5.2.1',
    catalogVersion: 1,
    moduleVersion: 1,
    adventureMode: 'prepared',
    version: 0,
    status: 'active',
    phase: 'exploration',
    participants: [{ participantId, characterId: hero.id, role: 'player' }],
    battle,
    world: initialWorld(),
    dmState: {
      secrets: [
        'Bram teme que el mecanismo vuelva a herir a alguien; no es un enemigo obligado.',
        'La palanca libera las pinzas. Sira intentó reparar el mecanismo.',
      ],
    },
    messages: [
      {
        id: `${id}:opening`,
        role: 'assistant',
        content: OPENING,
        sceneId: 'square',
        imagePrompt: SCENES.square.imagePrompt,
        eventId: `${id}:event:1`,
        narrationPending: true,
      },
    ],
    events: [
      {
        id: `${id}:event:1`,
        sequence: 1,
        actorId: hero.id,
        type: 'start',
        facts: [
          `Aventura ${ADVENTURE.title}.`,
          ...initialWorld().facts,
          'Provisiones originales de juego en solitario: dos pociones de curación y una bolsa de componentes.',
        ],
        rolls: [],
        sceneId: 'square',
      },
    ],
  };
  setScene(state, 'square');
  return state;
}
function commitResult(
  result: ActionResult,
  actorId: string,
  kind: string,
): GameSession {
  const state = result.state;
  delete state.pending;
  checkEnding(state);
  const sequence = (state.events.at(-1)?.sequence || 0) + 1,
    eventId = `${state.id}:event:${sequence}`;
  const facts = [
    ...result.facts,
    ...(state.ending ? [state.ending.epilogue] : []),
  ];
  state.events.push({
    id: eventId,
    sequence,
    actorId,
    type: kind,
    facts,
    rolls: result.rolls,
    sceneId: state.world.sceneId,
  });
  const question = state.ending
    ? ''
    : state.battle.inCombat
      ? '¿Cómo quieres aprovechar tu turno antes de finalizarlo?'
      : QUESTIONS[state.world.sceneId];
  state.messages.push({
    id: `${state.id}:message:${sequence}`,
    role: 'assistant',
    content: `${facts.join(' ')}${question ? `\n\n${question}` : ''}`,
    sceneId: state.world.sceneId,
    imagePrompt: SCENES[state.world.sceneId].imagePrompt,
    eventId,
    narrationPending: true,
  });
  if (state.messages.length > 120)
    state.messages = [state.messages[0], ...state.messages.slice(-119)];
  return state;
}
function preview(pending: PendingAction, roller: Roller): void {
  const random = createTapeRoller(pending.tape, roller);
  pending.preview = executePlan(
    pending.base,
    pending.actorId,
    pending.plan,
    random.roller,
  );
  pending.tape = random.tape;
  if (pending.usedRerolls.includes('inspiration'))
    getHero(pending.preview.state, pending.actorId).inspiration = false;
}
export function transition(
  input: GameSession,
  command: GameCommand,
  roller: Roller,
): GameSession {
  if (
    !command ||
    typeof command.id !== 'string' ||
    !command.id.trim() ||
    command.id.length > 100
  )
    throw new RuleError('Identificador de comando inválido.');
  getHero(input, command.actorId);
  if (input.status === 'ended') {
    if (command.type === 'sync')
      return { ...structuredClone(input), version: input.version + 1 };
    throw new RuleError(
      'La aventura ha terminado. Puedes revisar el diario o crear otra partida.',
    );
  }
  let state = structuredClone(input);
  if (command.type === 'sync') {
    checkEnding(state);
    if (state.ending)
      state = commitResult(
        { state, facts: [], rolls: [] },
        command.actorId,
        'ending',
      );
    state.version = input.version + 1;
    return state;
  }
  if (command.type === 'propose') {
    if (state.pending)
      throw new RuleError('Resuelve o cancela primero la acción pendiente.');
    if (
      typeof command.text !== 'string' ||
      !command.text.trim() ||
      command.text.length > 2000
    )
      throw new RuleError('Escribe una acción de hasta 2000 caracteres.');
    const plan = validatePlan(command.plan);
    state.messages.push({
      id: `${state.id}:user:${command.id}`,
      role: 'user',
      content: command.text.trim(),
    });
    try {
      state = commitResult(
        executePlan(state, command.actorId, plan, () => {
          throw new NeedsDice();
        }),
        command.actorId,
        plan.kind,
      );
    } catch (error) {
      if (!(error instanceof NeedsDice)) throw error;
      state.pending = {
        id: `${state.id}:action:${command.id}`,
        actorId: command.actorId,
        plan,
        label: actionLabel(plan),
        base: structuredClone(state),
        tape: [],
        usedRerolls: [],
        luckyGroups: [],
      };
      state.phase = 'awaiting-roll';
    }
  } else {
    const pending = state.pending;
    if (
      !pending ||
      pending.id !== command.pendingId ||
      pending.actorId !== command.actorId
    )
      throw new RuleError('No existe esa acción pendiente.');
    if (command.type === 'cancel') {
      if (pending.preview)
        throw new RuleError(
          'Una tirada ya realizada debe resolverse; no puedes descartarla para repetirla.',
        );
      state = structuredClone(pending.base);
      state.messages.pop();
      delete state.pending;
    } else if (command.type === 'roll') {
      if (pending.preview)
        throw new RuleError(
          'Estos dados ya se tiraron. Confirma el resultado o usa un recurso permitido.',
        );
      preview(pending, roller);
      state.phase = 'awaiting-choice';
    } else if (command.type === 'reroll') {
      if (!pending.preview || !Number.isInteger(command.dieIndex))
        throw new RuleError('Primero tira los dados.');
      const die = pending.tape[command.dieIndex],
        hero = getHero(pending.base, command.actorId);
      if (!die || die.actorId !== command.actorId)
        throw new RuleError(
          'Solo puedes repetir un dado que haya tirado tu personaje.',
        );
      if (command.source === 'inspiration') {
        if (!hero.inspiration || pending.usedRerolls.includes('inspiration'))
          throw new RuleError('No tienes inspiración disponible.');
      } else if (command.source === 'lucky') {
        if (
          !hero.features.includes('lucky') ||
          die.sides !== 20 ||
          die.value !== 1 ||
          pending.luckyGroups.includes(die.groupId)
        )
          throw new RuleError(
            'Fortuna permite repetir un 1 de tu prueba d20 una vez.',
          );
        pending.luckyGroups.push(die.groupId);
      } else throw new RuleError('Repetición no válida.');
      const value = roller(die.sides);
      if (!Number.isInteger(value) || value < 1 || value > die.sides)
        throw new RuleError('Dado imposible.', 500);
      die.value = value;
      pending.usedRerolls.push(command.source);
      preview(pending, roller);
      state.phase = 'awaiting-choice';
    } else if (command.type === 'accept') {
      if (!pending.preview) throw new RuleError('Primero realiza la tirada.');
      const result = pending.preview;
      if (pending.usedRerolls.includes('inspiration'))
        result.facts.push(
          'Has gastado tu inspiración heroica y debes conservar el nuevo resultado.',
        );
      if (pending.usedRerolls.includes('lucky'))
        result.facts.push(
          'Fortuna ha repetido un dado que mostraba 1; el nuevo resultado es obligatorio.',
        );
      state = commitResult(result, command.actorId, pending.plan.kind);
    } else throw new RuleError('Comando no válido.');
  }
  state.version = input.version + 1;
  return state;
}
export function publicSession(input: GameSession): PublicSession {
  const state = structuredClone(input),
    ids = new Set([
      ...state.participants.map((p) => p.characterId),
      ...currentNpcIds(state),
    ]);
  const battle = state.battle;
  battle.actors = Object.fromEntries(
    Object.entries(battle.actors).filter(([id]) => ids.has(id)),
  );
  battle.positions = Object.fromEntries(
    Object.entries(battle.positions).filter(([id]) => ids.has(id)),
  );
  battle.budgets = Object.fromEntries(
    Object.entries(battle.budgets).filter(([id]) => ids.has(id)),
  );
  battle.teams = Object.fromEntries(
    Object.entries(battle.teams).filter(([id]) => ids.has(id)),
  );
  battle.turns = Object.fromEntries(
    Object.entries(battle.turns).filter(([id]) => ids.has(id)),
  );
  battle.cover = Object.fromEntries(
    Object.entries(battle.cover).filter(([id]) => ids.has(id)),
  );
  battle.order = battle.order.filter((id) => ids.has(id));
  const world = state.world;
  world.objects = Object.fromEntries(
    Object.entries(world.objects).filter(
      ([, o]) =>
        o.sceneId === world.sceneId && o.visible && o.state !== 'taken',
    ),
  );
  world.npcLocations = Object.fromEntries(
    Object.entries(world.npcLocations).filter(([id]) => ids.has(id)),
  );
  world.npcDisposition = Object.fromEntries(
    Object.entries(world.npcDisposition).filter(([id]) => ids.has(id)),
  );
  const pending = state.pending,
    hero = pending ? getHero(pending.base, pending.actorId) : undefined;
  const scene = {
    ...SCENES[world.sceneId],
    connections: [...SCENES[world.sceneId].connections],
  };
  if (world.sceneId === 'chamber') {
    const removed =
      world.flags.beaconLit || input.world.objects.lens.state === 'taken';
    scene.description = `Tres anillos de bronce rodean ${removed ? 'un alojamiento vacío; ya has retirado la lente' : 'la lente de ámbar, sujeta al mecanismo'}. ${world.flags.siraRescued ? 'La viga está asegurada y Sira se dirige al refugio.' : 'Sira sigue atrapada bajo una viga; una palanca junto al pedestal permite liberar las pinzas.'}`;
    scene.imagePrompt = `Hand painted original fantasy underground workshop, bronze mechanical rings and ${removed ? 'empty lens cradle' : 'glowing amber lens'}, release lever, ${world.flags.siraRescued ? 'secured fallen beam, no apprentice present' : 'apprentice trapped beneath a beam'}, atmospheric warm light, no text or interface`;
  }
  if (world.sceneId === 'beacon' && world.flags.beaconLit) {
    scene.description =
      'La lente encaja en el faro y su luz de ámbar atraviesa la niebla. El valle vuelve a ser visible bajo las campanas.';
    scene.imagePrompt =
      'Hand painted original fantasy lighthouse, glowing amber lens casting a brilliant beam across a misty medieval valley, hopeful dawn, no text or UI';
  }
  if (world.sceneId === 'mill' && battle.actors.bram?.dead) {
    scene.description =
      'El molino permanece inmóvil. Bram ha caído y la entrada a la cámara ya no está vigilada; su llave y los accesos que hayas preparado siguen formando parte de la escena.';
    scene.imagePrompt =
      'Hand painted fantasy abandoned stone windmill, silent empty entrance without watchman, side window and cellar door, atmospheric blue fog and amber light, no text';
  }
  return {
    id: state.id,
    version: state.version,
    status: state.status,
    phase: state.phase,
    adventureMode: state.adventureMode,
    rulesetVersion: state.rulesetVersion,
    participants: state.participants,
    battle,
    world,
    messages: state.messages,
    events: state.events,
    ending: state.ending,
    ...(pending
      ? {
          pending: {
            id: pending.id,
            label: pending.label,
            actionKind: pending.plan.kind,
            stage: pending.preview
              ? ('rolled' as const)
              : ('unrolled' as const),
            rolls: pending.preview?.rolls || [],
            dice: pending.tape,
            canInspire: Boolean(
              hero?.inspiration &&
                !pending.usedRerolls.includes('inspiration') &&
                pending.preview &&
                pending.tape.some((die) => die.actorId === pending.actorId),
            ),
            canLucky: Boolean(
              hero?.features.includes('lucky') &&
                pending.tape.some(
                  (d) =>
                    d.actorId === pending.actorId &&
                    d.sides === 20 &&
                    d.value === 1 &&
                    !pending.luckyGroups.includes(d.groupId),
                ),
            ),
          },
        }
      : {}),
    scene: {
      id: world.sceneId,
      ...scene,
      fallback: `/scenes/${world.sceneId}${world.sceneId === 'beacon' && world.flags.beaconLit ? '-lit' : ''}.svg`,
      connections:
        world.sceneId === 'road' && world.flags.reedPath
          ? [...scene.connections, 'beacon']
          : scene.connections,
    },
  };
}
