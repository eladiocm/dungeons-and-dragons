import assert from 'node:assert/strict';
import test from 'node:test';
import { createCharacter, suggestCharacter } from '../src/game/character.ts';
import { newBudget } from '../src/game/combat.ts';
import { publicSession, startSession, transition } from '../src/game/engine.ts';
import { applyDamage } from '../src/game/rules.ts';
import type { ActionPlan, GameSession } from '../src/game/session-types.ts';
import { setScene } from '../src/game/session-utils.ts';

const sequence = (...values: number[]) => {
  let i = 0;
  return () => {
    assert.ok(i < values.length, 'unexpected dice');
    return values[i++];
  };
};
const initial = () =>
  startSession(
    'session',
    'person',
    createCharacter(suggestCharacter('fighter'), 'hero'),
  );
let command = 0;
const act = (state: GameSession, plan: ActionPlan) =>
  transition(
    state,
    {
      type: 'propose',
      id: `cmd-${++command}`,
      actorId: 'hero',
      text: 'Actúo',
      plan,
    },
    sequence(),
  );
const finish = (state: GameSession, ...dice: number[]) => {
  assert.ok(state.pending);
  const rolled = transition(
    state,
    {
      type: 'roll',
      id: `cmd-${++command}`,
      actorId: 'hero',
      pendingId: state.pending.id,
    },
    sequence(...dice),
  );
  assert.ok(rolled.pending);
  return transition(
    rolled,
    {
      type: 'accept',
      id: `cmd-${++command}`,
      actorId: 'hero',
      pendingId: rolled.pending.id,
    },
    sequence(),
  );
};

test('new session begins after creation with objective environment and a persistent scene', () => {
  const state = initial();
  assert.equal(state.world.sceneId, 'square');
  assert.equal(state.participants[0].characterId, 'hero');
  assert.equal(state.status, 'active');
  assert.ok(
    state.world.objectives.some(
      (goal) => goal.id === 'beacon' && !goal.complete,
    ),
  );
  assert.ok(state.messages[0].content.includes('faro'));
  assert.ok(state.messages[0].content.endsWith('?'));
  assert.equal(state.world.deadline, 3600);
  assert.equal(state.battle.inCombat, false);
});

test('free action prepared adventure can be completed socially without compulsory combat', () => {
  let state = initial();
  state = act(state, { kind: 'travel', destination: 'road' });
  state = act(state, { kind: 'travel', destination: 'mill' });
  state = finish(
    act(state, { kind: 'interact', targetId: 'bram', method: 'persuade' }),
    15,
  );
  assert.equal(state.world.flags.guardFriendly, true);
  state = act(state, { kind: 'travel', destination: 'chamber' });
  state = act(state, {
    kind: 'interact',
    targetId: 'release-lever',
    method: 'use',
  });
  state = act(state, { kind: 'interact', targetId: 'lens', method: 'take' });
  state = act(state, { kind: 'interact', targetId: 'sira', method: 'rescue' });
  state = act(state, { kind: 'travel', destination: 'mill' });
  state = act(state, { kind: 'travel', destination: 'beacon' });
  state = act(state, {
    kind: 'interact',
    targetId: 'beacon-mechanism',
    method: 'use',
  });
  assert.equal(state.status, 'ended');
  assert.equal(state.ending?.kind, 'victory');
  assert.equal(state.ending?.quality, 'complete');
  assert.ok(state.world.objectives.every((goal) => goal.complete));
  assert.throws(() => act(state, { kind: 'travel', destination: 'mill' }));
});

test('failed negotiation changes the scene but does not remove the only way forward', () => {
  let state = act(act(initial(), { kind: 'travel', destination: 'road' }), {
    kind: 'travel',
    destination: 'mill',
  });
  state = finish(
    act(state, { kind: 'interact', targetId: 'bram', method: 'persuade' }),
    1,
  );
  assert.equal(state.world.flags.guardFriendly, undefined);
  assert.ok(state.world.facts.some((fact) => fact.includes('ventana')));
  state = finish(
    act(state, { kind: 'interact', targetId: 'mill-window', method: 'sneak' }),
    15,
  );
  assert.equal(state.world.flags.windowAccess, true);
  assert.equal(
    act(state, { kind: 'travel', destination: 'chamber' }).world.sceneId,
    'chamber',
  );
});

