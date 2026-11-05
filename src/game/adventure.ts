import type { SceneId, WorldObject, WorldState } from './session-types.ts';
import type { NpcState, Scores } from './types.ts';

export const ADVENTURE = {
  id: 'last-light',
  title: 'La última luz de Valdumbría',
  description:
    'Recupera la lente de ámbar y devuelve la luz al faro antes de que la niebla alcance el pueblo. Una aventura original de misterio y fantasía para un personaje de nivel 1.',
  rulesNote:
    'Encuentros originales ajustados para una persona; no sustituyen el catálogo completo del SRD.',
};
export const SCENES: Record<
  SceneId,
  {
    title: string;
    description: string;
    imagePrompt: string;
    connections: SceneId[];
  }
> = {
  square: {
    title: 'El refugio de Valdumbría',
    description:
      'Lluvia sobre tejados de pizarra. La campana del faro suena, pero su luz se ha apagado. Mara, la guardiana del refugio, protege a los vecinos mientras una bruma azul se extiende por el camino.',
    imagePrompt:
      'Original dark fantasy storybook illustration, a rain-soaked medieval village square at dusk, warm amber refuge windows, silent distant lighthouse on a hill, blue mist on the road, atmospheric hand-painted landscape, no text or UI',
    connections: ['road'],
  },
  road: {
    title: 'El camino anegado',
    description:
      'Entre juncos y piedras cubiertas de musgo, el camino atraviesa la niebla. Un desvío conduce al viejo molino; entre los árboles se distingue la colina del faro.',
    imagePrompt:
      'Hand painted original fantasy landscape, flooded cobblestone path, moss and reeds, old windmill silhouette, amber lighthouse on a distant hill with its light extinguished, blue twilight fog, cinematic wide composition, no text',
    connections: ['square', 'mill'],
  },
  mill: {
    title: 'El molino sin viento',
    description:
      'Las aspas permanecen inmóviles. Bram vigila la entrada a una escalera que baja al mecanismo. Una ventana lateral conserva un marco firme, y bajo la puerta se filtra una luz de ámbar.',
    imagePrompt:
      'Hand painted atmospheric fantasy scene, abandoned stone windmill with motionless wooden blades, cautious weary watchman near a cellar door, sturdy side window and a faint amber glow from below, moonlit mist, no text',
    connections: ['road', 'chamber', 'beacon'],
  },
  chamber: {
    title: 'La cámara de los anillos',
    description:
      'Tres anillos de bronce rodean una lente de ámbar. Unas pinzas la mantienen sujeta a un mecanismo inestable. Una palanca marcada con una mano abierta sobresale junto al pedestal; Sira, la aprendiz, está atrapada bajo una viga caída.',
    imagePrompt:
      'Original fantasy storybook art, underground stone workshop, three bronze mechanical rings around a glowing amber lens, release lever, fallen wooden beam and a trapped apprentice, intricate machinery and warm light, no writing',
    connections: ['mill'],
  },
  beacon: {
    title: 'El faro del último umbral',
    description:
      'El pueblo apenas se distingue bajo la niebla. En lo alto del faro hay un alojamiento vacío con la forma de la lente y una manivela de bronce. El viento hace vibrar las campanas de advertencia.',
    imagePrompt:
      'Hand painted epic fantasy landscape, top of a stone lighthouse overlooking a mist-covered medieval valley, empty bronze lens mount and crank in foreground, last amber sunset and deep blue fog, dramatic hopeful mood, no text',
    connections: ['mill'],
  },
};
const object = (
  id: string,
  sceneId: SceneId,
  name: string,
  description: string,
  weight: number,
  options: Partial<WorldObject> = {},
): WorldObject => ({
  id,
  sceneId,
  name,
  description,
  weight,
  state: 'intact',
  visible: true,
  ...options,
});
export function initialWorld(): WorldState {
  const objects = [
    object(
      'village-map',
      'square',
      'Mapa del valle',
      'Muestra el camino al molino y del molino al faro.',
      0.1,
    ),
    object(
      'road-path',
      'road',
      'Sendero entre los juncos',
      'Un paso estrecho podría acortar el trayecto hasta la colina.',
      0,
    ),
    object(
      'mill-window',
      'mill',
      'Ventana lateral',
      'Su marco parece firme. Con una cuerda y cuidado podrías entrar por aquí.',
      20,
    ),
    object(
      'cellar-door',
      'mill',
      'Puerta de la cámara',
      'Bram lleva la llave. También existe la ventana lateral.',
      30,
      { locked: true },
    ),
    object(
      'release-lever',
      'chamber',
      'Palanca de liberación',
      'Una mano abierta señala que esta palanca suelta las pinzas antes de retirar la lente.',
      2,
    ),
    object(
      'lens',
      'chamber',
      'Lente de ámbar',
      'El cristal debe retirarse cuando las pinzas estén abiertas; forzarlo puede activar el mecanismo.',
      0.5,
      { locked: true, loot: 'amber-lens' },
    ),
    object(
      'beacon-mechanism',
      'beacon',
      'Mecanismo del faro',
      'El alojamiento necesita la lente de ámbar. Después bastará girar la manivela.',
      100,
    ),
  ];
  return {
    sceneId: 'square',
    sceneRevision: 1,
    time: 0,
    deadline: 3600,
    lastLongRestAt: -9600,
    visited: ['square'],
    facts: [
      'El faro necesita su lente de ámbar.',
      'La niebla alcanzará Valdumbría en seis horas.',
      'Sira, la aprendiz, fue al antiguo molino.',
    ],
    flags: {},
    objectives: [
      { id: 'lens', title: 'Recuperar la lente de ámbar', complete: false },
      { id: 'rescue', title: 'Ayudar a Sira, la aprendiz', complete: false },
      {
        id: 'beacon',
        title: 'Reactivar el faro antes de que llegue la niebla',
        complete: false,
      },
    ],
    objects: Object.fromEntries(objects.map((o) => [o.id, o])),
    npcLocations: { mara: 'square', bram: 'mill', sira: 'chamber' },
    npcDisposition: { mara: 'friendly', bram: 'neutral', sira: 'friendly' },
  };
}
const scores: Scores = { str: 12, dex: 12, con: 10, int: 10, wis: 10, cha: 10 };
function npc(id: string, name: string, hp: number, ac: number): NpcState {
  return {
    kind: 'npc',
    id,
    name,
    abilities: { ...scores },
    hp: { current: hp, max: hp, temp: 0 },
    ac,
    speed: 9,
    size: 'medium',
    initiative: 1,
    features: [],
    immunities: [],
    saveBonuses: {},
    resistances: [],
    conditions: [],
    deathSaves: { successes: 0, failures: 0, stable: false },
    dead: false,
    attacks: [],
  };
}
export function adventureNpcs(): NpcState[] {
  const bram = npc('bram', 'Bram', 6, 12);
  bram.attacks = [
    {
      id: 'club',
      name: 'Garrote',
      bonus: 3,
      dice: [1, 4],
      modifier: 1,
      type: 'bludgeoning',
      range: 1.5,
    },
  ];
  return [npc('mara', 'Mara', 9, 10), bram, npc('sira', 'Sira', 4, 10)];
}
export const OPENING = `La campana de Valdumbría repica entre la lluvia. El faro que protege el valle se ha apagado y una niebla azul avanza hacia las primeras casas. Mara te recibe bajo el alero del refugio: «La lente de ámbar ha desaparecido. Sira fue a buscarla al molino y no ha vuelto».

Tu objetivo es recuperar la lente y reactivar el faro antes de que la niebla alcance el pueblo, dentro de seis horas. Ayudar a Sira también puede cambiar el destino de esta noche. Puedes investigar, conversar, buscar otro camino o afrontar el peligro: tú eliges cómo hacerlo.

Antes de partir, Mara pone a tu disposición dos pociones de curación y una bolsa de componentes; son provisiones de esta aventura para un viajero en solitario. El mapa está extendido junto a la puerta. ¿Qué quieres averiguar o preparar antes de salir?`;
