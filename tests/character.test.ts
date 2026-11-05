import assert from 'node:assert/strict';
import test from 'node:test';
import { createCharacter, suggestCharacter } from '../src/game/character.ts';

test('fighter starts with legal level one defenses and both background and class equipment', () => {
  const hero = createCharacter(suggestCharacter('fighter'), 'hero');
  assert.equal(hero.hp.max, 12);
  assert.equal(hero.ac, 17);
  assert.equal(hero.abilities.str, 17);
  assert.equal(hero.abilities.con, 15);
  assert.equal(hero.currency, 18);
  assert.ok(hero.inventory.some((item) => item.catalogId === 'healers-kit'));
  assert.ok(hero.inventory.some((item) => item.catalogId === 'greatsword'));
  assert.equal(hero.resources.secondWind.current, 2);
  assert.equal(hero.level, 1);
  assert.ok(!hero.features.includes('actionSurge'));
});

test('wizard has two slots four prepared spells and six in the spellbook', () => {
  const hero = createCharacter(suggestCharacter('wizard'), 'mage');
  assert.equal(hero.hp.max, 8);
  assert.equal(hero.ac, 12);
  assert.equal(hero.spellcasting?.slots.max, 2);
  assert.equal(hero.spellcasting?.book.length, 6);
  assert.equal(hero.spellcasting?.prepared.length, 4);
  assert.equal(hero.spellcasting?.ability, 'int');
});

test('rogue receives expertise without adding proficiency twice', () => {
  const hero = createCharacter(suggestCharacter('rogue'), 'rogue');
  assert.equal(hero.skills.stealth, 7);
  assert.equal(hero.skills.perception, 3);
  assert.equal(hero.ac, 14);
  assert.equal(hero.hp.max, 10);
});

test('species changes actual health resources and feats', () => {
  const draft = suggestCharacter('fighter');
  draft.speciesId = 'dwarf';
  const dwarf = createCharacter(draft, 'dwarf');
  assert.equal(dwarf.hp.max, 13);
  assert.ok(dwarf.resistances.includes('poison'));
  assert.equal(dwarf.resources.stonecunning.current, 2);
  const human = createCharacter(suggestCharacter('fighter'), 'human');
  assert.ok(human.features.includes('alert'));
  assert.equal(human.initiative, 3);
});

test('creation rejects invalid array background boosts skills and unsupported magic', () => {
  const base = suggestCharacter('fighter');
  assert.throws(() => createCharacter({ ...base, name: '' }, 'x'));
  assert.throws(() =>
    createCharacter(
      { ...base, baseAbilities: { ...base.baseAbilities, str: 18 } },
      'x',
    ),
  );
  assert.throws(() => createCharacter({ ...base, boosts: { str: 3 } }, 'x'));
  assert.throws(() =>
    createCharacter({ ...base, boosts: { int: 2, cha: 1 } }, 'x'),
  );
  assert.throws(() =>
    createCharacter({ ...base, classSkills: ['athletics', 'athletics'] }, 'x'),
  );
  const wizard = suggestCharacter('wizard');
  assert.throws(() =>
    createCharacter({ ...wizard, prepared: ['fireball'] }, 'x'),
  );
  assert.throws(() =>
    createCharacter(
      { ...wizard, spellbook: [...wizard.spellbook, 'fireball'] },
      'x',
    ),
  );
});

test('cleric order changes defenses and cantrip count at level one', () => {
  const base = suggestCharacter('cleric');
  const protector = createCharacter(base, 'cleric');
  assert.equal(protector.ac, 15);
  assert.equal(protector.spellcasting?.prepared.length, 4);
  assert.ok(protector.features.includes('protector'));
  const thaumaturge = createCharacter(
    {
      ...base,
      divineOrder: 'thaumaturge',
      cantrips: ['guidance', 'sacredFlame', 'thaumaturgy', 'light'],
    },
    'cleric',
  );
  assert.equal(thaumaturge.spellcasting?.cantrips.length, 4);
  assert.equal(thaumaturge.skills.religion, 4);
});

test('duplicate skill sources require a valid replacement instead of losing an election', () => {
  const base = suggestCharacter('fighter');
  assert.throws(() =>
    createCharacter(
      { ...base, classSkills: ['athletics', 'perception'], replacements: [] },
      'x',
    ),
  );
  const hero = createCharacter(
    {
      ...base,
      classSkills: ['athletics', 'perception'],
      replacements: ['medicine'],
    },
    'x',
  );
  assert.ok(hero.proficiencies.includes('medicine'));
  assert.equal(hero.proficiencies.length, 5);
});