test('pending rolls cannot be repeated and costs are committed only on acceptance', () => {
  let state = act(act(initial(), { kind: 'travel', destination: 'road' }), {
    kind: 'travel',
    destination: 'mill',
  });
  state = act(state, {
    kind: 'interact',
    targetId: 'bram',
    method: 'persuade',
  });
  assert.ok(state.pending);
  const rolled = transition(
    state,
    { type: 'roll', id: 'roll', actorId: 'hero', pendingId: state.pending.id },
    sequence(15),
  );
  assert.equal(rolled.world.flags.guardFriendly, undefined);
  assert.ok(rolled.pending?.preview?.state.world.flags.guardFriendly);
  assert.throws(() =>
    transition(
      rolled,
      {
        type: 'roll',
        id: 'another-roll',
        actorId: 'hero',
        pendingId: state.pending?.id || '',
      },
      sequence(20),
    ),
  );
  assert.throws(() => act(rolled, { kind: 'travel', destination: 'square' }));
  assert.ok(rolled.pending);
  const accepted = transition(
    rolled,
    {
      type: 'accept',
      id: 'accept',
      actorId: 'hero',
      pendingId: rolled.pending.id,
    },
    sequence(),
  );
  assert.equal(accepted.world.flags.guardFriendly, true);
});

test('inspiration rerolls one owned die and can be spent only once', () => {
  let state = act(act(initial(), { kind: 'travel', destination: 'road' }), {
    kind: 'travel',
    destination: 'mill',
  });
  state = act(state, {
    kind: 'interact',
    targetId: 'bram',
    method: 'persuade',
  });
  assert.ok(state.pending);
  state = transition(
    state,
    { type: 'roll', id: 'roll', actorId: 'hero', pendingId: state.pending.id },
    sequence(1),
  );
  assert.ok(state.pending);
  state = transition(
    state,
    {
      type: 'reroll',
      id: 'inspiration',
      actorId: 'hero',
      pendingId: state.pending.id,
      dieIndex: 0,
      source: 'inspiration',
    },
    sequence(15),
  );
  assert.ok(state.pending);
  assert.throws(() =>
    transition(
      state,
      {
        type: 'reroll',
        id: 'again',
        actorId: 'hero',
        pendingId: state.pending?.id || '',
        dieIndex: 0,
        source: 'inspiration',
      },
      sequence(20),
    ),
  );
  const done = transition(
    state,
    {
      type: 'accept',
      id: 'accept',
      actorId: 'hero',
      pendingId: state.pending.id,
    },
    sequence(),
  );
  const hero = done.battle.actors.hero;
  assert.ok('inspiration' in hero);
  assert.equal(hero.inspiration, false);
  assert.equal(done.world.flags.guardFriendly, true);
});

test('creative access is persisted through a validated operation without spawning possessions', () => {
  let state = act(act(initial(), { kind: 'travel', destination: 'road' }), {
    kind: 'travel',
    destination: 'mill',
  });
  state = finish(
    act(state, {
      kind: 'creative',
      description: 'Fijo mi cuerda a la ventana y busco otro acceso.',
      skill: 'athletics',
      dc: 10,
      onSuccess: [
        { type: 'access', from: 'mill', to: 'chamber', via: 'window' },
      ],
      onFailure: [],
    }),
    15,
  );
  assert.equal(state.world.flags.windowAccess, true);
  assert.throws(() =>
    act(state, {
      kind: 'creative',
      description: 'Aparece oro',
      onSuccess: [{ type: 'loot', targetId: 'imaginary-gold' }],
      onFailure: [],
    }),
  );
  assert.equal(
    act(state, { kind: 'travel', destination: 'chamber' }).world.sceneId,
    'chamber',
  );
});

test('loot cannot be collected twice and a mission cannot be won by a claim in prose', () => {
  let state = act(act(initial(), { kind: 'travel', destination: 'road' }), {
    kind: 'travel',
    destination: 'mill',
  });
  assert.throws(() =>
    act(state, { kind: 'interact', targetId: 'lens', method: 'take' }),
  );
  assert.throws(() =>
    act(state, {
      kind: 'creative',
      description: 'Ya gané',
      onSuccess: [
        { type: 'object', targetId: 'beacon-mechanism', state: 'active' },
      ],
      onFailure: [],
    }),
  );
  state = finish(
    act(state, { kind: 'interact', targetId: 'bram', method: 'persuade' }),
    15,
  );
  state = act(state, { kind: 'travel', destination: 'chamber' });
  state = act(state, {
    kind: 'interact',
    targetId: 'release-lever',
    method: 'use',
  });
  state = act(state, { kind: 'interact', targetId: 'lens', method: 'take' });
  assert.throws(() =>
    act(state, { kind: 'interact', targetId: 'lens', method: 'take' }),
  );
});

