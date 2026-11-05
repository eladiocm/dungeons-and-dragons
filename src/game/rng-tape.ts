import type { TapeDie } from './session-types.ts';
import { type Roller, RuleError } from './types.ts';

export function createTapeRoller(
  previous: readonly TapeDie[],
  random: Roller,
): { roller: Roller; tape: TapeDie[] } {
  const tape: TapeDie[] = [],
    old = new Map<string, TapeDie[]>(),
    counts = new Map<string, number>();
  for (const die of previous) {
    const group = old.get(die.groupId) || [];
    group.push({ ...die });
    old.set(die.groupId, group);
  }
  const scope = (label: string, actorId: string): Roller => {
    const key = JSON.stringify([actorId, label]);
    const occurrence = counts.get(key) || 0;
    counts.set(key, occurrence + 1);
    const groupId = JSON.stringify([actorId, label, occurrence]);
    let index = 0;
    const scoped: Roller = (sides) => {
      const cached = old.get(groupId)?.[index++];
      const value = cached?.sides === sides ? cached.value : random(sides);
      if (!Number.isInteger(value) || value < 1 || value > sides)
        throw new RuleError('Valor de dado inválido.', 500);
      tape.push({ sides, value, actorId, label, groupId });
      return value;
    };
    scoped.groupId = groupId;
    return scoped;
  };
  const roller = scope('Azar', 'system');
  roller.scope = scope;
  return { roller, tape };
}
