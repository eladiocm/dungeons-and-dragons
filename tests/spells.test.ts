import assert from 'node:assert/strict';
import test from 'node:test';
import { damageActor } from '../src/game/battle-effects.ts';
import { createCharacter, suggestCharacter } from '../src/game/character.ts';
import { createBattle } from '../src/game/combat.ts';
import { castSpell, spellEndTurn } from '../src/game/spells.ts';

const sequence = (...values: number[]) => {
  let n = 0;
  return () => {
    assert.ok(n < values.length, 'unexpected die');
    return values[n++];
  };
};
const cleric = () => createCharacter(suggestCharacter('cleric'), 'cleric');
const wizard = () => createCharacter(suggestCharacter('wizard'), 'wizard');
const target = () => createCharacter(suggestCharacter('fighter'), 'target');

test('Cure Wounds uses two d8 and the Wisdom modifier in the 2024 rules', () => {
  const victim = target();
  victim.hp.current = 1;
  const state = createBattle([cleric(), victim], 'cleric');
  const out = castSpell(
    state,
    'cleric',
    'cureWounds',
    ['target'],
    {},
    sequence(1, 2),
  );
  assert.equal(out.state.actors.target.hp.current, 7);
  const caster = out.state.actors.cleric;
  assert.ok('spellcasting' in caster);
  assert.equal(caster.spellcasting?.slots.current, 1);
  assert.equal(state.actors.target.hp.current, 1);
});

test('Magic Initiate free casting is separate from class slots and recharges separately', () => {
  const victim = target();
  victim.hp.current = 1;
  const state = createBattle([cleric(), victim], 'cleric');
  const out = castSpell(
    state,
    'cleric',
    'healingWord',
    ['target'],
    { source: 'background' },
    sequence(1, 2),
  );
  assert.equal(out.state.actors.target.hp.current, 7);
  const caster = out.state.actors.cleric;
  assert.ok('innateMagic' in caster);
  assert.equal(caster.innateMagic[0].remaining, 0);
  assert.equal(caster.spellcasting?.slots.current, 2);
  out.state.budgets.cleric.bonus = true;
  assert.throws(() =>
    castSpell(
      out.state,
      'cleric',
      'healingWord',
      ['target'],
      { source: 'background' },
      sequence(),
    ),
  );
  const paid = castSpell(
    out.state,
    'cleric',
    'healingWord',
    ['target'],
    { source: 'background', useSlot: true },
    sequence(1, 1),
  );
  const paidCaster = paid.state.actors.cleric;
  assert.ok('spellcasting' in paidCaster);
  assert.equal(paidCaster.spellcasting?.slots.current, 1);
});

test('unprepared magic invalid targets range and spent slots fail before consuming anything', () => {
  const state = createBattle([wizard(), target()], 'wizard');
  assert.throws(() =>
    castSpell(state, 'wizard', 'fireball', ['target'], {}, sequence()),
  );
  assert.throws(() =>
    castSpell(state, 'wizard', 'featherFall', ['target'], {}, sequence()),
  );
  state.positions.target = { x: 50, y: 0 };
  assert.throws(() =>
    castSpell(state, 'wizard', 'magicMissile', ['target'], {}, sequence()),
  );
  const caster = state.actors.wizard;
  assert.ok('spellcasting' in caster && caster.spellcasting);
  assert.equal(caster.spellcasting.slots.current, 2);
  caster.spellcasting.slots.current = 0;
  assert.throws(() =>
    castSpell(state, 'wizard', 'mageArmor', ['wizard'], {}, sequence()),
  );
});

test('Bless concentration is replaced by Shield of Faith without stacking armor bonuses', () => {
  const state = createBattle([cleric(), target()], 'cleric');
  const blessed = castSpell(
    state,
    'cleric',
    'bless',
    ['cleric', 'target'],
    {},
    sequence(),
  );
  assert.ok(
    blessed.state.actors.target.conditions.some((c) => c.id === 'bless'),
  );
  const next = spellEndTurn(
    spellEndTurn(blessed.state, 'cleric', sequence()).state,
    'target',
    sequence(),
  ).state;
  const shielded = castSpell(
    next,
    'cleric',
    'shieldOfFaith',
    ['target'],
    {},
    sequence(),
  );
  assert.equal(shielded.state.actors.target.ac, 19);
  assert.ok(
    !shielded.state.actors.target.conditions.some((c) => c.id === 'bless'),
  );
  assert.ok(
    shielded.state.actors.cleric.conditions.some(
      (c) => c.id === 'concentrating',
    ),
  );
});