test('time and retreat have explicit surviving failure endings and death is distinct', () => {
  const timed = act(initial(), { kind: 'rest', rest: 'long' });
  assert.equal(timed.status, 'ended');
  assert.equal(timed.ending?.kind, 'failure');
  const retired = act(initial(), { kind: 'retreat' });
  assert.equal(retired.ending?.kind, 'retreat');
  const dead = initial();
  dead.battle.actors.hero.dead = true;
  dead.battle.actors.hero.hp.current = 0;
  const end = transition(
    dead,
    { type: 'sync', id: 'sync', actorId: 'hero' },
    sequence(),
  );
  assert.equal(end.ending?.kind, 'death');
});

test('public state omits Master secrets preview snapshots and internal RNG tape', () => {
  const state = initial();
  state.dmState.secrets = ['secret-test'];
  const view = publicSession(state);
  assert.ok(!JSON.stringify(view).includes('secret-test'));
  assert.ok(!('dmState' in view));
  assert.throws(() =>
    transition(
      state,
      {
        type: 'propose',
        id: 'other',
        actorId: 'bram',
        text: 'act',
        plan: { kind: 'retreat' },
      },
      sequence(),
    ),
  );
});

test('a declared melee attack approaches within movement and a defeated guard drops unique loot', () => {
  let state = act(act(initial(), { kind: 'travel', destination: 'road' }), {
    kind: 'travel',
    destination: 'mill',
  });
  state = finish(
    act(state, { kind: 'attack', targetId: 'bram', weaponId: 'greatsword' }),
    15,
    1,
    14,
    2,
    2,
  );
  assert.equal(state.battle.actors.bram.dead, true);
  assert.equal(state.battle.inCombat, false);
  assert.equal(state.battle.positions.hero.x, 1.5);
  state = act(state, { kind: 'interact', targetId: 'bram', method: 'take' });
  assert.equal(state.world.flags.doorKey, true);
  assert.throws(() =>
    act(state, { kind: 'interact', targetId: 'bram', method: 'take' }),
  );
  assert.equal(
    act(state, { kind: 'travel', destination: 'chamber' }).world.sceneId,
    'chamber',
  );
});

test('opportunity attack spends reaction instead of a main action and movement stays consumed', () => {
  let state = act(act(initial(), { kind: 'travel', destination: 'road' }), {
    kind: 'travel',
    destination: 'mill',
  });
  state = finish(
    act(state, { kind: 'attack', targetId: 'bram', weaponId: 'greatsword' }),
    15,
    1,
    2,
  );
  assert.equal(state.battle.budgets.bram.action, true);
  state = finish(act(state, { kind: 'move', x: -3, y: 0 }), 2);
  assert.equal(state.battle.budgets.bram.action, true);
  assert.equal(state.battle.budgets.bram.reaction, false);
  assert.equal(state.battle.budgets.hero.movement, 3);
});

test('player cannot reroll another actor die or inject a manufactured attack result', () => {
  let state = act(act(initial(), { kind: 'travel', destination: 'road' }), {
    kind: 'travel',
    destination: 'mill',
  });
  state = act(state, {
    kind: 'attack',
    targetId: 'bram',
    weaponId: 'greatsword',
  });
  assert.ok(state.pending);
  state = transition(
    state,
    {
      type: 'roll',
      id: 'roll-battle',
      actorId: 'hero',
      pendingId: state.pending.id,
    },
    sequence(15, 1, 14, 2, 2),
  );
  assert.ok(state.pending);
  assert.throws(() =>
    transition(
      state,
      {
        type: 'reroll',
        id: 'cheat',
        actorId: 'hero',
        pendingId: state.pending?.id || '',
        dieIndex: 1,
        source: 'inspiration',
      },
      sequence(20),
    ),
  );
  const clean = initial();
  assert.throws(() =>
    act(clean, {
      kind: 'attack',
      targetId: 'mara',
      weaponId: 'greatsword',
      attackRoll: { used: 20 },
    } as unknown as ActionPlan),
  );
});

test('death saves played through the engine reach a death ending without normal actions', () => {
  let state = initial();
  state.battle.actors.hero = applyDamage(state.battle.actors.hero, 12, 'force');
  assert.throws(() => act(state, { kind: 'travel', destination: 'road' }));
  state = finish(act(state, { kind: 'death' }), 1);
  assert.equal(state.battle.actors.hero.deathSaves.failures, 2);
  state = finish(act(state, { kind: 'death' }), 9);
  assert.equal(state.status, 'ended');
  assert.equal(state.ending?.kind, 'death');
});

