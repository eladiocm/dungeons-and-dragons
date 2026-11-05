import { damageActor, hasCondition } from './battle-effects.ts';
import { SKILLS } from './catalog.ts';
import type { BattleResolution } from './combat-types.ts';
import { resolveD20, rollDice } from './dice.ts';
import type {
  ActionPlan,
  ActionResult,
  GameSession,
  WorldOperation,
} from './session-types.ts';
import { fact, getHero, giveItem, isPresent } from './session-utils.ts';
import { type Roller, RuleError, type SkillId } from './types.ts';

export function actionDice(
  result: ActionResult,
  actorId: string,
  label: string,
  count: number,
  sides: number,
  roller: Roller,
): number {
  const scoped = roller.scope?.(label, actorId) || roller;
  const dice = rollDice(count, sides, scoped);
  result.rolls.push({
    actorId,
    label,
    sides,
    values: dice.values,
    groupId: scoped.groupId,
  });
  return dice.total;
}
export function skillCheck(
  result: ActionResult,
  actorId: string,
  skill: SkillId,
  dc: number,
  roller: Roller,
  advantage = false,
): boolean {
  const hero = getHero(result.state, actorId);
  if (
    !Object.hasOwn(SKILLS, skill) ||
    !Number.isInteger(dc) ||
    dc < 5 ||
    dc > 30
  )
    throw new RuleError('Prueba de habilidad no válida.');
  const guide = hero.conditions.find(
    (c) => c.id === 'guidance' && c.data?.skill === skill,
  );
  const bonus =
    hero.skills[skill] +
    (guide ? actionDice(result, actorId, 'Guía', 1, 4, roller) : 0);
  const label = `${SKILLS[skill].name}: ${hero.name}`,
    scoped = roller.scope?.(label, actorId) || roller;
  const roll = resolveD20(
    {
      kind: 'check',
      bonus,
      dc,
      advantage:
        advantage ||
        hero.conditions.some(
          (c) => c.data?.skill === skill && c.data?.advantage === true,
        ),
      disadvantage: hero.conditions.some(
        (c) => c.id === 'poisoned' || c.id === 'frightened',
      ),
    },
    scoped,
  );
  result.rolls.push({
    actorId,
    label,
    sides: 20,
    values: roll.dice,
    groupId: scoped.groupId,
  });
  result.facts.push(
    `${SKILLS[skill].name}: ${roll.total} frente a CD ${dc}; ${roll.success ? 'éxito' : 'fallo'}.`,
  );
  return roll.success;
}
function visibleObject(state: GameSession, id: string) {
  const object = state.world.objects[id];
  if (!object || !isPresent(state, id))
    throw new RuleError('Ese objeto no está en la escena.');
  return object;
}
function takeLens(result: ActionResult, actorId: string): void {
  const object = visibleObject(result.state, 'lens');
  if (object.state === 'taken')
    throw new RuleError('La lente ya fue recogida.');
  giveItem(getHero(result.state, actorId), 'amber-lens');
  object.state = 'taken';
  object.locked = false;
  delete result.state.battle.objects.lens;
  result.state.world.sceneRevision++;
  result.facts.push(
    'Recoges la lente de ámbar. El cristal cabe en el alojamiento del faro.',
  );
  fact(result.state, 'La lente de ámbar ha sido recuperada.');
}
function activateBeacon(result: ActionResult, actorId: string): void {
  visibleObject(result.state, 'beacon-mechanism');
  const lens = getHero(result.state, actorId).inventory.find(
    (i) => i.catalogId === 'amber-lens' && i.quantity > 0,
  );
  if (!lens)
    throw new RuleError('Necesitas la lente de ámbar para reactivar el faro.');
  lens.quantity--;
  result.state.world.objects['beacon-mechanism'].state = 'active';
  result.state.world.flags.beaconLit = true;
  result.state.world.sceneRevision++;
  result.facts.push(
    'Instalas la lente y giras la manivela. La luz del faro atraviesa la niebla.',
  );
}
export function validateOperation(
  state: GameSession,
  actorId: string,
  op: WorldOperation,
): void {
  if (!op || typeof op !== 'object')
    throw new RuleError('Consecuencia inválida.');
  switch (op.type) {
    case 'fact':
      if (
        typeof op.text !== 'string' ||
        !op.text.trim() ||
        op.text.length > 400
      )
        throw new RuleError('Hecho inválido.');
      break;
    case 'access': {
      const window =
        op.from === 'mill' &&
        op.to === 'chamber' &&
        op.via === 'window' &&
        state.world.sceneId === 'mill';
      const path =
        op.from === 'road' &&
        op.to === 'beacon' &&
        op.via === 'path' &&
        state.world.sceneId === 'road';
      if (!window && !path)
        throw new RuleError(
          'Ese acceso no es plausible dentro de la zona preparada.',
        );
      if (
        window &&
        !getHero(state, actorId).inventory.some(
          (i) => i.catalogId === 'rope' && i.quantity > 0,
        )
      )
        throw new RuleError('Necesitas una cuerda para ese acceso.');
      break;
    }
    case 'disposition':
      if (
        !isPresent(state, op.targetId) ||
        !Object.hasOwn(state.world.npcDisposition, op.targetId) ||
        state.battle.actors[op.targetId]?.dead ||
        !['friendly', 'neutral', 'hostile'].includes(op.value)
      )
        throw new RuleError('No puedes cambiar esa relación.');
      break;
    case 'object': {
      const object = visibleObject(state, op.targetId);
      if (
        !['open', 'broken', 'lit', 'active'].includes(op.state) ||
        object.state === 'taken' ||
        (op.state === 'active' && op.targetId !== 'beacon-mechanism')
      )
        throw new RuleError('Ese cambio de objeto no es válido.');
      if (
        op.state === 'active' &&
        !getHero(state, actorId).inventory.some(
          (i) => i.catalogId === 'amber-lens' && i.quantity > 0,
        )
      )
        throw new RuleError('No puedes encender el faro sin la lente.');
      break;
    }
    case 'loot': {
      const object = visibleObject(state, op.targetId);
      if (!object.loot || object.state === 'taken' || object.locked)
        throw new RuleError('No hay botín accesible en ese objeto.');
      break;
    }
    default:
      throw new RuleError('Consecuencia fuera del catálogo.');
  }
}
export function applyOperation(
  result: ActionResult,
  actorId: string,
  op: WorldOperation,
): void {
  const state = result.state;
  validateOperation(state, actorId, op);
  switch (op.type) {
    case 'fact':
      fact(state, op.text);
      result.facts.push(op.text);
      break;
    case 'access':
      state.world.flags[op.via === 'window' ? 'windowAccess' : 'reedPath'] =
        true;
      fact(
        state,
        op.via === 'window'
          ? 'El acceso por la ventana del molino está preparado.'
          : 'El sendero de juncos permite llegar al faro.',
      );
      result.facts.push('Tu solución crea un acceso que permanece disponible.');
      break;
    case 'disposition':
      state.world.npcDisposition[op.targetId] = op.value;
      if (op.targetId === 'bram' && op.value === 'friendly') {
        state.world.flags.guardFriendly = true;
        state.world.objects['cellar-door'].locked = false;
      }
      result.facts.push(
        `${state.battle.actors[op.targetId].name} pasa a estar ${op.value === 'friendly' ? 'dispuesto a ayudarte' : op.value === 'hostile' ? 'hostil' : 'neutral'}.`,
      );
      break;
    case 'object':
      if (op.state === 'active') activateBeacon(result, actorId);
      else {
        state.world.objects[op.targetId].state = op.state;
        if (op.targetId === 'lens' && op.state === 'broken')
          state.world.flags.lensDestroyed = true;
        if (op.targetId === 'release-lever') {
          state.world.flags.leverReleased = true;
          state.world.objects.lens.locked = false;
        }
        if (op.targetId === 'cellar-door' && op.state === 'broken') {
          state.world.flags.doorForced = true;
          state.world.objects[op.targetId].locked = false;
        }
        result.facts.push(
          `${state.world.objects[op.targetId].name}: ${op.state}.`,
        );
      }
      break;
    case 'loot':
      if (op.targetId === 'lens') takeLens(result, actorId);
      else {
        const object = state.world.objects[op.targetId];
        if (!object.loot) throw new RuleError('No hay botín.');
        giveItem(getHero(state, actorId), object.loot);
        object.state = 'taken';
      }
      break;
  }
}
export function interact(
  result: ActionResult,
  actorId: string,
  plan: Extract<ActionPlan, { kind: 'interact' }>,
  roller: Roller,
): void {
  const state = result.state,
    hero = getHero(state, actorId),
    targetId = plan.targetId;
  if (!isPresent(state, targetId))
    throw new RuleError('Ese personaje u objeto no está aquí.');
  const npc = state.battle.actors[targetId];
  if (npc?.dead && plan.method !== 'take')
    throw new RuleError('Ese personaje ha muerto.');
  if (plan.method === 'inspect') {
    const object = state.world.objects[targetId];
    result.facts.push(
      object?.description ||
        (targetId === 'bram'
          ? 'Bram protege la puerta por miedo. No parece buscar una pelea; lleva una llave al cinturón.'
          : targetId === 'sira'
            ? 'Sira está consciente bajo una viga. La palanca de liberación y una cuña podrían ayudar.'
            : 'Mara conoce el camino del molino y prepara la evacuación.'),
    );
    if (targetId === 'release-lever' || targetId === 'lens')
      fact(
        state,
        'La palanca libera las pinzas de la lente antes de retirarla.',
      );
    return;
  }
  if (plan.method === 'talk') {
    if (targetId === 'mara')
      result.facts.push(
        'Mara explica que la lente está en el viejo molino y que la niebla alcanzará el pueblo dentro del tiempo indicado. Te pide ayudar a Sira y devolver la luz al faro.',
      );
    else if (targetId === 'bram')
      result.facts.push(
        'Bram teme que el mecanismo lastime a alguien. Puedes explicarle tus intenciones, ofrecer ayuda, buscar la ventana o enfrentarlo.',
      );
    else if (targetId === 'sira') {
      result.facts.push(
        'Sira señala la palanca: «Abre primero las pinzas; después lleva la lente al faro. Yo intenté repararlo y quedé atrapada».',
      );
      fact(
        state,
        'La palanca libera las pinzas de la lente antes de retirarla.',
      );
    } else throw new RuleError('Ese objeto no responde.');
    return;
  }
  if (targetId === 'bram' && plan.method === 'persuade') {
    if (state.world.flags.guardFriendly) {
      result.facts.push('Bram ya te ha dado paso.');
      return;
    }
    if (state.world.flags.negotiated && !state.world.flags.bramHelped)
      throw new RuleError(
        'Ya explicó su respuesta. Cambia lo que le ofreces o busca otro acceso.',
      );
    const success = skillCheck(result, actorId, 'persuasion', 12, roller);
    state.world.flags.negotiated = true;
    if (success) {
      applyOperation(result, actorId, {
        type: 'disposition',
        targetId: 'bram',
        value: 'friendly',
      });
      result.facts.push(
        'Bram abre la puerta de la cámara y te entrega el paso.',
      );
    } else {
      result.facts.push(
        'Bram mantiene su negativa, pero su mirada revela una ventana lateral por la que podrías entrar.',
      );
      fact(
        state,
        'Hay una ventana lateral para entrar en la cámara sin la llave.',
      );
    }
    return;
  }
  if (
    targetId === 'bram' &&
    plan.method === 'take' &&
    npc &&
    (npc.dead || hasCondition(npc, 'unconscious'))
  ) {
    if (state.world.flags.doorKey)
      throw new RuleError('Ya recogiste la llave.');
    giveItem(hero, 'cellar-key');
    state.world.objects['cellar-door'].locked = false;
    state.world.flags.doorKey = true;
    result.facts.push('Recoges la llave de la cámara.');
    return;
  }
  if (targetId === 'mill-window' && plan.method === 'sneak') {
    if (skillCheck(result, actorId, 'stealth', 12, roller)) {
      state.world.flags.windowAccess = true;
      result.facts.push(
        'Te deslizas por el acceso lateral sin alertar a Bram.',
      );
    } else {
      state.world.npcDisposition.bram = 'hostile';
      result.facts.push(
        'El marco cruje. Bram te descubre, pero aún puedes hablar, retirarte o defenderte.',
      );
    }
    return;
  }
  if (targetId === 'cellar-door' && plan.method === 'force') {
    const advantage = hero.inventory.some(
      (i) => i.catalogId === 'crowbar' && i.quantity > 0,
    );
    if (skillCheck(result, actorId, 'athletics', 13, roller, advantage)) {
      state.world.flags.doorForced = true;
      state.world.objects[targetId].locked = false;
      state.world.objects[targetId].state = 'broken';
      result.facts.push(
        'La puerta cede bajo la palanca y queda un acceso a la cámara.',
      );
    } else
      result.facts.push(
        'La puerta resiste; la ventana lateral sigue siendo otra opción.',
      );
    if (!state.battle.actors.bram.dead)
      state.world.npcDisposition.bram = 'hostile';
    return;
  }
  if (targetId === 'release-lever' && plan.method === 'use') {
    state.world.flags.leverReleased = true;
    state.world.objects.lens.locked = false;
    state.world.objects[targetId].state = 'open';
    result.facts.push(
      'Bajas la palanca. Las pinzas se abren y la lente puede retirarse sin riesgo.',
    );
    return;
  }
  if (targetId === 'lens' && plan.method === 'take') {
    if (
      !state.world.flags.leverReleased &&
      !skillCheck(result, actorId, 'sleightOfHand', 12, roller)
    ) {
      const damage = actionDice(
        result,
        actorId,
        'Pinzas del mecanismo',
        1,
        4,
        roller,
      );
      const hit: BattleResolution = {
        state: state.battle,
        facts: [],
        rolls: [],
      };
      damageActor(hit, actorId, damage, 'bludgeoning', roller);
      state.battle = hit.state;
      result.facts.push(...hit.facts);
      result.rolls.push(...hit.rolls);
      result.facts.push(
        'El mecanismo te golpea, pero consigues liberar la lente.',
      );
    }
    takeLens(result, actorId);
    return;
  }
  if (targetId === 'sira' && plan.method === 'rescue') {
    if (state.world.flags.siraRescued) {
      result.facts.push('Sira ya está a salvo.');
      return;
    }
    state.world.flags.siraRescued = true;
    state.world.npcLocations.sira = 'square';
    state.world.sceneRevision++;
    if (!hero.inspiration) {
      hero.inspiration = true;
      result.facts.push('Rescatar a Sira te concede inspiración heroica.');
    }
    result.facts.push(
      'Aseguras la viga con una cuña del mecanismo y ayudas a Sira a salir. Puede volver al refugio.',
    );
    fact(state, 'Sira ha sido rescatada y conoce un camino seguro al refugio.');
    return;
  }
  if (targetId === 'beacon-mechanism' && plan.method === 'use') {
    activateBeacon(result, actorId);
    return;
  }
  throw new RuleError(
    'Esa interacción necesita otra acción o una explicación más concreta.',
  );
}
export function creative(
  result: ActionResult,
  actorId: string,
  plan: Extract<ActionPlan, { kind: 'creative' }>,
  roller: Roller,
): void {
  if (
    typeof plan.description !== 'string' ||
    !plan.description.trim() ||
    plan.description.length > 700 ||
    !Array.isArray(plan.onSuccess) ||
    !Array.isArray(plan.onFailure) ||
    plan.onSuccess.length > 3 ||
    plan.onFailure.length > 3
  )
    throw new RuleError('Acción creativa inválida.');
  for (const op of [...plan.onSuccess, ...plan.onFailure])
    validateOperation(result.state, actorId, op);
  if (
    !plan.skill &&
    [...plan.onSuccess, ...plan.onFailure].some(
      (op) => op.type !== 'fact' && op.type !== 'object',
    )
  )
    throw new RuleError('Esta solución requiere primero una prueba apropiada.');
  const success = plan.skill
    ? skillCheck(result, actorId, plan.skill, plan.dc ?? 15, roller)
    : true;
  for (const op of success ? plan.onSuccess : plan.onFailure)
    applyOperation(result, actorId, op);
  if (!result.facts.length)
    result.facts.push(
      'Observas el resultado de tu acción y puedes elegir cómo continuar.',
    );
}
