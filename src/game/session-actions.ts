import { SCENES } from './adventure.ts';
import {
  actionDice,
  creative,
  interact,
  skillCheck,
} from './adventure-actions.ts';
import {
  assertActor,
  condition,
  distance,
  effectiveAc,
  hasCondition,
  isHero,
} from './battle-effects.ts';
import { ARMOR, SPELLS, WEAPONS } from './catalog.ts';
import { armorClass } from './character.ts';
import { attack, newBudget } from './combat.ts';
import { deathSave, heal, rest, secondWind } from './rules.ts';
import type { ActionPlan, ActionResult, GameSession } from './session-types.ts';
import {
  advanceTime,
  checkEnding,
  currentNpcIds,
  getHero,
  isPresent,
  setScene,
} from './session-utils.ts';
import { castSpell, spellEndTurn } from './spells.ts';
import { type Roller, RuleError } from './types.ts';

function appendBattle(
  result: ActionResult,
  out: ReturnType<typeof attack>,
): void {
  result.state.battle = out.state;
  result.facts.push(...out.facts);
  result.rolls.push(...out.rolls);
}
function endCombatIfNeeded(result: ActionResult): void {
  const state = result.state;
  if (!state.battle.inCombat) return;
  const enemies = state.battle.order.filter(
    (id) =>
      state.battle.teams[id] === 'hostile' &&
      state.battle.actors[id]?.hp.current > 0 &&
      !state.battle.actors[id].dead &&
      state.world.npcDisposition[id] === 'hostile',
  );
  if (enemies.length === 0) {
    state.battle.inCombat = false;
    state.phase = 'exploration';
    state.world.sceneRevision++;
    result.facts.push(
      'El enfrentamiento termina. Puedes decidir qué hacer con lo que queda en la escena.',
    );
  } else if (
    enemies.every((id) => id === 'bram') &&
    state.participants.every(
      (p) => state.battle.actors[p.characterId].hp.current === 0,
    ) &&
    state.participants.some((p) => !state.battle.actors[p.characterId].dead)
  ) {
    state.battle.inCombat = false;
    state.phase = 'exploration';
    state.world.npcDisposition.bram = 'neutral';
    state.world.sceneRevision++;
    result.facts.push(
      'Bram cesa el ataque al verte caer y vuelve a custodiar el molino. El enfrentamiento termina; todavía debes resolver tus salvaciones contra muerte y las consecuencias del tiempo transcurrido.',
    );
  }
}
function advanceEnemies(result: ActionResult, roller: Roller): void {
  const state = result.state;
  for (let n = 0; n < 20 && state.battle.inCombat; n++) {
    const id = state.battle.activeId,
      npc = state.battle.actors[id];
    if (!npc || isHero(npc)) break;
    const target = state.participants
      .map((p) => state.battle.actors[p.characterId])
      .find((a) => a.hp.current > 0 && !a.dead);
    if (
      target &&
      npc.hp.current > 0 &&
      !npc.dead &&
      !hasCondition(npc, 'incapacitated') &&
      !hasCondition(npc, 'unconscious') &&
      npc.attacks.length &&
      state.world.npcDisposition[id] === 'hostile'
    ) {
      const position = state.battle.positions[id],
        destination = state.battle.positions[target.id];
      const span = distance(position, destination),
        move = Math.min(
          Math.max(0, span - 1.5),
          state.battle.budgets[id].movement,
        );
      if (span > 1.5) {
        state.battle.positions[id] = {
          x: position.x + ((destination.x - position.x) / span) * move,
          y: position.y + ((destination.y - position.y) / span) * move,
        };
        state.battle.budgets[id].movement -= move;
      }
      if (
        distance(state.battle.positions[id], destination) <=
        npc.attacks[0].range
      )
        appendBattle(
          result,
          attack(
            state.battle,
            id,
            target.id,
            { weaponId: npc.attacks[0].id },
            roller,
          ),
        );
    }
    const ended = spellEndTurn(state.battle, id, roller);
    appendBattle(result, ended);
    state.world.time = state.battle.time;
    checkEnding(state);
    endCombatIfNeeded(result);
    if (state.status === 'ended') break;
  }
}
function beginCombat(
  result: ActionResult,
  actorId: string,
  targetId: string,
  roller: Roller,
): void {
  const state = result.state;
  if (state.battle.inCombat) return;
  const enemies = currentNpcIds(state).filter(
    (id) => id === targetId && !state.battle.actors[id].dead,
  );
  if (!enemies.length)
    throw new RuleError('No hay un adversario en la escena.');
  for (const id of enemies) state.world.npcDisposition[id] = 'hostile';
  state.battle.order = [
    ...state.participants.map((p) => p.characterId),
    ...enemies,
  ];
  const initiatives = new Map<string, number>();
  for (const id of state.battle.order) {
    const actor = state.battle.actors[id];
    initiatives.set(
      id,
      actionDice(result, id, `Iniciativa de ${actor.name}`, 1, 20, roller) +
        actor.initiative,
    );
    state.battle.budgets[id] = newBudget(actor);
    state.battle.teams[id] = isHero(actor) ? 'heroes' : 'hostile';
  }
  state.battle.order.sort(
    (a, b) =>
      (initiatives.get(b) || 0) - (initiatives.get(a) || 0) ||
      state.battle.actors[b].initiative - state.battle.actors[a].initiative ||
      a.localeCompare(b),
  );
  state.battle.activeId = state.battle.order[0];
  state.battle.inCombat = true;
  state.phase = 'combat';
  state.world.sceneRevision++;
  result.facts.push(
    'Comienza el combate. El orden de iniciativa decide cuándo actúa cada participante.',
  );
  advanceEnemies(result, roller);
  if (state.battle.activeId !== actorId && state.status === 'active')
    result.facts.push(
      `${state.battle.actors[state.battle.activeId].name} actúa primero; tu ataque declarado espera a que llegue tu turno.`,
    );
}
function attachCarriedObjects(
  state: GameSession,
  actorId: string,
  plan: Extract<ActionPlan, { kind: 'cast' }>,
) {
  const options = { ...plan.options },
    hero = getHero(state, actorId);
  let item = options.objectId
    ? hero.inventory.find(
        (i) => i.id === options.objectId || i.catalogId === options.objectId,
      )
    : undefined;
  if (item && plan.spellId === 'light' && item.quantity > 1) {
    item.quantity--;
    const single = {
      ...structuredClone(item),
      id: `${item.id}:single:${state.version}`,
      quantity: 1,
      conditions: [],
    };
    item.equipped = false;
    hero.inventory.push(single);
    item = single;
  }
  if (item) options.objectId = item.id;
  for (const p of state.participants)
    for (const carried of getHero(state, p.characterId).inventory) {
      if (carried.quantity > 0)
        state.battle.objects[carried.id] = {
          id: carried.id,
          name: carried.name,
          weight: carried.weight,
          position: { ...state.battle.positions[p.characterId] },
          conditions: structuredClone(carried.conditions || []),
        };
    }
  for (const object of Object.values(state.world.objects))
    if (state.battle.objects[object.id])
      state.battle.objects[object.id].locked = object.locked;
  return options;
}
function syncSpellObjects(
  result: ActionResult,
  actorId: string,
  takeByHand: boolean,
): void {
  const state = result.state;
  for (const object of Object.values(state.battle.objects)) {
    const source = state.world.objects[object.id];
    if (source) {
      source.position = { ...object.position };
      source.conditions = structuredClone(object.conditions);
    }
    if (source && object.open) source.state = 'open';
    if (
      takeByHand &&
      object.id === 'lens' &&
      source?.state !== 'taken' &&
      !source?.locked &&
      distance(object.position, state.battle.positions[actorId]) <= 1.5
    ) {
      giveLens(result, actorId);
    }
  }
  for (const p of state.participants)
    for (const item of getHero(state, p.characterId).inventory) {
      if (state.battle.objects[item.id])
        item.conditions = structuredClone(
          state.battle.objects[item.id].conditions,
        );
    }
}
function giveLens(result: ActionResult, actorId: string): void {
  interact(
    result,
    actorId,
    { kind: 'interact', targetId: 'lens', method: 'take' },
    () => {
      throw new RuleError('La lente todavía está bloqueada.');
    },
  );
}
function equip(
  result: ActionResult,
  actorId: string,
  itemId: string,
  equipped: boolean,
): void {
  const hero = getHero(result.state, actorId),
    budget = result.state.battle.budgets[actorId],
    item = hero.inventory.find(
      (i) => i.id === itemId || i.catalogId === itemId,
    );
  if (
    !item ||
    item.quantity <= 0 ||
    (!ARMOR[item.catalogId] &&
      !WEAPONS[item.catalogId] &&
      item.catalogId !== 'shield')
  )
    throw new RuleError('No puedes equipar ese objeto.');
  if (result.state.battle.inCombat) {
    if (ARMOR[item.catalogId])
      throw new RuleError(
        'Cambiar esta armadura requiere varios minutos fuera del combate.',
      );
    if (item.catalogId === 'shield') {
      if (!budget.action)
        throw new RuleError(
          'El escudo requiere una acción para ponerse o quitarse.',
        );
      budget.action = false;
    } else {
      if (!budget.objectInteraction)
        throw new RuleError('Ya usaste la interacción gratuita de este turno.');
      budget.objectInteraction = false;
    }
  }
  if (equipped && ARMOR[item.catalogId])
    for (const other of hero.inventory)
      if (ARMOR[other.catalogId]) other.equipped = false;
  if (equipped && WEAPONS[item.catalogId]) {
    const held = hero.inventory.filter(
      (i) => i.equipped && WEAPONS[i.catalogId] && i.id !== item.id,
    );
    if (
      WEAPONS[item.catalogId].twoHanded &&
      hero.inventory.some((i) => i.equipped && i.catalogId === 'shield')
    )
      throw new RuleError('Guarda el escudo para usar esta arma a dos manos.');
    if (held.length >= 2)
      throw new RuleError('No tienes manos para otra arma.');
  }
  item.equipped = equipped;
  hero.ac = armorClass(hero);
  const armor = hero.inventory.find((i) => i.equipped && ARMOR[i.catalogId]);
  hero.speed =
    armor && hero.abilities.str < (ARMOR[armor.catalogId].strength || 0)
      ? 6
      : 9;
  result.facts.push(`${equipped ? 'Equipas' : 'Guardas'} ${item.name}.`);
}
export function executePlan(
  input: GameSession,
  actorId: string,
  plan: ActionPlan,
  roller: Roller,
): ActionResult {
  const state = structuredClone(input);
  delete state.pending;
  const result: ActionResult = { state, facts: [], rolls: [] };
  const hero = getHero(state, actorId);
  if (plan.kind !== 'death') assertActor(state.battle, actorId);
  if (state.battle.inCombat && state.battle.activeId !== actorId)
    throw new RuleError('Espera el turno de tu personaje.');
  if (!state.battle.inCombat) state.battle.budgets[actorId] = newBudget(hero);
  const budget = state.battle.budgets[actorId];
  switch (plan.kind) {
    case 'travel': {
      const danger = currentNpcIds(state).some((id) => {
        const actor = state.battle.actors[id];
        return (
          !actor.dead &&
          actor.hp.current > 0 &&
          state.world.npcDisposition[id] === 'hostile' &&
          !hasCondition(actor, 'incapacitated') &&
          !hasCondition(actor, 'unconscious')
        );
      });
      const atExit =
        state.world.sceneId === 'mill' &&
        plan.destination === 'road' &&
        state.battle.positions[actorId].x <= -6 &&
        currentNpcIds(state).every(
          (id) =>
            state.world.npcDisposition[id] !== 'hostile' ||
            state.battle.actors[id].dead ||
            distance(
              state.battle.positions[actorId],
              state.battle.positions[id],
            ) > 1.5,
        );
      if (state.battle.inCombat && danger && !atExit)
        throw new RuleError('Primero debes salir del enfrentamiento.');
      const from = state.world.sceneId;
      if (
        !Object.hasOwn(SCENES, plan.destination) ||
        (!SCENES[from].connections.includes(plan.destination) &&
          !(
            from === 'road' &&
            plan.destination === 'beacon' &&
            state.world.flags.reedPath
          ))
      )
        throw new RuleError('No hay un camino conocido hacia ese lugar.');
      if (
        from === 'mill' &&
        plan.destination === 'chamber' &&
        !state.world.flags.guardFriendly &&
        !state.world.flags.windowAccess &&
        !state.world.flags.doorForced &&
        !state.world.flags.doorKey
      )
        throw new RuleError(
          'La entrada está vigilada y cerrada. Puedes negociar, buscar la ventana o forzar la puerta.',
        );
      setScene(state, plan.destination);
      advanceTime(state, 100);
      result.facts.push(
        `Llegas a ${SCENES[plan.destination].title}. ${SCENES[plan.destination].description}`,
      );
      break;
    }
    case 'escape': {
      if (
        !state.battle.inCombat ||
        state.world.sceneId !== 'mill' ||
        plan.destination !== 'road'
      )
        throw new RuleError(
          'En esta escena puedes escapar del molino hacia el camino durante el enfrentamiento.',
        );
      const from = state.battle.positions[actorId],
        adjacent = currentNpcIds(state).filter(
          (id) =>
            state.world.npcDisposition[id] === 'hostile' &&
            !state.battle.actors[id].dead &&
            distance(from, state.battle.positions[id]) <= 1.5,
        ),
        exitX = Math.min(
          -6,
          from.x,
          ...adjacent.map((id) => state.battle.positions[id].x - 3),
        ),
        moved = executePlan(
          state,
          actorId,
          { kind: 'move', x: exitX, y: 0 },
          roller,
        );
      Object.assign(state, moved.state);
      result.facts.push(...moved.facts);
      result.rolls.push(...moved.rolls);
      if (
        state.battle.actors[actorId].hp.current === 0 ||
        state.status === 'ended'
      )
        break;
      const left = executePlan(
        state,
        actorId,
        { kind: 'travel', destination: 'road' },
        roller,
      );
      Object.assign(state, left.state);
      result.facts.push(
        ...left.facts,
        'Bram permanece en su puesto. Has salido del enfrentamiento.',
      );
      result.rolls.push(...left.rolls);
      break;
    }
    case 'interact':
      if (state.battle.inCombat && !budget.action)
        throw new RuleError('Esa interacción necesita tu acción.');
      if (['use', 'take', 'rescue', 'force', 'sneak'].includes(plan.method)) {
        const to =
          state.battle.positions[plan.targetId] ||
          state.battle.objects[plan.targetId]?.position;
        if (to) {
          const from = state.battle.positions[actorId],
            span = distance(from, to),
            move = Math.max(0, span - 1.5);
          if (
            move > budget.movement ||
            (move > 0 &&
              ['restrained', 'grappled'].some((id) => hasCondition(hero, id)))
          )
            throw new RuleError(
              'Acércate primero al objetivo de esa interacción.',
            );
          if (move > 0) {
            state.battle.positions[actorId] = {
              x: from.x + ((to.x - from.x) / span) * move,
              y: from.y + ((to.y - from.y) / span) * move,
            };
            budget.movement -= move;
            result.facts.push(
              `Te acercas ${move.toFixed(1)} m para interactuar.`,
            );
          }
        }
      }
      interact(result, actorId, plan, roller);
      if (state.battle.inCombat) budget.action = false;
      else
        advanceTime(
          state,
          ['persuade', 'sneak', 'force'].includes(plan.method)
            ? 10
            : plan.method === 'talk' || plan.method === 'inspect'
              ? 0
              : 1,
        );
      break;
    case 'creative':
      if (state.battle.inCombat && !budget.action)
        throw new RuleError('Tu acción ya está usada.');
      creative(result, actorId, plan, roller);
      if (state.battle.inCombat) budget.action = false;
      else advanceTime(state, plan.skill ? 10 : 0);
      break;
    case 'attack': {
      if (!isPresent(state, plan.targetId))
        throw new RuleError('Ese adversario no está en esta escena.');
      beginCombat(result, actorId, plan.targetId, roller);
      if (
        state.battle.actors[actorId].hp.current > 0 &&
        state.battle.activeId === actorId
      ) {
        const weapon = WEAPONS[plan.weaponId];
        if (weapon && !weapon.ranged && !plan.ranged) {
          const from = state.battle.positions[actorId],
            to = state.battle.positions[plan.targetId],
            span = distance(from, to);
          if (span > 1.5) {
            const move = span - 1.5;
            if (
              move > state.battle.budgets[actorId].movement ||
              hasCondition(state.battle.actors[actorId], 'restrained') ||
              hasCondition(state.battle.actors[actorId], 'grappled')
            )
              throw new RuleError(
                'No puedes acercarte lo suficiente para ese ataque.',
              );
            state.battle.positions[actorId] = {
              x: from.x + ((to.x - from.x) / span) * move,
              y: from.y + ((to.y - from.y) / span) * move,
            };
            state.battle.budgets[actorId].movement -= move;
            result.facts.push(
              `Te acercas ${move.toFixed(1)} m para hacer el ataque declarado.`,
            );
          }
        }
        appendBattle(
          result,
          attack(state.battle, actorId, plan.targetId, plan, roller),
        );
      }
      break;
    }
    case 'cast': {
      if (
        !Object.hasOwn(SPELLS, plan.spellId) ||
        !Array.isArray(plan.targetIds) ||
        plan.targetIds.some((id) => !isPresent(state, id))
      )
        throw new RuleError('Objetivos de conjuro inválidos.');
      if (plan.options?.objectId && !isPresent(state, plan.options.objectId))
        throw new RuleError('Ese objeto no está en la escena.');
      const damaging = [
        'sacredFlame',
        'rayOfFrost',
        'guidingBolt',
        'magicMissile',
        'thunderwave',
        'sleep',
      ].includes(plan.spellId);
      if (
        damaging &&
        !state.battle.inCombat &&
        plan.targetIds.some(
          (id) => !state.participants.some((p) => p.characterId === id),
        )
      )
        beginCombat(result, actorId, plan.targetIds[0], roller);
      if (
        state.battle.actors[actorId].hp.current <= 0 ||
        (state.battle.inCombat && state.battle.activeId !== actorId)
      )
        break;
      const options = attachCarriedObjects(state, actorId, plan);
      appendBattle(
        result,
        castSpell(
          state.battle,
          actorId,
          plan.spellId,
          plan.targetIds,
          options,
          roller,
        ),
      );
      syncSpellObjects(
        result,
        actorId,
        plan.spellId === 'mageHand' && options.objectId === 'lens',
      );
      if (SPELLS[plan.spellId].components.includes('V'))
        getHero(state, actorId).conditions = getHero(
          state,
          actorId,
        ).conditions.filter((c) => c.source !== 'hiding');
      if (
        plan.targetIds.includes('bram') &&
        ['cureWounds', 'healingWord'].includes(plan.spellId)
      ) {
        state.world.flags.bramHelped = true;
        state.world.npcDisposition.bram = 'friendly';
        state.world.flags.guardFriendly = true;
        state.world.objects['cellar-door'].locked = false;
        result.facts.push('Bram reconoce tu ayuda y permite que pases.');
      }
      if (!state.battle.inCombat)
        advanceTime(state, plan.options?.ritual ? 101 : 1);
      break;
    }
    case 'feature': {
      if (!budget.bonus) throw new RuleError('Ya usaste tu acción adicional.');
      if (plan.feature === 'secondWind') {
        const scoped = roller.scope?.('Tomar aliento', actorId) || roller;
        const values: number[] = [];
        state.battle.actors[actorId] = secondWind(hero, (sides) => {
          const v = scoped(sides);
          values.push(v);
          return v;
        });
        result.rolls.push({
          actorId,
          label: 'Tomar aliento',
          sides: 10,
          values,
          groupId: scoped.groupId,
        });
        result.facts.push(
          `Recuperas fuerzas; PG ${state.battle.actors[actorId].hp.current}/${hero.hp.max}.`,
        );
      } else if (plan.feature === 'stonecunning') {
        if (
          !hero.resources.stonecunning?.current ||
          state.world.sceneId === 'road'
        )
          throw new RuleError(
            'Necesitas estar sobre piedra y tener un uso de Afinidad con la piedra.',
          );
        hero.resources.stonecunning.current--;
        condition(hero, {
          id: 'tremorsense',
          source: 'stonecunning',
          expires: state.world.time + 100,
        });
        result.facts.push(
          'Durante diez minutos percibes vibraciones a través de la piedra hasta 18 m; no lees pensamientos ni atraviesas espacios sin contacto.',
        );
      } else throw new RuleError('Rasgo no disponible.');
      budget.bonus = false;
      if (!state.battle.inCombat) advanceTime(state, 1);
      break;
    }
    case 'item': {
      const item = hero.inventory.find(
          (i) => i.id === plan.itemId || i.catalogId === plan.itemId,
        ),
        targetId = plan.targetId || actorId,
        target = state.battle.actors[targetId];
      if (
        !item ||
        item.quantity <= 0 ||
        !target ||
        !isPresent(state, targetId) ||
        distance(
          state.battle.positions[actorId],
          state.battle.positions[targetId],
        ) > 1.5
      )
        throw new RuleError('No puedes usar ese objeto sobre ese objetivo.');
      if (item.catalogId === 'healing-potion') {
        if (!budget.bonus)
          throw new RuleError('La poción necesita tu acción adicional.');
        const healing =
          actionDice(result, actorId, 'Poción de curación', 2, 4, roller) + 2;
        item.quantity--;
        state.battle.actors[targetId] = heal(target, healing);
        budget.bonus = false;
        result.facts.push(
          `Usas una poción. ${target.name} tiene ${state.battle.actors[targetId].hp.current}/${target.hp.max} PG.`,
        );
      } else
        throw new RuleError(
          'Explica cómo quieres utilizar este objeto del inventario.',
        );
      if (!state.battle.inCombat) advanceTime(state, 1);
      break;
    }
    case 'equip':
      equip(result, actorId, plan.itemId, plan.equipped);
      break;
    case 'rest': {
      if (
        state.battle.inCombat ||
        (!['square', 'beacon'].includes(state.world.sceneId) &&
          !state.world.flags.guardFriendly)
      )
        throw new RuleError(
          'Necesitas encontrar un lugar seguro para descansar.',
        );
      if (
        plan.rest === 'long' &&
        state.world.time - state.world.lastLongRestAt < 9600
      )
        throw new RuleError(
          'Debes esperar 16 horas desde el último descanso largo antes de empezar otro.',
        );
      const hours =
        plan.rest === 'short' ? 1 : hero.features.includes('trance') ? 4 : 8;
      const values: { sides: number; value: number }[] = [],
        scoped = roller.scope?.('Dado de golpe', actorId) || roller;
      state.battle.actors[actorId] = rest(
        hero,
        {
          kind: plan.rest,
          hours,
          spendHitDie: plan.spendHitDie,
          arcaneRecovery: plan.arcaneRecovery,
        },
        (sides) => {
          const value = scoped(sides);
          values.push({ sides, value });
          return value;
        },
      );
      for (const die of values)
        result.rolls.push({
          actorId,
          label: 'Dado de golpe',
          sides: die.sides,
          values: [die.value],
          groupId: scoped.groupId,
        });
      advanceTime(state, hours * 600);
      if (plan.rest === 'long') state.world.lastLongRestAt = state.world.time;
      result.facts.push(
        `Completas un descanso ${plan.rest === 'short' ? 'corto' : 'largo'} de ${hours} horas. Los recursos se recuperan según tu clase.`,
      );
      break;
    }
    case 'move': {
      if (
        !Number.isFinite(plan.x) ||
        !Number.isFinite(plan.y) ||
        Math.abs(plan.x) > 30 ||
        Math.abs(plan.y) > 30
      )
        throw new RuleError('Posición fuera de la escena.');
      const from = state.battle.positions[actorId],
        to = { x: plan.x, y: plan.y },
        span = distance(from, to);
      if (
        ['restrained', 'grappled'].some((c) => hasCondition(hero, c)) ||
        span > budget.movement
      )
        throw new RuleError('No tienes movimiento suficiente para llegar ahí.');
      if (state.battle.inCombat && !hasCondition(hero, 'disengaging'))
        for (const id of currentNpcIds(state)) {
          const enemy = state.battle.actors[id];
          if (
            !isHero(enemy) &&
            enemy.hp.current > 0 &&
            !enemy.dead &&
            !['incapacitated', 'unconscious', 'paralyzed', 'stunned'].some(
              (c) => hasCondition(enemy, c),
            ) &&
            state.world.npcDisposition[id] === 'hostile' &&
            state.battle.budgets[id].reaction &&
            distance(from, state.battle.positions[id]) <= 1.5 &&
            distance(to, state.battle.positions[id]) > 1.5 &&
            enemy.attacks.length
          ) {
            const active = state.battle.activeId;
            const priorAction = state.battle.budgets[id].action;
            state.battle.activeId = id;
            state.battle.budgets[id].action = true;
            appendBattle(
              result,
              attack(
                state.battle,
                id,
                actorId,
                { weaponId: enemy.attacks[0].id },
                roller,
              ),
            );
            state.battle.budgets[id].reaction = false;
            state.battle.budgets[id].action = priorAction;
            state.battle.activeId = active;
            result.facts.push(`${enemy.name} hace un ataque de oportunidad.`);
          }
        }
      if (state.battle.actors[actorId].hp.current > 0) {
        state.battle.positions[actorId] = to;
        state.battle.budgets[actorId].movement -= span;
        state.battle.cover[actorId] =
          state.world.sceneId === 'mill' && to.x <= -3 ? 5 : 0;
        result.facts.push(
          `Te desplazas ${span.toFixed(1)} m${state.battle.cover[actorId] ? ' hasta la cobertura lateral' : ''}.`,
        );
      }
      break;
    }
    case 'maneuver': {
      if (plan.maneuver === 'stand') {
        if (!hasCondition(hero, 'prone') || budget.movement < hero.speed / 2)
          throw new RuleError('No puedes levantarte en este momento.');
        budget.movement -= hero.speed / 2;
        hero.conditions = hero.conditions.filter((c) => c.id !== 'prone');
        result.facts.push('Te levantas de nuevo.');
        break;
      }
      if (!budget.action) throw new RuleError('Ya usaste tu acción.');
      budget.action = false;
      if (plan.maneuver === 'dodge')
        condition(hero, {
          id: 'dodging',
          source: 'action',
          data: {
            endsActor: actorId,
            endsTurn: state.battle.turns[actorId] + 1,
            endsPhase: 'start',
          },
        });
      else if (plan.maneuver === 'disengage')
        condition(hero, {
          id: 'disengaging',
          source: 'action',
          data: {
            endsActor: actorId,
            endsTurn: state.battle.turns[actorId],
            endsPhase: 'end',
          },
        });
      else if (plan.maneuver === 'dash') budget.movement += hero.speed;
      else if (plan.maneuver === 'hide') {
        if (
          (state.battle.cover[actorId] || 0) < 5 &&
          !hasCondition(hero, 'heavilyObscured')
        )
          throw new RuleError(
            'Busca cobertura suficiente o un lugar fuera de la vista para esconderte.',
          );
        if (skillCheck(result, actorId, 'stealth', 15, roller))
          condition(hero, { id: 'invisible', source: 'hiding' });
      } else if (plan.maneuver === 'search' || plan.maneuver === 'study') {
        skillCheck(
          result,
          actorId,
          plan.maneuver === 'search' ? 'perception' : 'investigation',
          12,
          roller,
        );
        result.facts.push(SCENES[state.world.sceneId].description);
      } else if (plan.maneuver === 'help') {
        if (
          !plan.targetId ||
          !isPresent(state, plan.targetId) ||
          distance(
            state.battle.positions[actorId],
            state.battle.positions[plan.targetId],
          ) > 1.5
        )
          throw new RuleError(
            'Acércate al objetivo al que vas a distraer para ayudar.',
          );
        condition(state.battle.actors[plan.targetId], {
          id: 'helpedAgainst',
          source: 'action',
          data: {
            team: 'heroes',
            helperId: actorId,
            endsActor: actorId,
            endsTurn: state.battle.turns[actorId] + 1,
            endsPhase: 'start',
          },
        });
      } else throw new RuleError('Acción de combate no disponible.');
      result.facts.push(`Realizas la acción ${plan.maneuver}.`);
      if (!state.battle.inCombat) advanceTime(state, 1);
      break;
    }
    case 'endTurn': {
      if (!state.battle.inCombat) throw new RuleError('Ahora no hay combate.');
      appendBattle(result, spellEndTurn(state.battle, actorId, roller));
      state.world.time = state.battle.time;
      advanceEnemies(result, roller);
      break;
    }
    case 'death': {
      if (hero.dead || hero.hp.current !== 0)
        throw new RuleError('No corresponde una salvación contra muerte.');
      if (hero.deathSaves.stable) {
        if (state.battle.inCombat) {
          endCombatIfNeeded(result);
          if (state.battle.inCombat)
            throw new RuleError(
              'El combate sigue en curso. La recuperación de horas debe esperar al final del encuentro o a que alguien te cure.',
            );
        }
        const hours = actionDice(
          result,
          actorId,
          'Recuperación tras estabilizarte',
          1,
          4,
          roller,
        );
        state.battle.actors[actorId] = heal(hero, 1);
        advanceTime(state, hours * 600);
        result.facts.push(
          `Recuperas la consciencia tras ${hours} horas, con 1 PG.`,
        );
      } else {
        const die = actionDice(
          result,
          actorId,
          'Salvación contra muerte',
          1,
          20,
          roller,
        );
        state.battle.actors[actorId] = deathSave(hero, die);
        result.facts.push(
          die === 20
            ? 'Recuperas 1 PG y puedes actuar.'
            : `Salvación contra muerte: ${die}; ${state.battle.actors[actorId].deathSaves.successes} éxitos y ${state.battle.actors[actorId].deathSaves.failures} fallos.`,
        );
        if (
          state.battle.inCombat &&
          die !== 20 &&
          !state.battle.actors[actorId].dead
        ) {
          appendBattle(result, spellEndTurn(state.battle, actorId, roller));
          advanceEnemies(result, roller);
        } else if (!state.battle.inCombat) advanceTime(state, 1);
      }
      break;
    }
    case 'retreat':
      state.ending = {
        kind: 'retreat',
        title: 'Un camino sin terminar',
        epilogue:
          'Decides abandonar esta aventura. El diario conserva el lugar y el estado de tu personaje; el faro queda sin reactivar. La partida termina por retirada.',
      };
      state.status = 'ended';
      state.battle.inCombat = false;
      result.facts.push(state.ending.epilogue);
      break;
    default:
      throw new RuleError('Acción fuera del catálogo.');
  }
  endCombatIfNeeded(result);
  checkEnding(state);
  if (state.status === 'active')
    state.phase = state.battle.inCombat ? 'combat' : 'exploration';
  for (const actor of Object.values(state.battle.actors))
    if (isHero(actor)) actor.ac = effectiveAc(actor);
  return result;
}