test('destroying the mission lens causes an explicit surviving failure instead of an unwinnable loop', () => {
  let state = act(act(initial(), { kind: 'travel', destination: 'road' }), {
    kind: 'travel',
    destination: 'mill',
  });
  state = finish(
    act(state, { kind: 'interact', targetId: 'bram', method: 'persuade' }),
    15,
  );
  state = act(state, { kind: 'travel', destination: 'chamber' });
  state = act(state, {
    kind: 'creative',
    description: 'Rompo la lente deliberadamente.',
    onSuccess: [{ type: 'object', targetId: 'lens', state: 'broken' }],
    onFailure: [],
  });
  assert.equal(state.status, 'ended');
  assert.equal(state.ending?.kind, 'failure');
});

test('a spell does not pick up nearby quest loot unless the player actually uses Mage Hand to bring it', () => {
  let state = startSession(
    'mage',
    'person',
    createCharacter(suggestCharacter('wizard'), 'hero'),
  );
  state = act(act(state, { kind: 'travel', destination: 'road' }), {
    kind: 'travel',
    destination: 'mill',
  });
  state = finish(
    act(state, { kind: 'interact', targetId: 'bram', method: 'persuade' }),
    15,
  );
  state = act(state, { kind: 'travel', destination: 'chamber' });
  state = act(state, {
    kind: 'interact',
    targetId: 'release-lever',
    method: 'use',
  });
  state = act(state, { kind: 'move', x: 1.5, y: 0 });
  state = act(state, {
    kind: 'cast',
    spellId: 'mageArmor',
    targetIds: ['hero'],
  });
  const hero = state.battle.actors.hero;
  assert.ok('inventory' in hero);
  assert.ok(!hero.inventory.some((item) => item.catalogId === 'amber-lens'));
  state = act(state, {
    kind: 'cast',
    spellId: 'mageHand',
    targetIds: [],
    options: { objectId: 'lens', destination: { x: 1.5, y: 0 } },
  });
  const after = state.battle.actors.hero;
  assert.ok('inventory' in after);
  assert.ok(
    after.inventory.some(
      (item) => item.catalogId === 'amber-lens' && item.quantity === 1,
    ),
  );
});

test('Light can affect one carried object and remains on that object when travelling', () => {
  let state = startSession(
    'mage',
    'person',
    createCharacter(suggestCharacter('wizard'), 'hero'),
  );
  state = act(state, {
    kind: 'cast',
    spellId: 'light',
    targetIds: [],
    options: { objectId: 'hero:quarterstaff' },
  });
  state = act(state, { kind: 'travel', destination: 'road' });
  const hero = state.battle.actors.hero;
  assert.ok('inventory' in hero);
  const lit = hero.inventory.filter((item) =>
    item.conditions?.some((c) => c.id === 'light'),
  );
  assert.equal(lit.length, 1);
  assert.equal(lit[0].quantity, 1);
});

test('scene text and image direction stop showing rescued Sira and a removed lens', () => {
  let state = act(act(initial(), { kind: 'travel', destination: 'road' }), {
    kind: 'travel',
    destination: 'mill',
  });
  state = finish(
    act(state, { kind: 'interact', targetId: 'bram', method: 'persuade' }),
    15,
  );
  state = act(state, { kind: 'travel', destination: 'chamber' });
  state = act(state, {
    kind: 'interact',
    targetId: 'release-lever',
    method: 'use',
  });
  state = act(state, { kind: 'interact', targetId: 'lens', method: 'take' });
  state = act(state, { kind: 'interact', targetId: 'sira', method: 'rescue' });
  const view = publicSession(state);
  assert.ok(!view.battle.actors.sira);
  assert.ok(!view.scene.description.includes('está atrapada'));
  assert.ok(view.scene.imagePrompt.includes('empty'));
  const fresh = publicSession(initial());
  assert.ok(!fresh.battle.actors.sira);
  assert.ok(!fresh.world.objects.lens);
});

