import { modifier } from './character.ts';
import { rollDice } from './dice.ts';
import {
  type CharacterState,
  type DamageType,
  type HealthState,
  type Roller,
  RuleError,
} from './types.ts';

function amount(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 10000)
    throw new RuleError('Cantidad no válida.');
}
export function damageAmount(
  actor: HealthState,
  raw: number,
  type: DamageType,
): number {
  amount(raw);
  if (actor.immunities.includes(type)) return 0;
  const resisted = actor.resistances.includes(type) ? Math.floor(raw / 2) : raw;
  return actor.vulnerabilities?.includes(type) ? resisted * 2 : resisted;
}
function unconscious(hero: HealthState): void {
  if (
    !hero.conditions.some((c) => c.id === 'unconscious' && c.source === 'dying')
  )
    hero.conditions.push({ id: 'unconscious', source: 'dying' });
  hero.conditions = hero.conditions.filter((c) => c.id !== 'concentrating');
}
export function applyDamage<T extends HealthState>(
  input: T,
  raw: number,
  type: DamageType,
  critical = false,
): T {
  amount(raw);
  const hero = structuredClone(input);
  if (hero.dead) return hero;
  const damage = damageAmount(hero, raw, type);
  if (damage === 0) return hero;
  const absorbed = Math.min(hero.hp.temp, damage);
  hero.hp.temp -= absorbed;
  const remaining = damage - absorbed;
  if (input.hp.current === 0) {
    // Damage while dying matters even when temporary HP absorbs it (SRD damage-at-zero rule).
    hero.deathSaves.stable = false;
    hero.deathSaves.failures += critical ? 2 : 1;
    if (damage >= hero.hp.max || hero.deathSaves.failures >= 3)
      hero.dead = true;
  } else {
    hero.hp.current = Math.max(0, hero.hp.current - remaining);
    if (hero.hp.current === 0 && remaining - input.hp.current >= hero.hp.max)
      hero.dead = true;
  }
  if (hero.hp.current === 0) unconscious(hero);
  // Any damage wakes a creature affected by Sleep, even when temporary HP was used.
  hero.conditions = hero.conditions.filter((c) => c.source !== 'sleep');
  return hero;
}
export function heal<T extends HealthState>(input: T, value: number): T {
  amount(value);
  const hero = structuredClone(input);
  if (hero.dead || value === 0) return hero;
  hero.hp.current = Math.min(hero.hp.max, hero.hp.current + value);
  if (hero.hp.current > 0) {
    hero.deathSaves = { successes: 0, failures: 0, stable: false };
    hero.conditions = hero.conditions.filter((c) => c.source !== 'dying');
  }
  return hero;
}
export function gainTempHp<T extends HealthState>(input: T, value: number): T {
  amount(value);
  const hero = structuredClone(input);
  hero.hp.temp = Math.max(hero.hp.temp, value);
  return hero;
}
export function deathSave(input: CharacterState, die: number): CharacterState {
  if (
    !Number.isInteger(die) ||
    die < 1 ||
    die > 20 ||
    input.dead ||
    input.hp.current !== 0 ||
    input.deathSaves.stable
  )
    throw new RuleError('No corresponde una salvación contra muerte.');
  if (die === 20) return heal(input, 1);
  const hero = structuredClone(input);
  if (die >= 10) hero.deathSaves.successes++;
  else hero.deathSaves.failures += die === 1 ? 2 : 1;
  if (hero.deathSaves.failures >= 3) hero.dead = true;
  else if (hero.deathSaves.successes >= 3)
    hero.deathSaves = { successes: 0, failures: 0, stable: true };
  return hero;
}
export function secondWind(
  input: CharacterState,
  roller: Roller,
): CharacterState {
  if (
    input.dead ||
    input.hp.current === 0 ||
    input.classId !== 'fighter' ||
    !input.resources.secondWind?.current
  )
    throw new RuleError('No puedes usar Tomar aliento ahora.');
  const hero = heal(input, rollDice(1, 10, roller).total + input.level);
  hero.resources.secondWind.current--;
  return hero;
}
export interface RestOptions {
  kind: 'short' | 'long';
  hours: number;
  spendHitDie?: boolean;
  arcaneRecovery?: boolean;
  interrupted?: boolean;
}
export function rest(
  input: CharacterState,
  options: RestOptions,
  roller: Roller,
): CharacterState {
  const needed =
    options.kind === 'short' ? 1 : input.features.includes('trance') ? 4 : 8;
  if (
    !['short', 'long'].includes(options.kind) ||
    !Number.isFinite(options.hours) ||
    options.hours < needed ||
    options.hours > 240 ||
    options.interrupted ||
    input.dead ||
    input.hp.current === 0
  )
    throw new RuleError('El descanso no cumple las condiciones.');
  let hero = structuredClone(input);
  if (options.kind === 'short') {
    if (options.spendHitDie) {
      if (!hero.hitDice.current)
        throw new RuleError('No te quedan dados de golpe.');
      hero = heal(
        hero,
        Math.max(
          1,
          rollDice(1, hero.hitDie, roller).total + modifier(hero.abilities.con),
        ),
      );
      hero.hitDice.current--;
    }
    if (options.arcaneRecovery) {
      if (
        hero.classId !== 'wizard' ||
        !hero.resources.arcaneRecovery?.current ||
        !hero.spellcasting ||
        hero.spellcasting.slots.current >= hero.spellcasting.slots.max
      )
        throw new RuleError('No puedes usar Recuperación arcana ahora.');
      hero.spellcasting.slots.current++;
      hero.resources.arcaneRecovery.current--;
    }
    for (const resource of Object.values(hero.resources))
      if (resource.shortRest)
        resource.current = Math.min(
          resource.max,
          resource.current + resource.shortRest,
        );
  } else {
    hero = heal(hero, hero.hp.max);
    hero.hp.temp = 0;
    hero.hitDice.current = hero.hitDice.max;
    for (const resource of Object.values(hero.resources))
      if (resource.longRest) resource.current = resource.max;
    if (hero.spellcasting)
      hero.spellcasting.slots.current = hero.spellcasting.slots.max;
    for (const magic of hero.innateMagic) magic.remaining = 1;
    if (hero.speciesId === 'human') hero.inspiration = true;
  }
  return hero;
}