test('only one spell slot may be spent on a turn even when another action remains', () => {
  const state = createBattle([cleric(), target()], 'cleric');
  const first = castSpell(
    state,
    'cleric',
    'cureWounds',
    ['target'],
    {},
    sequence(1, 1),
  );
  assert.throws(() =>
    castSpell(
      first.state,
      'cleric',
      'shieldOfFaith',
      ['target'],
      {},
      sequence(),
    ),
  );
});

test('Magic Missile rolls three dart damages and can divide them among visible targets', () => {
  const a = target();
  const b = target();
  b.id = 'second';
  const out = castSpell(
    createBattle([wizard(), a, b], 'wizard'),
    'wizard',
    'magicMissile',
    ['target', 'target', 'second'],
    {},
    sequence(1, 2, 3),
  );
  assert.equal(out.state.actors.target.hp.current, 7);
  assert.equal(out.state.actors.second.hp.current, 8);
});

test('Ray of Frost uses a spell attack and slows a surviving target', () => {
  const state = createBattle([wizard(), target()], 'wizard');
  state.positions.target = { x: 9, y: 0 };
  const out = castSpell(
    state,
    'wizard',
    'rayOfFrost',
    ['target'],
    {},
    sequence(12, 7),
  );
  assert.equal(out.state.actors.target.hp.current, 5);
  assert.ok(
    out.state.actors.target.conditions.some((c) => c.id === 'rayOfFrost'),
  );
});

test('Mage Armor sets the unarmored base and rejects an armored target', () => {
  const state = createBattle([wizard(), target()], 'wizard');
  const out = castSpell(
    state,
    'wizard',
    'mageArmor',
    ['wizard'],
    {},
    sequence(),
  );
  assert.equal(out.state.actors.wizard.ac, 15);
  assert.throws(() =>
    castSpell(state, 'wizard', 'mageArmor', ['target'], {}, sequence()),
  );
});

test('sleep requires two Wisdom failures and magical sleep cannot affect an elf', () => {
  const state = createBattle([wizard(), target()], 'wizard');
  state.positions.target = { x: 9, y: 0 };
  const out = castSpell(state, 'wizard', 'sleep', ['target'], {}, sequence(1));
  assert.ok(
    out.state.actors.target.conditions.some((c) => c.id === 'incapacitated'),
  );
  const next = spellEndTurn(out.state, 'wizard', sequence());
  const asleep = spellEndTurn(next.state, 'target', sequence(2));
  assert.ok(
    asleep.state.actors.target.conditions.some(
      (c) => c.id === 'unconscious' && c.source === 'sleep',
    ),
  );
  const draft = suggestCharacter('fighter');
  draft.speciesId = 'high-elf';
  draft.elfSkill = 'insight';
  const elf = createCharacter(draft, 'elf');
  const elves = createBattle([wizard(), elf], 'wizard');
  elves.positions.elf = { x: 9, y: 0 };
  const immune = castSpell(elves, 'wizard', 'sleep', ['elf'], {}, sequence());
  assert.ok(
    !immune.state.actors.elf.conditions.some((c) => c.source === 'sleep'),
  );
});

test('Thunderwave saves halve damage and failed saves push away three metres', () => {
  const state = createBattle([wizard(), target()], 'wizard');
  const out = castSpell(
    state,
    'wizard',
    'thunderwave',
    ['target'],
    {},
    sequence(2, 4, 3),
  );
  assert.equal(out.state.actors.target.hp.current, 6);
  assert.equal(out.state.positions.target.x, 4.5);
  assert.ok(out.facts.some((fact) => fact.includes('trueno')));
});

