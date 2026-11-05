import {
  assertActor,
  condition,
  damageActor,
  distance,
  dodging,
  effectiveAc,
  hasCondition,
  isHero,
  recorded,
  savingThrow,
} from './battle-effects.ts';
import { WEAPONS } from './catalog.ts';
import { modifier, weaponProficient } from './character.ts';
import type {
  ActionBudget,
  AttackOptions,
  BattleResolution,
  BattleState,
} from './combat-types.ts';
import { type D20Input, resolveD20, rollDice } from './dice.ts';
import { type Combatant, type Roller, RuleError } from './types.ts';

export function newBudget(actor: Combatant): ActionBudget {
  return {
    action: true,
    bonus: true,
    reaction: true,
    movement: Math.max(
      0,
      actor.speed -
        (hasCondition(actor, 'slow') || hasCondition(actor, 'rayOfFrost')
          ? 3
          : 0),
    ),
    objectInteraction: true,
    spellSlotSpent: false,
    sneakAttackUsed: false,
    savageAttackerUsed: false,
    lightAttackUsed: false,
  };
}
export function createBattle(
  actors: Combatant[],
  activeId: string,
): BattleState {
  if (
    actors.length < 1 ||
    new Set(actors.map((a) => a.id)).size !== actors.length ||
    !actors.some((a) => a.id === activeId)
  )
    throw new RuleError('Participantes de combate no válidos.');
  return {
    actors: Object.fromEntries(actors.map((a) => [a.id, structuredClone(a)])),
    activeId,
    order: actors.map((a) => a.id),
    positions: Object.fromEntries(
      actors.map((a, i) => [a.id, { x: i * 1.5, y: 0 }]),
    ),
    cover: {},
    teams: Object.fromEntries(
      actors.map((a, i) => [a.id, i === 0 ? 'heroes' : 'hostile']),
    ),
    round: 1,
    time: 0,
    inCombat: true,
    budgets: Object.fromEntries(actors.map((a) => [a.id, newBudget(a)])),
    turns: Object.fromEntries(actors.map((a) => [a.id, 0])),
    objects: {},
  };
}
function attackDetails(
  state: BattleState,
  actorId: string,
  targetId: string,
  options: AttackOptions,
) {
  const actor = assertActor(state, actorId),
    target = state.actors[targetId],
    budget = state.budgets[actorId];
  if (state.inCombat && state.activeId !== actorId)
    throw new RuleError('No es el turno de esa criatura.');
  if (
    !target ||
    target.dead ||
    actorId === targetId ||
    !state.positions[actorId] ||
    !state.positions[targetId] ||
    state.cover[targetId] === 100
  )
    throw new RuleError('No hay un objetivo alcanzable en esa dirección.');
  const span = distance(state.positions[actorId], state.positions[targetId]);
  if (!isHero(actor)) {
    const profile = actor.attacks.find((a) => a.id === options.weaponId);
    if (!profile || span > profile.range || !budget.action)
      throw new RuleError('Ataque de criatura no disponible.');
    return {
      actor,
      target,
      budget,
      span,
      weapon: undefined,
      profile,
      ability: 0,
      bonus: profile.bonus,
      ranged: profile.range > 1.5,
      nick: false,
    };
  }
  const weapon = WEAPONS[options.weaponId];
  if (
    !weapon ||
    !actor.inventory.some(
      (i) => i.catalogId === options.weaponId && i.quantity > 0,
    )
  )
    throw new RuleError('No llevas esa arma.');
  const ranged = weapon.ranged || Boolean(options.ranged);
  if (ranged && !weapon.ranged && !weapon.thrown)
    throw new RuleError('Esa arma no es arrojadiza.');
  const range = ranged ? weapon.range?.[1] || 1.5 : 1.5;
  if (span > range)
    throw new RuleError('El objetivo está fuera del alcance de esa arma.');
  if (
    weapon.ranged &&
    !actor.inventory.some((i) => i.catalogId === 'arrows20' && i.quantity > 0)
  )
    throw new RuleError('No quedan flechas.');
  const shield = actor.inventory.some(
    (i) => i.catalogId === 'shield' && i.equipped,
  );
  if (shield && (weapon.twoHanded || options.twoHanded || options.offhand))
    throw new RuleError('Necesitas una mano libre: guarda el escudo antes.');
  const previous = budget.lastWeapon ? WEAPONS[budget.lastWeapon] : undefined;
  const nick = Boolean(
    options.offhand &&
      options.useMastery &&
      weapon.mastery === 'nick' &&
      actor.weaponMasteries.includes(options.weaponId),
  );
  if (options.offhand) {
    const distinct =
      options.weaponId !== budget.lastWeapon ||
      actor.inventory.some(
        (i) => i.catalogId === options.weaponId && i.quantity >= 2,
      );
    if (
      !weapon.light ||
      !previous?.light ||
      !distinct ||
      budget.lightAttackUsed ||
      (!nick && !budget.bonus)
    )
      throw new RuleError(
        'El ataque con arma ligera adicional no está disponible.',
      );
  } else if (!budget.action) throw new RuleError('Ya has usado tu acción.');
  const ability = modifier(
    actor.abilities[
      weapon.finesse
        ? actor.abilities.dex >= actor.abilities.str
          ? 'dex'
          : 'str'
        : weapon.ranged
          ? 'dex'
          : 'str'
    ],
  );
  const bonus =
    ability +
    (weaponProficient(actor, options.weaponId) ? 2 : 0) +
    (weapon.ranged &&
    actor.classId === 'fighter' &&
    actor.fightingStyle === 'archery'
      ? 2
      : 0);
  return {
    actor,
    target,
    budget,
    span,
    weapon,
    profile: undefined,
    ability,
    bonus,
    ranged,
    nick,
  };
}
export function attackTest(
  state: BattleState,
  actorId: string,
  targetId: string,
  options: AttackOptions,
): D20Input {
  const { actor, target, span, weapon, bonus, ranged } = attackDetails(
    state,
    actorId,
    targetId,
    options,
  );
  const shortRange = ranged && weapon?.range && span > weapon.range[0];
  const hostileNearby =
    ranged &&
    Object.values(state.actors).some(
      (other) =>
        other.id !== actorId &&
        other.hp.current > 0 &&
        !other.dead &&
        state.teams[other.id] !== state.teams[actorId] &&
        distance(state.positions[actorId], state.positions[other.id]) <= 1.5 &&
        !['incapacitated', 'unconscious'].some((id) => hasCondition(other, id)),
    );
  const advantage =
    hasCondition(actor, 'invisible') ||
    target.conditions.some(
      (c) =>
        c.id === 'helpedAgainst' &&
        c.data?.team === state.teams[actorId] &&
        c.data?.helperId !== actorId,
    ) ||
    target.conditions.some(
      (c) => c.id === 'vex' && c.data?.attackerId === actorId,
    ) ||
    hasCondition(target, 'guidingBolt') ||
    (hasCondition(target, 'prone') && span <= 1.5) ||
    ['unconscious', 'paralyzed', 'restrained', 'stunned'].some((c) =>
      hasCondition(target, c),
    );
  const heavy =
    weapon?.heavy &&
    isHero(actor) &&
    actor.abilities[ranged ? 'dex' : 'str'] < 13;
  const disadvantage =
    Boolean(shortRange || hostileNearby || heavy) ||
    ['sap', 'poisoned', 'prone', 'restrained', 'blinded', 'frightened'].some(
      (c) => hasCondition(actor, c),
    ) ||
    hasCondition(target, 'invisible') ||
    (dodging(target) &&
      !hasCondition(target, 'blinded') &&
      !hasCondition(actor, 'invisible')) ||
    (hasCondition(target, 'prone') && span > 1.5);
  return {
    kind: 'attack',
    bonus,
    dc: effectiveAc(target) + (state.cover[targetId] || 0),
    advantage,
    disadvantage,
  };
}
export function attack(
  input: BattleState,
  actorId: string,
  targetId: string,
  options: AttackOptions,
  roller: Roller,
): BattleResolution {
  const expected = attackTest(input, actorId, targetId, options);
  const output: BattleResolution = {
    state: structuredClone(input),
    rolls: [],
    facts: [],
  };
  const state = output.state;
  const { actor, target, budget, weapon, profile, ability, nick, span } =
    attackDetails(state, actorId, targetId, options);
  let attackInput = expected;
  if (hasCondition(actor, 'bless'))
    attackInput = {
      ...expected,
      bonus:
        expected.bonus +
        rollDice(1, 4, recorded(output, 'Bendición', roller)).total,
    };
  const test =
    options.attackRoll ||
    resolveD20(
      attackInput,
      recorded(output, `Ataque de ${actor.name}`, roller),
    );
  if (
    test.kind !== 'attack' ||
    test.bonus !== attackInput.bonus ||
    test.dc !== attackInput.dc
  )
    throw new RuleError('La tirada pendiente no corresponde al ataque.');
  output.attack = test;
  if (options.offhand) {
    budget.lightAttackUsed = true;
    if (!nick) budget.bonus = false;
  } else budget.action = false;
  if (isHero(actor) && weapon) {
    budget.lastWeapon = options.weaponId;
    if (weapon.ranged) {
      const ammo = actor.inventory.find((i) => i.catalogId === 'arrows20');
      if (ammo) ammo.quantity--;
    } else if (options.ranged && weapon.thrown) {
      const item = actor.inventory.find(
        (i) => i.catalogId === options.weaponId,
      );
      if (item) {
        item.quantity--;
        if (!item.quantity) item.equipped = false;
      }
    }
    const item = actor.inventory.find(
      (i) => i.catalogId === options.weaponId && i.quantity > 0,
    );
    if (item && !item.equipped) {
      const equipped = actor.inventory.filter(
        (i) => i.equipped && WEAPONS[i.catalogId],
      );
      if (!options.offhand && equipped.length) {
        for (const held of equipped) held.equipped = false;
        budget.objectInteraction = false;
      }
      item.equipped = true;
    }
  }
  actor.conditions = actor.conditions.filter(
    (c) => c.id !== 'sap' && c.source !== 'hiding',
  );
  target.conditions = target.conditions.filter(
    (c) =>
      c.id !== 'guidingBolt' &&
      !(
        c.id === 'helpedAgainst' &&
        c.data?.team === state.teams[actorId] &&
        c.data?.helperId !== actorId
      ) &&
      !(c.id === 'vex' && c.data?.attackerId === actorId),
  );
  const mastery =
    isHero(actor) &&
    options.useMastery &&
    actor.weaponMasteries.includes(options.weaponId)
      ? weapon?.mastery
      : undefined;
  if (!test.success) {
    output.facts.push(
      `${actor.name} falla el ataque (${test.total} contra CA ${test.dc}).`,
    );
    if (mastery === 'graze')
      damageActor(
        output,
        targetId,
        Math.max(0, ability),
        weapon?.type || 'slashing',
        roller,
      );
    return output;
  }
  const critical =
    test.critical ||
    (span <= 1.5 &&
      ['unconscious', 'paralyzed'].some((id) => hasCondition(target, id)));
  const dice = weapon
    ? [
        weapon.dice[0],
        options.twoHanded && weapon.versatile
          ? weapon.versatile
          : weapon.dice[1],
      ]
    : profile?.dice;
  if (!dice) throw new RuleError('Faltan los dados del ataque.');
  const greatWeapon =
    isHero(actor) &&
    actor.classId === 'fighter' &&
    actor.fightingStyle === 'greatWeapon' &&
    (weapon?.twoHanded || options.twoHanded);
  const count = dice[0] * (critical ? 2 : 1);
  let damage = rollDice(
    count,
    dice[1],
    recorded(output, `Daño de ${actor.name}`, roller),
    greatWeapon ? 3 : 1,
  ).total;
  if (
    isHero(actor) &&
    actor.features.includes('savageAttacker') &&
    options.savageAttacker &&
    !budget.savageAttackerUsed
  ) {
    damage = Math.max(
      damage,
      rollDice(
        count,
        dice[1],
        recorded(output, 'Atacante salvaje', roller),
        greatWeapon ? 3 : 1,
      ).total,
    );
    budget.savageAttackerUsed = true;
  }
  const addModifier =
    !options.offhand ||
    (isHero(actor) &&
      actor.classId === 'fighter' &&
      actor.fightingStyle === 'twoWeapon');
  damage += profile
    ? profile.modifier
    : addModifier || ability < 0
      ? ability
      : 0;
  const nearbyAlly = Object.values(state.actors).some(
    (other) =>
      other.id !== actorId &&
      other.id !== targetId &&
      state.teams[other.id] === state.teams[actorId] &&
      other.hp.current > 0 &&
      !hasCondition(other, 'incapacitated') &&
      distance(state.positions[other.id], state.positions[targetId]) <= 1.5,
  );
  if (
    isHero(actor) &&
    actor.classId === 'rogue' &&
    options.sneakAttack &&
    !budget.sneakAttackUsed &&
    (weapon?.finesse || weapon?.ranged) &&
    (test.selection === 'highest' ||
      (nearbyAlly && test.selection !== 'lowest'))
  ) {
    damage += rollDice(
      critical ? 2 : 1,
      6,
      recorded(output, 'Ataque furtivo', roller),
    ).total;
    budget.sneakAttackUsed = true;
  }
  damageActor(
    output,
    targetId,
    Math.max(0, damage),
    weapon?.type || profile?.type || 'bludgeoning',
    roller,
    critical,
  );
  const victim = state.actors[targetId];
  if (!victim.dead && victim.hp.current > 0) {
    const duration = {
      casterId: actorId,
      endsActor: actorId,
      endsTurn: state.turns[actorId] + 1,
      endsPhase: 'end',
    };
    if (mastery === 'sap')
      condition(victim, {
        id: 'sap',
        source: 'weapon',
        data: { ...duration, endsPhase: 'start' },
      });
    if (mastery === 'vex')
      condition(victim, {
        id: 'vex',
        source: 'weapon',
        data: { ...duration, attackerId: actorId },
      });
    if (mastery === 'slow')
      condition(victim, {
        id: 'slow',
        source: 'weapon',
        data: { ...duration, endsPhase: 'start' },
      });
    if (
      mastery === 'topple' &&
      !savingThrow(output, targetId, 'con', 8 + 2 + ability, roller)
    )
      condition(victim, { id: 'prone', source: 'weapon' });
  }
  output.facts.unshift(
    `${actor.name} acierta${critical ? ' con crítico' : ''} (${test.total} contra CA ${test.dc}).`,
  );
  return output;
}
export function endTurn(input: BattleState, actorId: string): BattleState {
  if (input.activeId !== actorId)
    throw new RuleError('No puedes finalizar el turno de otro participante.');
  const state = structuredClone(input);
  const expire = (phase: string, id: string) => {
    for (const actor of Object.values(state.actors))
      actor.conditions = actor.conditions.filter(
        (c) =>
          !(
            c.data?.endsActor === id &&
            Number(c.data.endsTurn) <= state.turns[id] &&
            c.data.endsPhase === phase
          ),
      );
  };
  expire('end', actorId);
  let index = state.order.indexOf(actorId);
  for (let n = 0; n < state.order.length; n++) {
    index = (index + 1) % state.order.length;
    if (index === 0) {
      state.round++;
      state.time++;
    }
    const candidate = state.actors[state.order[index]];
    if (candidate && !candidate.dead) break;
  }
  state.activeId = state.order[index];
  state.turns[state.activeId]++;
  expire('start', state.activeId);
  state.budgets[state.activeId] = newBudget(state.actors[state.activeId]);
  for (const budget of Object.values(state.budgets)) {
    budget.sneakAttackUsed = false;
    budget.savageAttackerUsed = false;
  }
  for (const actor of Object.values(state.actors)) {
    actor.conditions = actor.conditions.filter(
      (c) => c.expires === undefined || c.expires > state.time,
    );
    if (isHero(actor)) actor.ac = effectiveAc(actor);
  }
  return state;
}
