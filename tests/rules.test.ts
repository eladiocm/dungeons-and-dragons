import assert from 'node:assert/strict';
import test from 'node:test';
import { createCharacter, suggestCharacter } from '../src/game/character.ts';
import { replaceD20, resolveD20, rollDice } from '../src/game/dice.ts';
import {
  applyDamage,
  deathSave,
  gainTempHp,
  heal,
  rest,
  secondWind,
} from '../src/game/rules.ts';

const hero = () => createCharacter(suggestCharacter('fighter'), 'hero');
const sequence = (...values: number[]) => {
  let index = 0;
  return () => {
    assert.ok(index < values.length, 'Unexpected extra dice roll');
    return values[index++];
  };
};

test('advantage uses higher die disadvantage lower and both cancel', () => {
  assert.equal(
    resolveD20(
      { bonus: 3, dc: 15, kind: 'check', advantage: true },
      sequence(4, 12),
    ).total,
    15,
  );
  assert.equal(
    resolveD20(
      { bonus: 3, dc: 15, kind: 'check', disadvantage: true },
      sequence(4, 12),
    ).success,
    false,
  );
  assert.equal(
    resolveD20(
      { bonus: 3, dc: 15, kind: 'check', advantage: true, disadvantage: true },
      sequence(12),
    ).success,
    true,
  );
});

test('natural 20 or 1 only determines automatic attack outcomes', () => {
  assert.equal(
    resolveD20({ bonus: -1, dc: 25, kind: 'check' }, sequence(20)).success,
    false,
  );
  assert.equal(
    resolveD20({ bonus: 10, dc: 10, kind: 'check' }, sequence(1)).success,
    true,
  );
  const critical = resolveD20(
    { bonus: -10, dc: 30, kind: 'attack' },
    sequence(20),
  );
  assert.equal(critical.success, true);
  assert.equal(critical.critical, true);
  assert.equal(
    resolveD20({ bonus: 20, dc: 10, kind: 'attack' }, sequence(1)).success,
    false,
  );
});

test('dice reject impossible RNG values and preserve all rolled faces', () => {
  assert.deepEqual(rollDice(2, 8, sequence(3, 7)), {
    sides: 8,
    values: [3, 7],
    total: 10,
  });
  assert.throws(() => rollDice(1, 20, sequence(0)));
  assert.throws(() => rollDice(10000, 6, sequence(1)));
});

test('rerolls replace a chosen die and cannot repeat the same source', () => {
  const rolled = resolveD20(
    { bonus: 2, dc: 15, kind: 'check', advantage: true },
    sequence(1, 8),
  );
  const lucky = replaceD20(rolled, 0, 'lucky', sequence(1));
  assert.equal(lucky.total, 10);
  assert.throws(() => replaceD20(lucky, 0, 'lucky', sequence(20)));
  assert.throws(() => replaceD20(rolled, 1, 'lucky', sequence(20)));
  const inspired = replaceD20(lucky, 1, 'inspiration', sequence(16));
  assert.equal(inspired.total, 18);
  assert.equal(inspired.success, true);
  assert.deepEqual(rolled.dice, [1, 8]);
});

test('temporary hit points absorb damage without stacking or waking unconscious heroes', () => {
  const base = hero();
  const temp = gainTempHp(gainTempHp(base, 5), 3);
  assert.equal(temp.hp.temp, 5);
  const damaged = applyDamage(temp, 7, 'slashing');
  assert.equal(damaged.hp.current, 10);
  assert.equal(damaged.hp.temp, 0);
  assert.equal(base.hp.current, 12);
  const down = gainTempHp(applyDamage(base, 12, 'force'), 4);
  assert.equal(down.hp.current, 0);
  assert.ok(
    down.conditions.some((condition) => condition.id === 'unconscious'),
  );
});

test('poison resistance halves damage downwards and zero effective damage is harmless', () => {
  const draft = suggestCharacter('fighter');
  draft.speciesId = 'dwarf';
  const dwarf = createCharacter(draft, 'dwarf');
  assert.equal(applyDamage(dwarf, 5, 'poison').hp.current, 11);
  assert.equal(applyDamage(dwarf, 1, 'poison').hp.current, 13);
});

test('massive damage and damage at zero use separate death rules', () => {
  const base = hero();
  assert.equal(applyDamage(base, 23, 'force').dead, false);
  assert.equal(applyDamage(base, 24, 'force').dead, true);
  const down = applyDamage(base, 12, 'force');
  assert.equal(down.dead, false);
  assert.equal(applyDamage(down, 1, 'force', true).deathSaves.failures, 2);
  assert.equal(applyDamage(down, 12, 'force').dead, true);
});