test('concentration damage save can end all dependent effects and dying ends it automatically', () => {
  const state = createBattle([cleric(), target()], 'cleric');
  const blessed = castSpell(
    state,
    'cleric',
    'bless',
    ['target'],
    {},
    sequence(),
  );
  damageActor(blessed, 'cleric', 1, 'force', sequence(1));
  assert.ok(
    !blessed.state.actors.target.conditions.some((c) => c.id === 'bless'),
  );
  const again = castSpell(state, 'cleric', 'bless', ['target'], {}, sequence());
  damageActor(again, 'cleric', 10, 'force', sequence());
  assert.ok(
    !again.state.actors.target.conditions.some((c) => c.id === 'bless'),
  );
});

test('ritual Detect Magic from wizard book costs time but neither preparation nor a slot', () => {
  const state = createBattle([wizard()], 'wizard');
  state.inCombat = false;
  const out = castSpell(
    state,
    'wizard',
    'detectMagic',
    ['wizard'],
    { ritual: true },
    sequence(),
  );
  assert.equal(out.state.time, 101);
  const caster = out.state.actors.wizard;
  assert.ok('spellcasting' in caster);
  assert.equal(caster.spellcasting?.slots.current, 2);
  assert.ok(caster.conditions.some((c) => c.id === 'detectMagic'));
  state.inCombat = true;
  assert.throws(() =>
    castSpell(
      state,
      'wizard',
      'detectMagic',
      ['wizard'],
      { ritual: true },
      sequence(),
    ),
  );
});

test('Guidance records the chosen skill and Light persists on an actual nearby object', () => {
  const state = createBattle([cleric()], 'cleric');
  const guide = castSpell(
    state,
    'cleric',
    'guidance',
    ['cleric'],
    { skill: 'athletics' },
    sequence(),
  );
  assert.equal(
    guide.state.actors.cleric.conditions.find((c) => c.id === 'guidance')?.data
      ?.skill,
    'athletics',
  );
  const withObject = createBattle([wizard()], 'wizard');
  withObject.objects.stone = {
    id: 'stone',
    name: 'Piedra',
    position: { x: 0, y: 0 },
    weight: 1,
    conditions: [],
  };
  const lit = castSpell(
    withObject,
    'wizard',
    'light',
    [],
    { objectId: 'stone' },
    sequence(),
  );
  assert.ok(lit.state.objects.stone.conditions.some((c) => c.id === 'light'));
});

test('Mage Hand moves only a reachable object within its weight limit', () => {
  const state = createBattle([wizard()], 'wizard');
  state.objects.key = {
    id: 'key',
    name: 'Llave',
    position: { x: 3, y: 0 },
    weight: 0.1,
    conditions: [],
  };
  const out = castSpell(
    state,
    'wizard',
    'mageHand',
    [],
    { objectId: 'key', destination: { x: 0, y: 0 } },
    sequence(),
  );
  assert.equal(out.state.objects.key.position.x, 0);
  state.objects.key.weight = 10;
  assert.throws(() =>
    castSpell(
      state,
      'wizard',
      'mageHand',
      [],
      { objectId: 'key', destination: { x: 0, y: 0 } },
      sequence(),
    ),
  );
});

test('Feather Fall is a reaction to an actual fall and can use the feat free cast', () => {
  const state = createBattle([wizard(), target()], 'wizard');
  assert.throws(() =>
    castSpell(
      state,
      'wizard',
      'featherFall',
      ['target'],
      { source: 'background' },
      sequence(),
    ),
  );
  state.actors.target.conditions.push({ id: 'falling' });
  const out = castSpell(
    state,
    'wizard',
    'featherFall',
    ['target'],
    { source: 'background' },
    sequence(),
  );
  assert.ok(
    out.state.actors.target.conditions.some((c) => c.id === 'featherFall'),
  );
  assert.equal(out.state.budgets.wizard.reaction, false);
});

test('Bless and Shield of Faith can target a known invisible creature but Healing Word requires sight', () => {
  const victim = target();
  victim.conditions.push({ id: 'invisible' });
  const state = createBattle([cleric(), victim], 'cleric');
  const blessed = castSpell(
    state,
    'cleric',
    'bless',
    ['target'],
    {},
    sequence(),
  );
  assert.ok(
    blessed.state.actors.target.conditions.some((c) => c.id === 'bless'),
  );
  assert.throws(() =>
    castSpell(
      state,
      'cleric',
      'healingWord',
      ['target'],
      { source: 'background' },
      sequence(),
    ),
  );
});

