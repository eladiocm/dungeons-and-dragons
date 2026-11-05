import { SCENES } from './adventure.ts';
import { effectiveAc, isHero } from './battle-effects.ts';
import { ITEMS } from './catalog.ts';
import type { GameSession, SceneId } from './session-types.ts';
import { type CharacterState, RuleError } from './types.ts';

export const MODULE_ITEMS: Record<
  string,
  { name: string; weight: number; mission?: boolean }
> = {
  'amber-lens': { name: 'Lente de ámbar', weight: 0.5, mission: true },
  'cellar-key': { name: 'Llave de la cámara', weight: 0.1, mission: true },
};
export function getHero(state: GameSession, id: string): CharacterState {
  const actor = state.battle.actors[id];
  if (
    !actor ||
    !isHero(actor) ||
    !state.participants.some((p) => p.characterId === id)
  )
    throw new RuleError('Ese personaje no pertenece a la partida.', 403);
  return actor;
}
export function giveItem(hero: CharacterState, id: string, quantity = 1): void {
  const definition = Object.hasOwn(ITEMS, id) ? ITEMS[id] : MODULE_ITEMS[id];
  if (
    !definition ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 100
  )
    throw new RuleError('Botín no válido.');
  const existing = hero.inventory.find((item) => item.catalogId === id);
  if (existing) existing.quantity += quantity;
  else
    hero.inventory.push({
      id: `${hero.id}:${id}`,
      catalogId: id,
      name: definition.name,
      weight: definition.weight,
      quantity,
      ...(id === 'amber-lens' || id === 'cellar-key' ? { mission: true } : {}),
    });
}
export function fact(state: GameSession, text: string): void {
  if (!state.world.facts.includes(text)) state.world.facts.push(text);
  if (state.world.facts.length > 80) state.world.facts.splice(3, 1);
}
export function currentNpcIds(state: GameSession): string[] {
  return Object.keys(state.world.npcLocations).filter(
    (id) => state.world.npcLocations[id] === state.world.sceneId,
  );
}
export function isPresent(state: GameSession, id: string): boolean {
  return (
    state.participants.some((p) => p.characterId === id) ||
    state.participants.some((p) =>
      getHero(state, p.characterId).inventory.some(
        (item) =>
          item.quantity > 0 && (item.id === id || item.catalogId === id),
      ),
    ) ||
    state.world.npcLocations[id] === state.world.sceneId ||
    Boolean(
      state.world.objects[id]?.sceneId === state.world.sceneId &&
        state.world.objects[id].visible &&
        state.world.objects[id].state !== 'taken',
    )
  );
}
export function checkEnding(state: GameSession): void {
  if (state.ending) return;
  const heroes = state.participants.map((p) => getHero(state, p.characterId));
  const lens =
    heroes.some((hero) =>
      hero.inventory.some(
        (item) => item.catalogId === 'amber-lens' && item.quantity > 0,
      ),
    ) || state.world.flags.beaconLit;
  const rescued = Boolean(
    state.world.flags.siraRescued && !state.battle.actors.sira?.dead,
  );
  const completion: Record<string, boolean> = {
    lens: Boolean(lens),
    rescue: rescued,
    beacon: Boolean(state.world.flags.beaconLit),
  };
  for (const goal of state.world.objectives) {
    if (!Object.hasOwn(completion, goal.id))
      throw new RuleError('Objetivo de aventura no válido.');
    goal.complete = completion[goal.id];
  }
  if (heroes.every((hero) => hero.dead))
    state.ending = {
      kind: 'death',
      title: 'Tu última guardia',
      epilogue:
        'Tu personaje ha muerto. Las decisiones de esta aventura permanecen en el diario, pero su camino termina aquí. La suerte del faro y de Valdumbría queda marcada por lo que alcanzaste a hacer.',
    };
  else if (state.world.flags.lensDestroyed)
    state.ending = {
      kind: 'failure',
      title: 'Fragmentos de ámbar',
      epilogue:
        'La lente queda destruida. Sin ella no puedes reactivar el faro antes de la llegada de la niebla. Tu personaje sobrevive, pero esta decisión pone fin a la misión.',
    };
  else if (state.world.time >= state.world.deadline)
    state.ending = {
      kind: 'failure',
      title: 'La noche sin faro',
      epilogue:
        'La niebla alcanza Valdumbría antes de que puedas devolver la luz al faro. Los vecinos abandonan sus casas y buscan refugio en las colinas. Sobrevives, pero la misión ha fracasado; las personas a las que ayudaste recordarán tus decisiones.',
    };
  else if (state.world.flags.beaconLit)
    state.ending = {
      kind: 'victory',
      quality: rescued ? 'complete' : 'partial',
      title: rescued ? 'La luz vuelve al valle' : 'Una luz entre pérdidas',
      epilogue: rescued
        ? 'La lente de ámbar enciende el faro y la niebla retrocede. Sira vuelve contigo a Valdumbría; las campanas ya no anuncian peligro, sino el regreso de sus dos viajeros. Has cumplido la misión y rescatado a la aprendiz.'
        : 'La luz del faro atraviesa la niebla y salva Valdumbría. Has cumplido el objetivo principal, aunque Sira no ha regresado a salvo. La victoria deja una ausencia que el pueblo no olvidará.',
    };
  if (state.ending) {
    state.status = 'ended';
    state.battle.inCombat = false;
    state.phase = 'exploration';
  }
}
export function advanceTime(state: GameSession, rounds: number): void {
  state.world.time += rounds;
  state.battle.time = state.world.time;
  for (const actor of Object.values(state.battle.actors)) {
    actor.conditions = actor.conditions.filter(
      (c) => c.expires === undefined || c.expires > state.world.time,
    );
    if (isHero(actor)) {
      actor.ac = effectiveAc(actor);
      for (const item of actor.inventory)
        item.conditions = item.conditions?.filter(
          (c) => c.expires === undefined || c.expires > state.world.time,
        );
    }
  }
  for (const object of Object.values(state.battle.objects))
    object.conditions = object.conditions.filter(
      (c) => c.expires === undefined || c.expires > state.world.time,
    );
  for (const object of Object.values(state.world.objects))
    object.conditions = object.conditions?.filter(
      (c) => c.expires === undefined || c.expires > state.world.time,
    );
  checkEnding(state);
}
export function setScene(state: GameSession, destination: SceneId): void {
  if (!Object.hasOwn(SCENES, destination))
    throw new RuleError('Lugar no disponible.');
  state.world.sceneId = destination;
  state.world.sceneRevision++;
  if (!state.world.visited.includes(destination))
    state.world.visited.push(destination);
  state.battle.inCombat = false;
  state.phase = 'exploration';
  for (const p of state.participants)
    state.battle.positions[p.characterId] = { x: 0, y: 0 };
  currentNpcIds(state).forEach((id, i) => {
    state.battle.positions[id] = { x: 3 + i * 1.5, y: 0 };
  });
  state.battle.objects = Object.fromEntries(
    Object.values(state.world.objects)
      .filter(
        (o) => o.sceneId === destination && o.visible && o.state !== 'taken',
      )
      .map((o, i) => [
        o.id,
        {
          id: o.id,
          name: o.name,
          weight: o.weight,
          position: o.position || { x: 1.5 + i * 1.5, y: 0 },
          locked: o.locked,
          open: o.state === 'open',
          magical: o.id === 'lens',
          conditions: structuredClone(o.conditions || []),
        },
      ]),
  );
}
