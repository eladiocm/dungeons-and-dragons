import { armorClass, modifier } from './character.ts';
import type {
  BattleResolution,
  BattleState,
  Position,
} from './combat-types.ts';
import { resolveD20, rollDice } from './dice.ts';
import { applyDamage, damageAmount } from './rules.ts';
import {
  type Ability,
  type CharacterState,
  type Combatant,
  type Condition,
  type DamageType,
  type Roller,
  RuleError,
} from './types.ts';

export const isHero = (actor: Combatant): actor is CharacterState =>
  'classId' in actor;
export const hasCondition = (actor: Combatant, id: string) =>
  actor.conditions.some((c) => c.id === id);
export const dodging = (actor: Combatant) =>
  hasCondition(actor, 'dodging') &&
  actor.speed > 0 &&
  ![
    'incapacitated',
    'unconscious',
    'paralyzed',
    'stunned',
    'restrained',
    'grappled',
  ].some((id) => hasCondition(actor, id));
export const distance = (a: Position, b: Position) =>
  Math.hypot(a.x - b.x, a.y - b.y);
export function effectiveAc(actor: Combatant): number {
  return isHero(actor)
    ? armorClass(actor)
    : actor.ac + (hasCondition(actor, 'shieldOfFaith') ? 2 : 0);
}
export function saveBonus(actor: Combatant, ability: Ability): number {
  return isHero(actor)
    ? modifier(actor.abilities[ability]) +
        (actor.saves.includes(ability) ? 2 : 0)
    : (actor.saveBonuses[ability] ?? modifier(actor.abilities[ability]));
}
export function assertActor(state: BattleState, id: string): Combatant {
  const actor = state.actors[id];
  if (
    !actor ||
    actor.dead ||
    actor.hp.current <= 0 ||
    ['unconscious', 'incapacitated', 'paralyzed', 'stunned'].some((c) =>
      hasCondition(actor, c),
    )
  )
    throw new RuleError('Esa criatura no puede actuar ahora.');
  return actor;
}
export function condition(actor: Combatant, value: Condition): void {
  actor.conditions = actor.conditions.filter(
    (c) =>
      !(
        c.id === value.id &&
        c.source === value.source &&
        c.data?.casterId === value.data?.casterId
      ),
  );
  actor.conditions.push(value);
}
export function recorded(
  result: BattleResolution,
  label: string,
  roller: Roller,
  actorId = result.state.activeId,
): Roller {
  const scoped = roller.scope?.(label, actorId) || roller;
  let group: import('./combat-types.ts').RollLog | undefined;
  return (sides) => {
    const value = scoped(sides);
    if (group && group.sides === sides) group.values.push(value);
    else {
      group = {
        actorId,
        label,
        sides,
        values: [value],
        groupId: scoped.groupId,
      };
      result.rolls.push(group);
    }
    return value;
  };
}
export function endConcentration(state: BattleState, casterId: string): void {
  for (const actor of Object.values(state.actors)) {
    actor.conditions = actor.conditions.filter(
      (c) =>
        !(
          (c.data?.casterId === casterId && c.data?.concentration === true) ||
          (actor.id === casterId && c.id === 'concentrating')
        ),
    );
    if (isHero(actor)) actor.ac = effectiveAc(actor);
  }
}
export function savingThrow(
  result: BattleResolution,
  actorId: string,
  ability: Ability,
  dc: number,
  roller: Roller,
  options: {
    advantage?: boolean;
    disadvantage?: boolean;
    effect?: 'poison' | 'charmed' | 'frightened' | 'magicalSleep';
  } = {},
): boolean {
  const actor = result.state.actors[actorId];
  if (!actor) throw new RuleError('Objetivo de salvación no válido.');
  if (options.effect && actor.immunities.includes(options.effect)) return true;
  const traitAdvantage =
    (options.effect === 'poison' &&
      actor.features.includes('dwarvenResilience')) ||
    (options.effect === 'charmed' && actor.features.includes('feyAncestry')) ||
    (options.effect === 'frightened' && actor.features.includes('brave'));
  if (
    ['str', 'dex'].includes(ability) &&
    ['unconscious', 'paralyzed', 'stunned'].some((id) =>
      hasCondition(actor, id),
    )
  )
    return false;
  let bonus = saveBonus(actor, ability);
  if (hasCondition(actor, 'bless'))
    bonus += rollDice(
      1,
      4,
      recorded(result, `Bendición: ${actor.name}`, roller, actorId),
    ).total;
  const roll = resolveD20(
    {
      kind: 'save',
      bonus,
      dc,
      advantage:
        options.advantage ||
        traitAdvantage ||
        (ability === 'dex' && dodging(actor)),
      disadvantage: options.disadvantage,
    },
    recorded(result, `Salvación de ${actor.name}`, roller, actorId),
  );
  result.facts.push(
    `${actor.name}: salvación ${roll.total} frente a ${dc}, ${roll.success ? 'superada' : 'fallida'}.`,
  );
  return roll.success;
}
export function damageActor(
  result: BattleResolution,
  targetId: string,
  damage: number,
  type: DamageType,
  roller: Roller,
  critical = false,
): void {
  const target = result.state.actors[targetId];
  if (!target) throw new RuleError('No existe ese objetivo.');
  const concentrated = hasCondition(target, 'concentrating');
  const actualDamage = damageAmount(target, damage, type);
  const next = applyDamage(target, damage, type, critical);
  if (!isHero(next) && next.hp.current === 0) next.dead = true;
  result.state.actors[targetId] = next;
  result.facts.push(
    `${target.name} recibe ${actualDamage} de daño ${type}; PG ${next.hp.current}/${next.hp.max}.`,
  );
  if (
    concentrated &&
    actualDamage > 0 &&
    (next.hp.current === 0 ||
      !savingThrow(
        result,
        targetId,
        'con',
        Math.max(10, Math.floor(actualDamage / 2)),
        roller,
      ))
  ) {
    endConcentration(result.state, targetId);
    result.facts.push(`${target.name} pierde la concentración.`);
  }
  if (isHero(next)) next.ac = effectiveAc(next);
}
