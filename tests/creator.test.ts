import assert from 'node:assert/strict';
import test from 'node:test';
import { BACKGROUNDS, CLASSES, SPECIES } from '../src/game/catalog.ts';
import { createCharacter, suggestCharacter } from '../src/game/character.ts';
import { recommendChoices } from '../src/game/creator-choices.ts';
import type { BackgroundId, ClassId, SpeciesId } from '../src/game/types.ts';

test('recommended creation stays legal for every offered class species and background', () => {
  for (const classId of Object.keys(CLASSES) as ClassId[])
    for (const speciesId of Object.keys(SPECIES) as SpeciesId[])
      for (const backgroundId of Object.keys(BACKGROUNDS) as BackgroundId[]) {
        const draft = recommendChoices({
          ...suggestCharacter(classId),
          speciesId,
          backgroundId,
        });
        const hero = createCharacter(draft, 'hero');
        assert.equal(hero.classId, classId);
        assert.equal(hero.backgroundId, backgroundId);
        assert.equal(
          new Set(hero.proficiencies).size,
          hero.proficiencies.length,
        );
      }
});
