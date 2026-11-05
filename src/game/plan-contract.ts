import { SCENES } from './adventure.ts';
import { SKILLS } from './catalog.ts';
import type { ActionPlan, WorldOperation } from './session-types.ts';
import type { SpellOptions } from './spells.ts';
import { RuleError, type SkillId } from './types.ts';

function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v))
    throw new RuleError('Datos de acción inválidos.');
  return v as Record<string, unknown>;
}
function keys(v: Record<string, unknown>, allowed: string[]): void {
  if (Object.keys(v).some((k) => !allowed.includes(k)))
    throw new RuleError('La acción contiene campos no permitidos.');
}
function text(v: unknown, max = 100): string {
  if (typeof v !== 'string' || !v.trim() || v.length > max)
    throw new RuleError('Texto de acción inválido.');
  return v.trim();
}
function choice<const T extends readonly string[]>(
  v: unknown,
  values: T,
): T[number] {
  if (!values.includes(v as string))
    throw new RuleError('Opción de acción inválida.');
  return v as T[number];
}
function flag(v: unknown): boolean | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== 'boolean') throw new RuleError('Valor booleano inválido.');
  return v;
}
function number(v: unknown, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max)
    throw new RuleError('Número de acción inválido.');
  return v;
}
function point(v: unknown) {
  const p = object(v);
  keys(p, ['x', 'y']);
  return { x: number(p.x, -100, 100), y: number(p.y, -100, 100) };
}
function operations(v: unknown): WorldOperation[] {
  if (!Array.isArray(v) || v.length > 3)
    throw new RuleError('Consecuencias inválidas.');
  return v.map((raw) => {
    const op = object(raw);
    switch (op.type) {
      case 'fact':
        keys(op, ['type', 'text']);
        return { type: 'fact', text: text(op.text, 400) };
      case 'access':
        keys(op, ['type', 'from', 'to', 'via']);
        return {
          type: 'access',
          from: choice(op.from, Object.keys(SCENES) as (keyof typeof SCENES)[]),
          to: choice(op.to, Object.keys(SCENES) as (keyof typeof SCENES)[]),
          via: choice(op.via, ['window', 'path']),
        };
      case 'disposition':
        keys(op, ['type', 'targetId', 'value']);
        return {
          type: 'disposition',
          targetId: text(op.targetId),
          value: choice(op.value, ['friendly', 'neutral', 'hostile']),
        };
      case 'object':
        keys(op, ['type', 'targetId', 'state']);
        return {
          type: 'object',
          targetId: text(op.targetId),
          state: choice(op.state, ['open', 'broken', 'lit', 'active']),
        };
      case 'loot':
        keys(op, ['type', 'targetId']);
        return { type: 'loot', targetId: text(op.targetId) };
      default:
        throw new RuleError('Consecuencia fuera del catálogo.');
    }
  });
}
function spellOptions(raw: unknown): Omit<SpellOptions, 'attackRoll'> {
  if (raw === undefined) return {};
  const v = object(raw);
  keys(v, [
    'source',
    'useSlot',
    'ritual',
    'skill',
    'objectId',
    'destination',
    'point',
    'minorAction',
    'replaceMinorEffect',
  ]);
  return {
    ...(v.source === undefined
      ? {}
      : { source: choice(v.source, ['class', 'background', 'human', 'elf']) }),
    ...(v.useSlot === undefined ? {} : { useSlot: flag(v.useSlot) }),
    ...(v.ritual === undefined ? {} : { ritual: flag(v.ritual) }),
    ...(v.skill === undefined
      ? {}
      : { skill: choice(v.skill, Object.keys(SKILLS) as SkillId[]) }),
    ...(v.objectId === undefined ? {} : { objectId: text(v.objectId) }),
    ...(v.destination === undefined
      ? {}
      : { destination: point(v.destination) }),
    ...(v.point === undefined ? {} : { point: point(v.point) }),
    ...(v.minorAction === undefined
      ? {}
      : {
          minorAction: choice(v.minorAction, [
            'open',
            'close',
            'sound',
            'clean',
            'ignite',
            'extinguish',
            'voice',
            'eyes',
            'tremor',
            'flames',
          ]),
        }),
    ...(v.replaceMinorEffect === undefined
      ? {}
      : { replaceMinorEffect: text(v.replaceMinorEffect) }),
  };
}
export function validatePlan(raw: unknown): ActionPlan {
  const v = object(raw);
  switch (v.kind) {
    case 'travel':
      keys(v, ['kind', 'destination']);
      return {
        kind: 'travel',
        destination: choice(
          v.destination,
          Object.keys(SCENES) as (keyof typeof SCENES)[],
        ),
      };
    case 'interact':
      keys(v, ['kind', 'targetId', 'method']);
      return {
        kind: 'interact',
        targetId: text(v.targetId),
        method: choice(v.method, [
          'inspect',
          'talk',
          'persuade',
          'sneak',
          'force',
          'use',
          'take',
          'rescue',
        ]),
      };
    case 'attack':
      keys(v, [
        'kind',
        'targetId',
        'weaponId',
        'ranged',
        'offhand',
        'twoHanded',
        'useMastery',
        'sneakAttack',
        'savageAttacker',
      ]);
      return {
        kind: 'attack',
        targetId: text(v.targetId),
        weaponId: text(v.weaponId),
        ranged: flag(v.ranged),
        offhand: flag(v.offhand),
        twoHanded: flag(v.twoHanded),
        useMastery: flag(v.useMastery),
        sneakAttack: flag(v.sneakAttack),
        savageAttacker: flag(v.savageAttacker),
      };
    case 'cast':
      keys(v, ['kind', 'spellId', 'targetIds', 'options']);
      if (!Array.isArray(v.targetIds) || v.targetIds.length > 20)
        throw new RuleError('Objetivos inválidos.');
      return {
        kind: 'cast',
        spellId: text(v.spellId),
        targetIds: v.targetIds.map((id) => text(id)),
        options: spellOptions(v.options),
      };
    case 'move':
      keys(v, ['kind', 'x', 'y']);
      return { kind: 'move', x: number(v.x, -30, 30), y: number(v.y, -30, 30) };
    case 'maneuver':
      keys(v, ['kind', 'maneuver', 'targetId']);
      return {
        kind: 'maneuver',
        maneuver: choice(v.maneuver, [
          'dodge',
          'hide',
          'dash',
          'disengage',
          'stand',
          'search',
          'study',
          'help',
        ]),
        ...(v.targetId === undefined ? {} : { targetId: text(v.targetId) }),
      };
    case 'feature':
      keys(v, ['kind', 'feature']);
      return {
        kind: 'feature',
        feature: choice(v.feature, ['secondWind', 'stonecunning']),
      };
    case 'item':
      keys(v, ['kind', 'itemId', 'targetId']);
      return {
        kind: 'item',
        itemId: text(v.itemId),
        ...(v.targetId === undefined ? {} : { targetId: text(v.targetId) }),
      };
    case 'equip':
      keys(v, ['kind', 'itemId', 'equipped']);
      if (typeof v.equipped !== 'boolean')
        throw new RuleError('Elige equipar o guardar.');
      return { kind: 'equip', itemId: text(v.itemId), equipped: v.equipped };
    case 'rest':
      keys(v, ['kind', 'rest', 'spendHitDie', 'arcaneRecovery']);
      return {
        kind: 'rest',
        rest: choice(v.rest, ['short', 'long']),
        spendHitDie: flag(v.spendHitDie),
        arcaneRecovery: flag(v.arcaneRecovery),
      };
    case 'endTurn':
    case 'retreat':
    case 'death':
      keys(v, ['kind']);
      return { kind: v.kind };
    case 'creative':
      keys(v, ['kind', 'description', 'skill', 'dc', 'onSuccess', 'onFailure']);
      return {
        kind: 'creative',
        description: text(v.description, 700),
        ...(v.skill === undefined
          ? {}
          : { skill: choice(v.skill, Object.keys(SKILLS) as SkillId[]) }),
        ...(v.dc === undefined ? {} : { dc: number(v.dc, 5, 25) }),
        onSuccess: operations(v.onSuccess),
        onFailure: operations(v.onFailure),
      };
    default:
      throw new RuleError('Acción fuera del catálogo.');
  }
}
