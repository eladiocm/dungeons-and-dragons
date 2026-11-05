import assert from 'node:assert/strict';
import test from 'node:test';
import { savingThrow } from '../src/game/battle-effects.ts';
import { createCharacter, suggestCharacter } from '../src/game/character.ts';
import { attack, createBattle, endTurn } from '../src/game/combat.ts';
import type { BattleResolution } from '../src/game/combat-types.ts';

const sequence = (...values: number[]) => {
  let n = 0;
  return () => {
    assert.ok(n < values.length, 'unexpected die');
    return values[n++];
  };
};
const hero = (id = 'fighter') =>
  createCharacter(suggestCharacter('fighter'), id);

test('critical greatsword doubles dice not modifier and great weapon style treats ones and twos as threes', () => {
  const draft = suggestCharacter('fighter');
  draft.fightingStyle = 'greatWeapon';
  const fighter = createCharacter(draft, 'fighter');
  const target = hero('target');
  target.hp = { current: 30, max: 30, temp: 0 };
  const before = createBattle([fighter, target], 'fighter');
  const result = attack(
    before,
    'fighter',
    'target',
    { weaponId: 'greatsword' },
    sequence(20, 1, 2, 1, 2),
  );
  assert.equal(result.state.actors.target.hp.current, 15);
  assert.equal(result.attack?.critical, true);
  assert.equal(before.actors.target.hp.current, 30);
  assert.equal(result.state.budgets.fighter.action, false);
});

test('graze causes only ability damage on a miss when its mastery is selected', () => {
  const result = attack(
    createBattle([hero(), hero('target')], 'fighter'),
    'fighter',
    'target',
    { weaponId: 'greatsword', useMastery: true },
    sequence(2),
  );
  assert.equal(result.attack?.success, false);
  assert.equal(result.state.actors.target.hp.current, 9);
});

test('range possession action budget and target visibility are checked before rolling', () => {
  const before = createBattle([hero(), hero('target')], 'fighter');
  assert.throws(() =>
    attack(
      before,
      'fighter',
      'target',
      { weaponId: 'magic-sword' },
      sequence(),
    ),
  );
  before.positions.target = { x: 20, y: 0 };
  assert.throws(() =>
    attack(before, 'fighter', 'target', { weaponId: 'greatsword' }, sequence()),
  );
  before.positions.target = { x: 1.5, y: 0 };
  before.cover.target = 100;
  assert.throws(() =>
    attack(before, 'fighter', 'target', { weaponId: 'greatsword' }, sequence()),
  );
  before.cover.target = 0;
  before.budgets.fighter.action = false;
  assert.throws(() =>
    attack(before, 'fighter', 'target', { weaponId: 'greatsword' }, sequence()),
  );
  assert.equal(before.actors.target.hp.current, 12);
});

test('rogue sneak attack requires legal conditions and adds its dice only once per turn', () => {
  const rogue = createCharacter(suggestCharacter('rogue'), 'rogue');
  rogue.conditions.push({ id: 'invisible', source: 'hiding' });
  const state = createBattle([rogue, hero('target')], 'rogue');
  state.positions.target = { x: 9, y: 0 };
  const result = attack(
    state,
    'rogue',
    'target',
    { weaponId: 'shortbow', sneakAttack: true },
    sequence(5, 15, 2, 4),
  );
  assert.equal(result.state.actors.target.hp.current, 3);
  assert.equal(result.state.budgets.rogue.sneakAttackUsed, true);
  assert.ok(
    !result.state.actors.rogue.conditions.some((c) => c.source === 'hiding'),
  );
  const after = result.state.actors.rogue;
  assert.ok('inventory' in after);
  assert.equal(
    after.inventory.find((i) => i.catalogId === 'arrows20')?.quantity,
    19,
  );
});

test('savage attacker rolls only weapon damage twice and respects declared choice', () => {
  const state = createBattle([hero(), hero('target')], 'fighter');
  const result = attack(
    state,
    'fighter',
    'target',
    { weaponId: 'flail', savageAttacker: true },
    sequence(12, 1, 6),
  );
  assert.equal(result.state.actors.target.hp.current, 3);
  assert.equal(result.state.budgets.fighter.savageAttackerUsed, true);
});