test('Sleep area can extend beyond casting range while its centre stays in range', () => {
  const state = createBattle([wizard(), target()], 'wizard');
  state.positions.target = { x: 19, y: 0 };
  const out = castSpell(
    state,
    'wizard',
    'sleep',
    ['target'],
    { point: { x: 18, y: 0 } },
    sequence(1),
  );
  assert.ok(
    out.state.actors.target.conditions.some((c) => c.id === 'incapacitated'),
  );
});

test('Detect Magic affects the caster and Feather Fall requires every selected target to be falling', () => {
  const state = createBattle([wizard(), target()], 'wizard');
  state.inCombat = false;
  assert.throws(() =>
    castSpell(
      state,
      'wizard',
      'detectMagic',
      ['target'],
      { ritual: true },
      sequence(),
    ),
  );
  state.actors.wizard.conditions.push({ id: 'falling' });
  assert.throws(() =>
    castSpell(
      state,
      'wizard',
      'featherFall',
      ['wizard', 'target'],
      { source: 'background' },
      sequence(),
    ),
  );
});

test('Thaumaturgy cannot ignite an arbitrary object and Mage Hand can open an unlocked door', () => {
  const state = createBattle([cleric()], 'cleric');
  state.objects.stone = {
    id: 'stone',
    name: 'Piedra',
    position: { x: 1, y: 0 },
    weight: 1,
    conditions: [],
  };
  assert.throws(() =>
    castSpell(
      state,
      'cleric',
      'thaumaturgy',
      [],
      { objectId: 'stone', minorAction: 'ignite' },
      sequence(),
    ),
  );
  const room = createBattle([wizard()], 'wizard');
  room.objects.door = {
    id: 'door',
    name: 'Puerta',
    position: { x: 3, y: 0 },
    weight: 30,
    conditions: [],
    open: false,
    locked: false,
  };
  const out = castSpell(
    room,
    'wizard',
    'mageHand',
    [],
    { objectId: 'door', minorAction: 'open' },
    sequence(),
  );
  assert.equal(out.state.objects.door.open, true);
});

test('losing concentration immediately updates armor shown on another actor', () => {
  const out = castSpell(
    createBattle([cleric(), target()], 'cleric'),
    'cleric',
    'shieldOfFaith',
    ['target'],
    {},
    sequence(),
  );
  assert.equal(out.state.actors.target.ac, 19);
  damageActor(out, 'cleric', 1, 'force', sequence(1));
  assert.equal(out.state.actors.target.ac, 17);
});

test('each Magic Missile dart causes a separate damage event for a dying hero', () => {
  const down = target();
  down.hp.current = 0;
  down.conditions.push({ id: 'unconscious', source: 'dying' });
  const out = castSpell(
    createBattle([wizard(), down], 'wizard'),
    'wizard',
    'magicMissile',
    ['target'],
    {},
    sequence(1, 1, 1),
  );
  assert.equal(out.state.actors.target.dead, true);
  assert.equal(out.state.actors.target.deathSaves.failures, 3);
});

test('Thaumaturgy voice grants an explicit Intimidation effect and keeps at most three selected effects', () => {
  let state = createBattle([cleric()], 'cleric');
  state.inCombat = false;
  const voice = castSpell(
    state,
    'cleric',
    'thaumaturgy',
    [],
    { minorAction: 'voice' },
    sequence(),
  );
  assert.ok(
    voice.state.actors.cleric.conditions.some(
      (c) => c.data?.skill === 'intimidation' && c.data?.advantage === true,
    ),
  );
  state = castSpell(
    voice.state,
    'cleric',
    'thaumaturgy',
    [],
    { minorAction: 'eyes' },
    sequence(),
  ).state;
  state = castSpell(
    state,
    'cleric',
    'thaumaturgy',
    [],
    { minorAction: 'tremor' },
    sequence(),
  ).state;
  assert.throws(() =>
    castSpell(
      state,
      'cleric',
      'thaumaturgy',
      [],
      { minorAction: 'flames' },
      sequence(),
    ),
  );
});