test('Sleep provides a real alternative: take the sleeping guard key and leave the encounter', () => {
  let state = startSession(
    'mage',
    'person',
    createCharacter(suggestCharacter('wizard'), 'hero'),
  );
  state = act(act(state, { kind: 'travel', destination: 'road' }), {
    kind: 'travel',
    destination: 'mill',
  });
  state = finish(
    act(state, { kind: 'cast', spellId: 'sleep', targetIds: ['bram'] }),
    15,
    1,
    1,
  );
  state = act(state, { kind: 'endTurn' });
  assert.ok(state.pending);
  state = transition(
    state,
    {
      type: 'roll',
      id: 'enemy-save',
      actorId: 'hero',
      pendingId: state.pending.id,
    },
    sequence(1),
  );
  assert.equal(publicSession(state).pending?.canInspire, false);
  assert.ok(state.pending);
  state = transition(
    state,
    {
      type: 'accept',
      id: 'accept-save',
      actorId: 'hero',
      pendingId: state.pending.id,
    },
    sequence(),
  );
  assert.ok(
    state.battle.actors.bram.conditions.some((c) => c.id === 'unconscious'),
  );
  state = act(state, { kind: 'interact', targetId: 'bram', method: 'take' });
  state = act(state, { kind: 'travel', destination: 'chamber' });
  assert.equal(state.world.sceneId, 'chamber');
  assert.equal(state.battle.inCombat, false);
});

test('an initiative won by another party member preserves their turn instead of failing the session', () => {
  let state = act(act(initial(), { kind: 'travel', destination: 'road' }), {
    kind: 'travel',
    destination: 'mill',
  });
  const ally = createCharacter(suggestCharacter('wizard'), 'ally');
  state.participants.push({
    participantId: 'second',
    characterId: 'ally',
    role: 'player',
  });
  state.battle.actors.ally = ally;
  state.battle.positions.ally = { x: 0, y: 1.5 };
  state.battle.budgets.ally = newBudget(ally);
  state.battle.turns.ally = 0;
  state = finish(
    act(state, { kind: 'attack', targetId: 'bram', weaponId: 'greatsword' }),
    2,
    20,
    1,
  );
  assert.equal(state.battle.activeId, 'ally');
  assert.equal(state.battle.budgets.hero.action, true);
  assert.equal(state.battle.actors.bram.hp.current, 6);
});

test('carried spell effects expire with world time and cannot return from stale inventory data', () => {
  let state = startSession(
    'mage',
    'person',
    createCharacter(suggestCharacter('wizard'), 'hero'),
  );
  state = act(state, {
    kind: 'cast',
    spellId: 'light',
    targetIds: [],
    options: { objectId: 'hero:quarterstaff' },
  });
  state = act(state, { kind: 'rest', rest: 'short' });
  const hero = state.battle.actors.hero;
  assert.ok('inventory' in hero);
  assert.ok(
    !hero.inventory.some((item) =>
      item.conditions?.some((c) => c.id === 'light'),
    ),
  );
});

test('lighting one equipped item in a stack transfers equipment to that single object', () => {
  let state = startSession(
    'mage',
    'person',
    createCharacter(suggestCharacter('wizard'), 'hero'),
  );
  const hero = state.battle.actors.hero;
  assert.ok('inventory' in hero);
  const daggers = hero.inventory.find((i) => i.catalogId === 'dagger');
  assert.ok(daggers);
  daggers.equipped = true;
  state = act(state, {
    kind: 'cast',
    spellId: 'light',
    targetIds: [],
    options: { objectId: daggers.id },
  });
  const after = state.battle.actors.hero;
  assert.ok('inventory' in after);
  const stacks = after.inventory.filter((i) => i.catalogId === 'dagger');
  assert.equal(stacks.filter((i) => i.equipped).length, 1);
  assert.ok(
    stacks.find((i) => i.equipped)?.conditions?.some((c) => c.id === 'light'),
  );
});

