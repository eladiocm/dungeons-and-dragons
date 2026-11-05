import { type Roller, RuleError } from './types.ts';

export interface DiceResult {
  sides: number;
  values: number[];
  total: number;
}
export interface D20Input {
  kind: 'check' | 'save' | 'attack';
  bonus: number;
  dc: number;
  advantage?: boolean;
  disadvantage?: boolean;
}
export interface D20Result extends D20Input {
  dice: number[];
  selection: 'highest' | 'lowest' | 'single';
  used: number;
  total: number;
  success: boolean;
  critical: boolean;
  rerolls: {
    source: 'lucky' | 'inspiration';
    index: number;
    previous: number;
    next: number;
  }[];
}
export function rollDice(
  count: number,
  sides: number,
  roller: Roller,
  minimum = 1,
): DiceResult {
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > 40 ||
    ![4, 6, 8, 10, 12, 20, 100].includes(sides) ||
    !Number.isInteger(minimum) ||
    minimum < 1 ||
    minimum > sides
  )
    throw new RuleError('Fórmula de dados no válida.');
  const values = Array.from({ length: count }, () => {
    const value = roller(sides);
    if (!Number.isInteger(value) || value < 1 || value > sides)
      throw new RuleError('El generador devolvió un dado imposible.', 500);
    return Math.max(minimum, value);
  });
  return { sides, values, total: values.reduce((a, b) => a + b, 0) };
}
function result(
  input: D20Input,
  dice: number[],
  selection: D20Result['selection'],
  rerolls: D20Result['rerolls'],
): D20Result {
  const used =
    selection === 'highest'
      ? Math.max(...dice)
      : selection === 'lowest'
        ? Math.min(...dice)
        : dice[0];
  const total = used + input.bonus;
  const success =
    input.kind === 'attack' && used === 20
      ? true
      : input.kind === 'attack' && used === 1
        ? false
        : total >= input.dc;
  return {
    ...input,
    dice,
    selection,
    used,
    total,
    success,
    critical: input.kind === 'attack' && used === 20,
    rerolls,
  };
}
export function resolveD20(input: D20Input, roller: Roller): D20Result {
  if (
    !Number.isInteger(input.bonus) ||
    Math.abs(input.bonus) > 50 ||
    !Number.isInteger(input.dc) ||
    input.dc < 0 ||
    input.dc > 100
  )
    throw new RuleError('Prueba d20 no válida.');
  const selection =
    Boolean(input.advantage) === Boolean(input.disadvantage)
      ? 'single'
      : input.advantage
        ? 'highest'
        : 'lowest';
  return result(
    input,
    rollDice(selection === 'single' ? 1 : 2, 20, roller).values,
    selection,
    [],
  );
}
export function replaceD20(
  previous: D20Result,
  index: number,
  source: 'lucky' | 'inspiration',
  roller: Roller,
): D20Result {
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= previous.dice.length ||
    !['lucky', 'inspiration'].includes(source) ||
    previous.rerolls.some((r) => r.source === source) ||
    (source === 'lucky' && previous.dice[index] !== 1)
  )
    throw new RuleError('Esta repetición de dado no es válida.');
  const dice = [...previous.dice];
  const next = rollDice(1, 20, roller).total;
  dice[index] = next;
  return result(previous, dice, previous.selection, [
    ...previous.rerolls,
    { source, index, previous: previous.dice[index], next },
  ]);
}