test('damage waking magical sleep still leaves a zero HP hero unconscious from dying', () => {
  const asleep = hero();
  asleep.conditions.push({ id: 'unconscious', source: 'sleep' });
  const down = applyDamage(asleep, 12, 'force');
  assert.equal(down.hp.current, 0);
  assert.ok(
    down.conditions.some(
      (condition) =>
        condition.id === 'unconscious' && condition.source === 'dying',
    ),
  );
  assert.ok(!down.conditions.some((condition) => condition.source === 'sleep'));
});

test('death saves stabilize after three successes and one causes two failures', () => {
  let down = applyDamage(hero(), 12, 'force');
  down = deathSave(deathSave(deathSave(down, 10), 12), 19);
  assert.equal(down.deathSaves.stable, true);
  assert.equal(down.deathSaves.successes, 0);
  assert.equal(down.hp.current, 0);
  const failed = deathSave(applyDamage(hero(), 12, 'force'), 1);
  assert.equal(failed.deathSaves.failures, 2);
  assert.equal(deathSave(failed, 9).dead, true);
});

test('natural 20 death save recovers one hit point and healing resets dying', () => {
  const down = deathSave(applyDamage(hero(), 12, 'force'), 1);
  const awake = deathSave(down, 20);
  assert.equal(awake.hp.current, 1);
  assert.equal(awake.deathSaves.failures, 0);
  assert.ok(!awake.conditions.some((c) => c.id === 'unconscious'));
  const restored = heal(down, 99);
  assert.equal(restored.hp.current, 12);
  assert.equal(restored.deathSaves.failures, 0);
});

test('second wind heals costs a use and short rest recovers only one use', () => {
  let base = applyDamage(hero(), 10, 'force');
  base = secondWind(base, sequence(1));
  assert.equal(base.hp.current, 4);
  assert.equal(base.resources.secondWind.current, 1);
  base = secondWind(base, sequence(1));
  assert.equal(base.resources.secondWind.current, 0);
  assert.throws(() => secondWind(base, sequence(10)));
  const short = rest(base, { kind: 'short', hours: 1 }, sequence());
  assert.equal(short.resources.secondWind.current, 1);
  assert.equal(short.hp.current, 6);
});

test('short rest spending a hit die and arcane recovery do not grant unlimited healing or slots', () => {
  const mage = createCharacter(suggestCharacter('wizard'), 'mage');
  mage.hp.current = 1;
  assert.ok(mage.spellcasting);
  mage.spellcasting.slots.current = 0;
  const short = rest(
    mage,
    { kind: 'short', hours: 1, spendHitDie: true, arcaneRecovery: true },
    sequence(2),
  );
  assert.equal(short.hp.current, 5);
  assert.equal(short.hitDice.current, 0);
  assert.equal(short.spellcasting?.slots.current, 1);
  assert.equal(short.resources.arcaneRecovery.current, 0);
  assert.throws(() =>
    rest(short, { kind: 'short', hours: 1, spendHitDie: true }, sequence(6)),
  );
  assert.throws(() =>
    rest(short, { kind: 'short', hours: 1, arcaneRecovery: true }, sequence()),
  );
  assert.equal(
    rest(short, { kind: 'short', hours: 1 }, sequence()).spellcasting?.slots
      .current,
    1,
  );
});

test('long rest restores hit dice slots innate magic and has elf duration exception', () => {
  const mage = createCharacter(suggestCharacter('wizard'), 'mage');
  mage.hp.current = 1;
  mage.hitDice.current = 0;
  assert.ok(mage.spellcasting);
  mage.spellcasting.slots.current = 0;
  mage.innateMagic[0].remaining = 0;
  assert.throws(() => rest(mage, { kind: 'long', hours: 4 }, sequence()));
  const rested = rest(mage, { kind: 'long', hours: 8 }, sequence());
  assert.equal(rested.hp.current, 8);
  assert.equal(rested.hitDice.current, 1);
  assert.equal(rested.spellcasting?.slots.current, 2);
  assert.equal(rested.innateMagic[0].remaining, 1);
  const draft = suggestCharacter('wizard');
  draft.speciesId = 'high-elf';
  draft.elfSkill = 'survival';
  assert.equal(
    rest(createCharacter(draft, 'elf'), { kind: 'long', hours: 4 }, sequence())
      .hp.current,
    8,
  );
  assert.throws(() =>
    rest(
      applyDamage(hero(), 12, 'force'),
      { kind: 'long', hours: 8 },
      sequence(),
    ),
  );
  assert.throws(() =>
    rest(hero(), { kind: 'short', hours: 1, interrupted: true }, sequence()),
  );
});