test('drinking a potion heals and permanently consumes one item from the same character', () => {
  let state = initial();
  state.battle.actors.hero.hp.current = 1;
  state = finish(act(state, { kind: 'item', itemId: 'healing-potion' }), 1, 1);
  const hero = state.battle.actors.hero;
  assert.ok('inventory' in hero);
  assert.equal(hero.hp.current, 5);
  assert.equal(
    hero.inventory.find((i) => i.catalogId === 'healing-potion')?.quantity,
    1,
  );
  state = finish(act(state, { kind: 'item', itemId: 'healing-potion' }), 1, 1);
  const after = state.battle.actors.hero;
  assert.ok('inventory' in after);
  assert.equal(
    after.inventory.find((i) => i.catalogId === 'healing-potion')?.quantity,
    0,
  );
  assert.throws(() => act(state, { kind: 'item', itemId: 'healing-potion' }));
});
test('damage from the lens mechanism requires a concentration save like combat damage', () => {
  let state = startSession(
    'mage',
    'person',
    createCharacter(suggestCharacter('wizard'), 'hero'),
  );
  state = act(state, {
    kind: 'cast',
    spellId: 'detectMagic',
    targetIds: ['hero'],
    options: { ritual: true },
  });
  setScene(state, 'chamber');
  state = finish(
    act(state, { kind: 'interact', targetId: 'lens', method: 'take' }),
    1,
    2,
    1,
  );
  assert.equal(state.battle.actors.hero.hp.current, 6);
  assert.ok(
    !state.battle.actors.hero.conditions.some((c) => c.id === 'concentrating'),
  );
  assert.equal(state.events.at(-1)?.rolls.length, 3);
});
test('an incapacitated guard cannot prevent movement by an impossible opportunity reaction', () => {
  const state = initial();
  setScene(state, 'mill');
  state.battle.inCombat = true;
  state.battle.activeId = 'hero';
  state.battle.actors.bram.conditions.push({
    id: 'incapacitated',
    source: 'sleep',
  });
  state.world.npcDisposition.bram = 'hostile';
  state.battle.positions.hero = { x: 1.5, y: 0 };
  state.battle.positions.bram = { x: 3, y: 0 };
  const after = act(state, { kind: 'move', x: -3, y: 0 });
  assert.equal(after.battle.positions.hero.x, -3);
  assert.equal(after.battle.actors.hero.hp.current, 12);
  assert.equal(after.battle.budgets.bram.reaction, true);
});

test('escaping Bram uses movement and his reaction but preserves the ongoing mission', () => {
  let state = initial();
  setScene(state, 'mill');
  state.battle.inCombat = true;
  state.battle.activeId = 'hero';
  state.world.npcDisposition.bram = 'hostile';
  state.battle.positions.hero = { x: 1.5, y: 0 };
  state.battle.positions.bram = { x: 3, y: 0 };
  state = finish(act(state, { kind: 'escape', destination: 'road' }), 15, 2);
  assert.equal(state.world.sceneId, 'road');
  assert.equal(state.status, 'active');
  assert.equal(state.battle.inCombat, false);
  assert.equal(state.battle.actors.hero.hp.current, 9);
  assert.equal(state.battle.budgets.bram.reaction, false);
  assert.equal(state.ending, undefined);
});
test('Disengage permits an escape without opportunity damage and cannot persist across ten minutes of travel', () => {
  let state = initial();
  setScene(state, 'mill');
  state.battle.inCombat = true;
  state.battle.activeId = 'hero';
  state.world.npcDisposition.bram = 'hostile';
  state.battle.positions.hero = { x: 1.5, y: 0 };
  state.battle.positions.bram = { x: 3, y: 0 };
  state = act(state, { kind: 'maneuver', maneuver: 'disengage' });
  state = act(state, { kind: 'escape', destination: 'road' });
  assert.equal(state.battle.actors.hero.hp.current, 12);
  assert.equal(state.status, 'active');
  assert.ok(
    !state.battle.actors.hero.conditions.some((c) => c.id === 'disengaging'),
  );
});
test('Bram stops combat with a fallen sole hero before stable recovery advances hours', () => {
  let state = initial();
  setScene(state, 'mill');
  state.battle.inCombat = true;
  state.battle.activeId = 'hero';
  state.world.npcDisposition.bram = 'hostile';
  state.battle.actors.hero.hp.current = 0;
  state.battle.actors.hero.conditions.push({
    id: 'unconscious',
    source: 'dying',
  });
  state.battle.actors.hero.deathSaves = {
    successes: 3,
    failures: 0,
    stable: true,
  };
  state = finish(act(state, { kind: 'death' }), 1);
  assert.equal(state.battle.inCombat, false);
  assert.equal(state.world.npcDisposition.bram, 'neutral');
  assert.equal(state.battle.actors.hero.hp.current, 1);
  assert.equal(state.world.time, 600);
  assert.equal(state.status, 'active');
});

test('escape advances away when Bram is still adjacent at the road exit', () => {
  let state = initial();
  setScene(state, 'mill');
  state.battle.inCombat = true;
  state.battle.activeId = 'hero';
  state.world.npcDisposition.bram = 'hostile';
  state.battle.positions.hero = { x: -6, y: 0 };
  state.battle.positions.bram = { x: -4.5, y: 0 };
  state = finish(act(state, { kind: 'escape', destination: 'road' }), 15, 2);
  assert.equal(state.world.sceneId, 'road');
  assert.equal(state.status, 'active');
});
