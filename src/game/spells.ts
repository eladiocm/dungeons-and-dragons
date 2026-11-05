import {
  assertActor,
  condition,
  damageActor,
  distance,
  effectiveAc,
  endConcentration,
  hasCondition,
  isHero,
  recorded,
  savingThrow,
} from './battle-effects.ts';
import { ARMOR, SKILLS, SPELLS, WEAPONS } from './catalog.ts';
import { modifier } from './character.ts';
import { endTurn } from './combat.ts';
import type {
  BattleResolution,
  BattleState,
  Position,
} from './combat-types.ts';
import { type D20Result, resolveD20, rollDice } from './dice.ts';
import { heal } from './rules.ts';
import {
  type Ability,
  type CharacterState,
  type Combatant,
  type Roller,
  RuleError,
  type SkillId,
} from './types.ts';

export interface SpellOptions {
  source?: 'class' | 'background' | 'human' | 'elf';
  useSlot?: boolean;
  ritual?: boolean;
  skill?: SkillId;
  objectId?: string;
  destination?: Position;
  point?: Position;
  minorAction?:
    | 'open'
    | 'close'
    | 'sound'
    | 'clean'
    | 'ignite'
    | 'extinguish'
    | 'voice'
    | 'eyes'
    | 'tremor'
    | 'flames';
  replaceMinorEffect?: string;
  attackRoll?: D20Result;
}
function fail(message: string): never {
  throw new RuleError(message);
}
function hasTraining(hero: CharacterState, armorId: string): boolean {
  const category = ARMOR[armorId]?.category;
  return (
    hero.classId === 'fighter' ||
    hero.features.includes('protector') ||
    (hero.classId === 'cleric' && category !== 'heavy') ||
    (hero.classId === 'rogue' && category === 'light')
  );
}
function sourceOf(
  caster: CharacterState,
  spellId: string,
  options: SpellOptions,
): {
  ability: Ability;
  cost: 'slot' | 'innate' | 'none';
  innateIndex?: number;
} {
  const def = SPELLS[spellId],
    source = options.source || 'class';
  if (source === 'elf') {
    if (
      def.level !== 0 ||
      caster.elfMagic?.cantrip !== spellId ||
      options.ritual
    )
      fail('Tu linaje no conoce ese truco.');
    return { ability: caster.elfMagic.ability, cost: 'none' };
  }
  if (source !== 'class') {
    const index = caster.innateMagic.findIndex(
      (m) =>
        m.source === source &&
        (m.spell === spellId || m.cantrips.includes(spellId)),
    );
    const innate = caster.innateMagic[index];
    if (!innate || options.ritual)
      fail('Tu dote no conoce ese conjuro o no permite ese ritual.');
    if (def.level === 0) return { ability: innate.ability, cost: 'none' };
    if (!options.useSlot && innate.remaining <= 0)
      fail('Ya gastaste el uso gratuito de esa dote.');
    return {
      ability: innate.ability,
      cost: options.useSlot ? 'slot' : 'innate',
      innateIndex: index,
    };
  }
  const casting = caster.spellcasting;
  if (!casting) fail('Tu clase no tiene ese lanzamiento de conjuros.');
  const known =
    def.level === 0
      ? casting.cantrips.includes(spellId)
      : casting.prepared.includes(spellId);
  const ritualBook =
    options.ritual &&
    def.ritual &&
    caster.classId === 'wizard' &&
    casting.book.includes(spellId);
  if (!known && !ritualBook)
    fail('Ese conjuro no está preparado o no figura entre tus trucos.');
  if (options.ritual && !def.ritual)
    fail('Ese conjuro no se puede lanzar como ritual.');
  return {
    ability: casting.ability,
    cost: def.level === 0 || options.ritual ? 'none' : 'slot',
  };
}
function validate(
  input: BattleState,
  casterId: string,
  spellId: string,
  targetIds: string[],
  options: SpellOptions,
) {
  const caster = assertActor(input, casterId),
    def = SPELLS[spellId];
  if (!def || !isHero(caster)) fail('Conjuro no disponible en este catálogo.');
  const origin = sourceOf(caster, spellId, options),
    budget = input.budgets[casterId];
  if (
    def.action !== 'reaction' &&
    input.inCombat &&
    input.activeId !== casterId
  )
    fail('Espera tu turno para lanzar ese conjuro.');
  if (options.ritual && input.inCombat)
    fail('No puedes completar este ritual durante el combate.');
  if (
    input.inCombat &&
    !budget[
      def.action === 'bonus'
        ? 'bonus'
        : def.action === 'reaction'
          ? 'reaction'
          : 'action'
    ]
  )
    fail('No queda la acción necesaria para ese conjuro.');
  if (
    origin.cost === 'slot' &&
    (!caster.spellcasting?.slots.current ||
      (input.inCombat && budget.spellSlotSpent))
  )
    fail('No queda un espacio disponible o ya gastaste uno este turno.');
  if (
    caster.inventory.some(
      (i) =>
        i.equipped && ARMOR[i.catalogId] && !hasTraining(caster, i.catalogId),
    )
  )
    fail('No puedes lanzar conjuros con una armadura sin entrenamiento.');
  if (def.components.includes('V') && hasCondition(caster, 'silenced'))
    fail('Este conjuro requiere poder hablar.');
  if (def.components.includes('M')) {
    const list =
      origin.innateIndex === undefined
        ? caster.classId
        : caster.innateMagic[origin.innateIndex].list;
    const classFocus =
      (caster.classId === 'wizard' &&
        list === 'wizard' &&
        caster.inventory.some(
          (i) =>
            ['spellbook', 'quarterstaff', 'arcane-focus'].includes(
              i.catalogId,
            ) && i.quantity > 0,
        )) ||
      (caster.classId === 'cleric' &&
        list === 'cleric' &&
        caster.inventory.some(
          (i) => i.catalogId === 'holy-symbol' && i.quantity > 0,
        ));
    if (
      !classFocus &&
      !caster.inventory.some(
        (i) => i.catalogId === 'component-pouch' && i.quantity > 0,
      )
    )
      fail('Necesitas el componente material o una bolsa de componentes.');
  }
  const maxTargets =
    spellId === 'bless'
      ? 3
      : spellId === 'featherFall'
        ? 5
        : spellId === 'magicMissile'
          ? 3
          : ['sleep', 'thunderwave'].includes(spellId)
            ? 20
            : 1;
  if (
    targetIds.length > maxTargets ||
    (spellId !== 'magicMissile' && new Set(targetIds).size !== targetIds.length)
  )
    fail('Revisa la selección de objetivos.');
  const objectSpell = [
    'light',
    'mageHand',
    'prestidigitation',
    'thaumaturgy',
  ].includes(spellId);
  if (!objectSpell && targetIds.length < 1)
    fail('Elige el objetivo del conjuro.');
  const requiresSight = ['sacredFlame', 'healingWord', 'magicMissile'].includes(
    spellId,
  );
  for (const id of targetIds) {
    const target = input.actors[id];
    if (
      !target ||
      target.dead ||
      !input.positions[id] ||
      input.cover[id] === 100 ||
      (!['sleep', 'thunderwave'].includes(spellId) &&
        distance(input.positions[casterId], input.positions[id]) > def.range)
    )
      fail('Un objetivo está fuera del alcance o bloqueado.');
    if (requiresSight && hasCondition(target, 'invisible') && id !== casterId)
      fail('Necesitas ver al objetivo.');
  }
  if (
    spellId === 'detectMagic' &&
    (targetIds.length !== 1 || targetIds[0] !== casterId)
  )
    fail('Detectar magia afecta al propio lanzador.');
  if (
    spellId === 'bless' &&
    !caster.inventory.some(
      (i) => i.catalogId === 'holy-symbol' && i.quantity > 0,
    )
  )
    fail('Bendición necesita un símbolo sagrado de al menos 5 po.');
  if (spellId === 'sleep') {
    const point = options.point || input.positions[targetIds[0]];
    if (
      !point ||
      !Number.isFinite(point.x) ||
      !Number.isFinite(point.y) ||
      distance(input.positions[casterId], point) > 18 ||
      targetIds.some((id) => distance(point, input.positions[id]) > 1.5)
    )
      fail(
        'El centro debe estar a 18 m o menos y los objetivos dentro de su esfera de 1,5 m.',
      );
  }
  if (
    spellId === 'mageArmor' &&
    targetIds.some(
      (id) =>
        isHero(input.actors[id]) &&
        (input.actors[id] as CharacterState).inventory.some(
          (i) => i.equipped && ARMOR[i.catalogId],
        ),
    )
  )
    fail('Armadura de mago requiere un objetivo sin armadura.');
  if (
    spellId === 'guidance' &&
    (!options.skill || !Object.hasOwn(SKILLS, options.skill))
  )
    fail('Elige la habilidad para Guía.');
  if (
    spellId === 'featherFall' &&
    (!targetIds.every((id) => hasCondition(input.actors[id], 'falling')) ||
      !targetIds.some(
        (id) => id === casterId || !hasCondition(input.actors[id], 'invisible'),
      ))
  )
    fail('Caída de pluma es una reacción a una caída.');
  if (objectSpell && options.objectId) {
    const object = input.objects[options.objectId];
    if (
      !object ||
      distance(input.positions[casterId], object.position) > def.range
    )
      fail('Ese objeto no está al alcance.');
    if (
      spellId === 'mageHand' &&
      !['open', 'close'].includes(options.minorAction || '') &&
      (object.weight > 5 ||
        !options.destination ||
        distance(input.positions[casterId], options.destination) > 9 ||
        !Number.isFinite(options.destination.x) ||
        !Number.isFinite(options.destination.y))
    )
      fail('La mano solo puede mover hasta 5 kg dentro de 9 m.');
    if (
      ['thaumaturgy', 'mageHand'].includes(spellId) &&
      ['open', 'close'].includes(options.minorAction || '') &&
      object.locked
    )
      fail('Este truco no abre una puerta cerrada con llave.');
    if (
      ['ignite', 'extinguish'].includes(options.minorAction || '') &&
      (spellId !== 'prestidigitation' || !object.lightSource)
    )
      fail(
        'Solo Prestidigitación puede encender o apagar una vela, antorcha o fogata.',
      );
  } else if (['light', 'mageHand'].includes(spellId))
    fail('Elige un objeto real de la escena.');
  return { caster, def, origin };
}
function prepareHands(
  result: BattleResolution,
  caster: CharacterState,
  components: string,
): void {
  if (!components.includes('S')) return;
  const shield = caster.inventory.some(
    (i) => i.equipped && i.catalogId === 'shield',
  );
  const weapons = caster.inventory.filter(
    (i) => i.equipped && WEAPONS[i.catalogId],
  );
  // Two-handed weapons can be held in one hand while casting; only shield+weapon/two separate weapons occupy both hands.
  if ((shield && weapons.length > 0) || weapons.length >= 2) {
    if (
      components.includes('M') &&
      shield &&
      caster.classId === 'cleric' &&
      caster.inventory.some((i) => i.catalogId === 'holy-symbol')
    )
      return;
    if (!result.state.budgets[caster.id].objectInteraction)
      fail('Libera una mano antes de hacer los componentes somáticos.');
    weapons[0].equipped = false;
    result.state.budgets[caster.id].objectInteraction = false;
    result.facts.push(
      `${caster.name} guarda ${weapons[0].name} para tener una mano libre.`,
    );
  }
}
function setEffect(
  result: BattleResolution,
  id: string,
  spellId: string,
  casterId: string,
  extra: Record<string, string | number | boolean> = {},
) {
  const def = SPELLS[spellId];
  condition(result.state.actors[id], {
    id: spellId,
    source: spellId,
    expires: result.state.time + def.duration,
    data: { casterId, concentration: Boolean(def.concentration), ...extra },
  });
}
function spellAttack(
  result: BattleResolution,
  caster: CharacterState,
  target: Combatant,
  ability: Ability,
  roller: Roller,
  options: SpellOptions,
): D20Result {
  let bonus = 2 + modifier(caster.abilities[ability]);
  if (hasCondition(caster, 'bless'))
    bonus += rollDice(1, 4, recorded(result, 'Bendición', roller)).total;
  const span = distance(
    result.state.positions[caster.id],
    result.state.positions[target.id],
  );
  const hostileNearby = Object.values(result.state.actors).some(
    (a) =>
      a.id !== caster.id &&
      a.hp.current > 0 &&
      result.state.teams[a.id] !== result.state.teams[caster.id] &&
      distance(
        result.state.positions[caster.id],
        result.state.positions[a.id],
      ) <= 1.5 &&
      !hasCondition(a, 'incapacitated') &&
      !hasCondition(a, 'unconscious'),
  );
  const advantage =
    hasCondition(caster, 'invisible') ||
    hasCondition(target, 'guidingBolt') ||
    (hasCondition(target, 'prone') && span <= 1.5) ||
    ['unconscious', 'restrained', 'paralyzed', 'stunned'].some((id) =>
      hasCondition(target, id),
    );
  const disadvantage =
    hostileNearby ||
    ['poisoned', 'blinded', 'prone', 'restrained', 'frightened', 'sap'].some(
      (id) => hasCondition(caster, id),
    ) ||
    hasCondition(target, 'dodging') ||
    hasCondition(target, 'invisible') ||
    (hasCondition(target, 'prone') && span > 1.5);
  const roll =
    options.attackRoll ||
    resolveD20(
      {
        kind: 'attack',
        bonus,
        dc: effectiveAc(target) + (result.state.cover[target.id] || 0),
        advantage,
        disadvantage,
      },
      recorded(result, `Ataque mágico de ${caster.name}`, roller),
    );
  if (
    roll.bonus !== bonus ||
    roll.dc !== effectiveAc(target) + (result.state.cover[target.id] || 0)
  )
    fail('La tirada no corresponde al ataque mágico pendiente.');
  caster.conditions = caster.conditions.filter(
    (c) => c.id !== 'sap' && c.source !== 'hiding',
  );
  target.conditions = target.conditions.filter((c) => c.id !== 'guidingBolt');
  result.attack = roll;
  return roll;
}
export function castSpell(
  input: BattleState,
  casterId: string,
  spellId: string,
  targetIds: string[],
  options: SpellOptions,
  roller: Roller,
): BattleResolution {
  const checked = validate(input, casterId, spellId, targetIds, options);
  const result: BattleResolution = {
    state: structuredClone(input),
    rolls: [],
    facts: [],
  };
  const state = result.state,
    caster = state.actors[casterId];
  if (!isHero(caster)) fail('Lanzador no disponible.');
  const { def, origin } = checked,
    mod = modifier(caster.abilities[origin.ability]),
    dc = 8 + 2 + mod;
  prepareHands(result, caster, def.components);
  if (options.ritual) state.time += 101;
  else {
    const action =
      def.action === 'bonus'
        ? 'bonus'
        : def.action === 'reaction'
          ? 'reaction'
          : 'action';
    state.budgets[casterId][action] = false;
  }
  if (origin.cost === 'slot') {
    if (!caster.spellcasting) fail('No tienes espacios.');
    caster.spellcasting.slots.current--;
    state.budgets[casterId].spellSlotSpent = true;
  }
  if (origin.cost === 'innate' && origin.innateIndex !== undefined)
    caster.innateMagic[origin.innateIndex].remaining--;
  if (def.concentration) {
    endConcentration(state, casterId);
    condition(caster, {
      id: 'concentrating',
      source: spellId,
      expires: state.time + def.duration,
      data: { spellId },
    });
  }
  result.facts.push(
    `${caster.name} lanza ${def.name}${options.ritual ? ' como ritual' : ''}.`,
  );
  switch (spellId) {
    case 'cureWounds':
    case 'healingWord': {
      const healed = Math.max(
        0,
        rollDice(
          2,
          spellId === 'cureWounds' ? 8 : 4,
          recorded(result, def.name, roller),
        ).total + mod,
      );
      const target = state.actors[targetIds[0]];
      state.actors[target.id] = heal(target, healed);
      result.facts.push(
        `${target.name} recupera hasta ${healed} PG; ahora ${state.actors[target.id].hp.current}/${target.hp.max}.`,
      );
      break;
    }
    case 'bless':
    case 'shieldOfFaith':
    case 'mageArmor':
    case 'detectMagic':
    case 'featherFall':
      for (const id of targetIds) setEffect(result, id, spellId, casterId);
      break;
    case 'guidance':
      setEffect(result, targetIds[0], spellId, casterId, {
        skill: options.skill || 'athletics',
      });
      break;
    case 'magicMissile': {
      const darts =
        targetIds.length === 1
          ? [targetIds[0], targetIds[0], targetIds[0]]
          : targetIds.length === 2
            ? [targetIds[0], targetIds[1], targetIds[1]]
            : targetIds;
      const damages = darts.map((id) => ({
        id,
        damage:
          rollDice(1, 4, recorded(result, 'Proyectil mágico', roller)).total +
          1,
      }));
      for (const dart of damages)
        damageActor(result, dart.id, dart.damage, 'force', roller);
      break;
    }
    case 'sacredFlame': {
      const id = targetIds[0];
      if (!savingThrow(result, id, 'dex', dc, roller))
        damageActor(
          result,
          id,
          rollDice(1, 8, recorded(result, def.name, roller)).total,
          'radiant',
          roller,
        );
      break;
    }
    case 'rayOfFrost':
    case 'guidingBolt': {
      const id = targetIds[0],
        target = state.actors[id];
      const roll = spellAttack(
        result,
        caster,
        target,
        origin.ability,
        roller,
        options,
      );
      if (roll.success) {
        const n = spellId === 'rayOfFrost' ? 1 : 4,
          sides = spellId === 'rayOfFrost' ? 8 : 6;
        damageActor(
          result,
          id,
          rollDice(
            n * (roll.critical ? 2 : 1),
            sides,
            recorded(result, def.name, roller),
          ).total,
          spellId === 'rayOfFrost' ? 'cold' : 'radiant',
          roller,
          roll.critical,
        );
        if (state.actors[id].hp.current > 0)
          condition(state.actors[id], {
            id: spellId,
            source: spellId,
            data: {
              casterId,
              endsActor: casterId,
              endsTurn: state.turns[casterId] + 1,
              endsPhase: spellId === 'rayOfFrost' ? 'start' : 'end',
            },
          });
      } else
        result.facts.push(
          `El ataque mágico falla (${roll.total} contra CA ${roll.dc}).`,
        );
      break;
    }
    case 'sleep': {
      const point = options.point || state.positions[targetIds[0]];
      if (!point || distance(state.positions[casterId], point) > 18)
        fail('El centro de Dormir no está al alcance.');
      for (const id of targetIds) {
        const target = state.actors[id];
        if (distance(point, state.positions[id]) > 1.5)
          fail('Todos los objetivos deben estar en la esfera de Dormir.');
        if (
          target.immunities.includes('magicalSleep') ||
          target.immunities.includes('exhaustion')
        )
          continue;
        if (!savingThrow(result, id, 'wis', dc, roller))
          condition(target, {
            id: 'incapacitated',
            source: 'sleep',
            expires: state.time + 10,
            data: {
              casterId,
              concentration: true,
              dc,
              stage: 1,
              saveTurn: state.turns[id] + 1,
            },
          });
      }
      if (hasCondition(caster, 'incapacitated'))
        endConcentration(state, casterId);
      break;
    }
    case 'thunderwave': {
      const originPosition = state.positions[casterId];
      const first = state.positions[targetIds[0]],
        direction =
          first.x === originPosition.x
            ? { x: 0, y: Math.sign(first.y - originPosition.y) || 1 }
            : { x: Math.sign(first.x - originPosition.x), y: 0 };
      for (const id of targetIds) {
        const p = state.positions[id],
          forward =
            (p.x - originPosition.x) * direction.x +
            (p.y - originPosition.y) * direction.y,
          side =
            (p.y - originPosition.y) * direction.x -
            (p.x - originPosition.x) * direction.y;
        if (forward < 0 || forward > 4.5 || Math.abs(side) > 2.25)
          fail('Los objetivos deben estar dentro del mismo cubo de 4,5 m.');
      }
      const damage = rollDice(2, 8, recorded(result, def.name, roller)).total;
      for (const id of targetIds) {
        const saved = savingThrow(result, id, 'con', dc, roller);
        damageActor(
          result,
          id,
          saved ? Math.floor(damage / 2) : damage,
          'thunder',
          roller,
        );
        if (!saved) {
          const p = state.positions[id];
          state.positions[id] = {
            x: p.x + direction.x * 3,
            y: p.y + direction.y * 3,
          };
        }
      }
      result.facts.push(
        'El trueno se oye a 90 m; los objetos sueltos del área son empujados.',
      );
      break;
    }
    case 'light': {
      const object = state.objects[options.objectId || ''];
      if (!object) fail('No existe ese objeto.');
      for (const value of Object.values(state.objects))
        value.conditions = value.conditions.filter(
          (c) => !(c.id === 'light' && c.data?.casterId === casterId),
        );
      object.conditions.push({
        id: 'light',
        source: 'light',
        expires: state.time + 600,
        data: { casterId },
      });
      result.facts.push(`${object.name} ilumina la escena.`);
      break;
    }
    case 'mageHand': {
      const object = state.objects[options.objectId || ''];
      if (!object) fail('Elige un objeto.');
      if (['open', 'close'].includes(options.minorAction || ''))
        object.open = options.minorAction === 'open';
      else {
        if (!options.destination) fail('Elige un destino.');
        object.position = { ...options.destination };
      }
      setEffect(result, casterId, spellId, casterId);
      result.facts.push(
        `La mano mueve ${object.name} sin atacar ni activar objetos mágicos.`,
      );
      break;
    }
    case 'prestidigitation':
    case 'thaumaturgy': {
      const object = state.objects[options.objectId || ''];
      const effect =
        options.minorAction || (spellId === 'thaumaturgy' ? 'voice' : 'clean');
      if (object && ['open', 'close'].includes(options.minorAction || '')) {
        if (spellId !== 'thaumaturgy')
          fail('Prestidigitación no abre puertas.');
        object.open = options.minorAction === 'open';
      }
      if (
        object &&
        ['ignite', 'extinguish'].includes(options.minorAction || '')
      ) {
        object.conditions = object.conditions.filter((c) => c.id !== 'burning');
        if (options.minorAction === 'ignite')
          object.conditions.push({ id: 'burning', source: spellId });
      }
      if (['voice', 'eyes', 'tremor', 'flames'].includes(effect)) {
        const id = `${spellId}:${effect}`;
        const active = caster.conditions.filter(
          (c) => c.source === spellId && c.data?.minorEffect === true,
        );
        if (!active.some((c) => c.id === id) && active.length >= 3) {
          if (
            !options.replaceMinorEffect ||
            !active.some((c) => c.id === options.replaceMinorEffect)
          )
            fail('Elige cuál de tus tres efectos menores quieres sustituir.');
          caster.conditions = caster.conditions.filter(
            (c) => c.id !== options.replaceMinorEffect,
          );
        }
        condition(caster, {
          id,
          source: spellId,
          expires: state.time + def.duration,
          data: {
            casterId,
            minorEffect: true,
            ...(spellId === 'thaumaturgy' && effect === 'voice'
              ? { skill: 'intimidation', advantage: true }
              : {}),
          },
        });
      }
      result.facts.push(
        'Efecto menor sensorial o material; no inflige daño ni concede competencias.',
      );
      break;
    }
    default:
      fail('El efecto de ese conjuro aún no está habilitado.');
  }
  for (const actor of Object.values(state.actors))
    if (isHero(actor)) actor.ac = effectiveAc(actor);
  return result;
}
export function spellEndTurn(
  input: BattleState,
  actorId: string,
  roller: Roller,
): BattleResolution {
  const result: BattleResolution = {
    state: structuredClone(input),
    rolls: [],
    facts: [],
  };
  if (result.state.activeId !== actorId)
    fail('No es el turno de esa criatura.');
  const actor = result.state.actors[actorId];
  for (const effect of [...actor.conditions]) {
    if (
      effect.source === 'sleep' &&
      effect.data?.stage === 1 &&
      Number(effect.data.saveTurn) <= result.state.turns[actorId]
    ) {
      const saved = savingThrow(
        result,
        actorId,
        'wis',
        Number(effect.data.dc),
        roller,
      );
      actor.conditions = actor.conditions.filter((c) => c !== effect);
      if (!saved)
        condition(actor, {
          ...effect,
          id: 'unconscious',
          data: { ...effect.data, stage: 2 },
        });
    }
  }
  result.state = endTurn(result.state, actorId);
  for (const caster of Object.values(result.state.actors))
    if (!hasCondition(caster, 'concentrating'))
      endConcentration(result.state, caster.id);
  return result;
}