test('sap makes the next attack disadvantageous and is consumed by that attack', () => {
  const state = createBattle([hero(), hero('target')], 'fighter');
  const hit = attack(
    state,
    'fighter',
    'target',
    { weaponId: 'flail', useMastery: true },
    sequence(12, 1),
  );
  assert.ok(hit.state.actors.target.conditions.some((c) => c.id === 'sap'));
  const next = endTurn(hit.state, 'fighter');
  const reply = attack(
    next,
    'target',
    'fighter',
    { weaponId: 'greatsword' },
    sequence(3, 18),
  );
  assert.deepEqual(reply.attack?.dice, [3, 18]);
  assert.equal(reply.attack?.used, 3);
  assert.ok(!reply.state.actors.target.conditions.some((c) => c.id === 'sap'));
});

test('nick light attack uses a different light weapon once without spending bonus action', () => {
  const rogue = createCharacter(suggestCharacter('rogue'), 'rogue');
  const state = createBattle([rogue, hero('target')], 'rogue');
  const first = attack(
    state,
    'rogue',
    'target',
    { weaponId: 'shortsword' },
    sequence(12, 1),
  );
  const second = attack(
    first.state,
    'rogue',
    'target',
    { weaponId: 'dagger', offhand: true, useMastery: true },
    sequence(12, 2),
  );
  assert.equal(second.state.actors.target.hp.current, 6);
  assert.equal(second.state.budgets.rogue.bonus, true);
  assert.throws(() =>
    attack(
      second.state,
      'rogue',
      'target',
      { weaponId: 'dagger', offhand: true, useMastery: true },
      sequence(),
    ),
  );
});

test('topple checks Constitution against the attacker mastery DC instead of automatically knocking prone', () => {
  const draft = suggestCharacter('fighter');
  draft.weaponMasteries = ['quarterstaff', 'greatsword', 'flail'];
  const fighter = createCharacter(draft, 'fighter');
  fighter.inventory.push({
    id: 'staff',
    catalogId: 'quarterstaff',
    name: 'Bastón',
    quantity: 1,
    weight: 2,
  });
  const state = createBattle([fighter, hero('target')], 'fighter');
  const hit = attack(
    state,
    'fighter',
    'target',
    { weaponId: 'quarterstaff', useMastery: true },
    sequence(12, 1, 2),
  );
  assert.ok(hit.state.actors.target.conditions.some((c) => c.id === 'prone'));
});

test('turn change preserves reaction windows and resets per-turn attack features for all participants', () => {
  const state = createBattle([hero(), hero('target')], 'fighter');
  state.budgets.fighter.sneakAttackUsed = true;
  state.budgets.target.reaction = false;
  const next = endTurn(state, 'fighter');
  assert.equal(next.activeId, 'target');
  assert.equal(next.budgets.target.action, true);
  assert.equal(next.budgets.target.reaction, true);
  assert.equal(next.budgets.fighter.sneakAttackUsed, false);
  assert.throws(() => endTurn(next, 'fighter'));
});

test('sap expires at the start of its attacker next turn', () => {
  const hit = attack(
    createBattle([hero(), hero('target')], 'fighter'),
    'fighter',
    'target',
    { weaponId: 'flail', useMastery: true },
    sequence(12, 1),
  );
  const next = endTurn(endTurn(hit.state, 'fighter'), 'target');
  assert.ok(!next.actors.target.conditions.some((c) => c.id === 'sap'));
});

test('species saving throw benefits apply to their actual effects', () => {
  const draft = suggestCharacter('fighter');
  draft.speciesId = 'dwarf';
  const dwarf = createCharacter(draft, 'dwarf');
  const result: BattleResolution = {
    state: createBattle([dwarf], 'dwarf'),
    rolls: [],
    facts: [],
  };
  assert.equal(
    savingThrow(result, 'dwarf', 'con', 15, sequence(1, 12), {
      effect: 'poison',
    }),
    true,
  );
  const elfDraft = suggestCharacter('fighter');
  elfDraft.speciesId = 'high-elf';
  elfDraft.elfSkill = 'insight';
  const elf = createCharacter(elfDraft, 'elf');
  const elven: BattleResolution = {
    state: createBattle([elf], 'elf'),
    rolls: [],
    facts: [],
  };
  assert.equal(
    savingThrow(elven, 'elf', 'wis', 30, sequence(), {
      effect: 'magicalSleep',
    }),
    true,
  );
});
