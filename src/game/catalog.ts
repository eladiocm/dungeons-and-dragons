import type {
  Ability,
  BackgroundId,
  ClassId,
  DamageType,
  FightingStyle,
  OriginFeat,
  SkillId,
  SpeciesId,
} from './types.ts';

export const SKILLS: Record<SkillId, { name: string; ability: Ability }> = {
  athletics: { name: 'Atletismo', ability: 'str' },
  acrobatics: { name: 'Acrobacias', ability: 'dex' },
  sleightOfHand: { name: 'Juego de manos', ability: 'dex' },
  stealth: { name: 'Sigilo', ability: 'dex' },
  arcana: { name: 'Conocimiento arcano', ability: 'int' },
  history: { name: 'Historia', ability: 'int' },
  investigation: { name: 'Investigación', ability: 'int' },
  nature: { name: 'Naturaleza', ability: 'int' },
  religion: { name: 'Religión', ability: 'int' },
  animalHandling: { name: 'Trato con animales', ability: 'wis' },
  insight: { name: 'Perspicacia', ability: 'wis' },
  medicine: { name: 'Medicina', ability: 'wis' },
  perception: { name: 'Percepción', ability: 'wis' },
  survival: { name: 'Supervivencia', ability: 'wis' },
  deception: { name: 'Engaño', ability: 'cha' },
  intimidation: { name: 'Intimidación', ability: 'cha' },
  performance: { name: 'Interpretación', ability: 'cha' },
  persuasion: { name: 'Persuasión', ability: 'cha' },
};
export const ABILITY_NAMES: Record<Ability, string> = {
  str: 'Fuerza',
  dex: 'Destreza',
  con: 'Constitución',
  int: 'Inteligencia',
  wis: 'Sabiduría',
  cha: 'Carisma',
};
export const CLASSES: Record<
  ClassId,
  {
    name: string;
    description: string;
    hitDie: number;
    saves: Ability[];
    skills: SkillId[];
    skillCount: number;
    strength: string;
    limitation: string;
    page: string;
  }
> = {
  fighter: {
    name: 'Guerrero',
    description: 'Dominio de las armas y resistencia para afrontar el peligro.',
    hitDie: 10,
    saves: ['str', 'con'],
    skills: [
      'acrobatics',
      'athletics',
      'history',
      'intimidation',
      'perception',
      'insight',
      'persuasion',
      'survival',
      'animalHandling',
    ],
    skillCount: 2,
    strength: 'Armadura, maestrías y recuperación con Tomar aliento.',
    limitation: 'Sin magia de clase; cada turno y uso cuentan.',
    page: '62–63',
  },
  rogue: {
    name: 'Pícaro',
    description: 'Ingenio, sigilo y precisión para encontrar otra salida.',
    hitDie: 8,
    saves: ['dex', 'int'],
    skills: [
      'acrobatics',
      'athletics',
      'deception',
      'intimidation',
      'investigation',
      'sleightOfHand',
      'perception',
      'insight',
      'persuasion',
      'stealth',
    ],
    skillCount: 4,
    strength: 'Pericia en dos habilidades y Ataque furtivo.',
    limitation: 'El ataque furtivo exige condiciones; armadura ligera.',
    page: '86–87',
  },
  cleric: {
    name: 'Clérigo',
    description:
      'Magia divina, protección y una convicción que guía tus pasos.',
    hitDie: 8,
    saves: ['wis', 'cha'],
    skills: ['history', 'medicine', 'insight', 'persuasion', 'religion'],
    skillCount: 2,
    strength: 'Curación, conjuros y elección de Orden divina.',
    limitation: 'Espacios limitados y concentración en algunos conjuros.',
    page: '47–48',
  },
  wizard: {
    name: 'Mago',
    description: 'Un libro, estudio y magia arcana para cambiar lo posible.',
    hitDie: 6,
    saves: ['int', 'wis'],
    skills: [
      'arcana',
      'history',
      'investigation',
      'medicine',
      'nature',
      'insight',
      'religion',
    ],
    skillCount: 2,
    strength: 'Libro de conjuros, rituales y recuperación arcana.',
    limitation: 'Pocos puntos de golpe; preparar la magia es esencial.',
    page: '71–72',
  },
};
export const SPECIES: Record<
  SpeciesId,
  { name: string; description: string; features: string[]; page: string }
> = {
  human: {
    name: 'Humano',
    description:
      'Una habilidad y una dote de origen adicionales. Inspiración tras descansar.',
    features: ['resourceful', 'skillful', 'versatile'],
    page: '92',
  },
  dwarf: {
    name: 'Enano',
    description: 'Más vitalidad, visión en oscuridad y resistencia al veneno.',
    features: [
      'dwarvenToughness',
      'dwarvenResilience',
      'stonecunning',
      'darkvision36',
    ],
    page: '91',
  },
  halfling: {
    name: 'Mediano',
    description:
      'Pequeño y afortunado; valiente ante el miedo y hábil para ocultarse.',
    features: ['lucky', 'brave', 'halflingNimbleness', 'naturallyStealthy'],
    page: '92',
  },
  'high-elf': {
    name: 'Alto elfo',
    description: 'Un truco arcano, sentidos agudos y trance en lugar de sueño.',
    features: [
      'feyAncestry',
      'trance',
      'darkvision18',
      'keenSenses',
      'elvenLineage',
    ],
    page: '90–91',
  },
};
export const BACKGROUNDS: Record<
  BackgroundId,
  {
    name: string;
    abilities: Ability[];
    skills: SkillId[];
    tool: string;
    feat: OriginFeat;
    items: string[];
    gold: number;
  }
> = {
  acolyte: {
    name: 'Acólito',
    abilities: ['int', 'wis', 'cha'],
    skills: ['insight', 'religion'],
    tool: 'calligrapher',
    feat: 'magicCleric',
    items: [
      'calligrapher',
      'prayer-book',
      'parchment10',
      'holy-symbol',
      'robes',
    ],
    gold: 8,
  },
  criminal: {
    name: 'Criminal',
    abilities: ['dex', 'con', 'int'],
    skills: ['sleightOfHand', 'stealth'],
    tool: 'thieves-tools',
    feat: 'alert',
    items: [
      'dagger',
      'dagger',
      'thieves-tools',
      'crowbar',
      'pouch',
      'pouch',
      'travel-clothes',
    ],
    gold: 16,
  },
  sage: {
    name: 'Erudito',
    abilities: ['con', 'int', 'wis'],
    skills: ['arcana', 'history'],
    tool: 'calligrapher',
    feat: 'magicWizard',
    items: [
      'quarterstaff',
      'calligrapher',
      'history-book',
      'parchment8',
      'robes',
    ],
    gold: 8,
  },
  soldier: {
    name: 'Soldado',
    abilities: ['str', 'dex', 'con'],
    skills: ['athletics', 'intimidation'],
    tool: 'dice-set',
    feat: 'savageAttacker',
    items: [
      'spear',
      'shortbow',
      'arrows20',
      'quiver',
      'dice-set',
      'healers-kit',
      'travel-clothes',
    ],
    gold: 14,
  },
};
export const FEATS: Record<OriginFeat, { name: string; description: string }> =
  {
    alert: {
      name: 'Alerta',
      description:
        'Suma competencia a iniciativa; permite intercambio con un aliado dispuesto.',
    },
    savageAttacker: {
      name: 'Atacante salvaje',
      description:
        'Una vez por turno puedes tirar dos veces los dados de daño del arma y elegir.',
    },
    skilled: {
      name: 'Habilidoso',
      description:
        'Competencia en tres habilidades o herramientas de tu elección.',
    },
    magicCleric: {
      name: 'Iniciado en la magia: clérigo',
      description:
        'Dos trucos y un conjuro de nivel 1, un uso gratuito por descanso largo.',
    },
    magicWizard: {
      name: 'Iniciado en la magia: mago',
      description:
        'Dos trucos y un conjuro de nivel 1, un uso gratuito por descanso largo.',
    },
  };
export const STYLES: Record<FightingStyle, string> = {
  defense: 'Defensa',
  archery: 'Tiro con arco',
  greatWeapon: 'Combate con armas a dos manos',
  twoWeapon: 'Combate con dos armas',
};
export const LANGUAGES = [
  'Común de signos',
  'Dracónico',
  'Elfo',
  'Enano',
  'Gigante',
  'Gnomo',
  'Goblin',
  'Mediano',
  'Orco',
];
export const TOOLS: Record<string, string> = {
  calligrapher: 'Suministros de calígrafo',
  'thieves-tools': 'Herramientas de ladrón',
  'dice-set': 'Juego de dados',
};
export interface Weapon {
  name: string;
  dice: [number, number];
  type: DamageType;
  martial?: boolean;
  finesse?: boolean;
  light?: boolean;
  twoHanded?: boolean;
  heavy?: boolean;
  ranged?: boolean;
  range?: [number, number];
  thrown?: boolean;
  versatile?: number;
  mastery: 'graze' | 'sap' | 'nick' | 'vex' | 'slow' | 'topple';
  weight: number;
}
export const MASTERY_NAMES: Record<Weapon['mastery'], string> = {
  graze: 'Rozar',
  sap: 'Debilitar',
  nick: 'Mellar',
  vex: 'Molestar',
  slow: 'Ralentizar',
  topple: 'Derribar',
};
export const WEAPONS: Record<string, Weapon> = {
  greatsword: {
    name: 'Espadón',
    dice: [2, 6],
    type: 'slashing',
    martial: true,
    twoHanded: true,
    heavy: true,
    mastery: 'graze',
    weight: 3,
  },
  flail: {
    name: 'Mangual',
    dice: [1, 8],
    type: 'bludgeoning',
    martial: true,
    mastery: 'sap',
    weight: 1,
  },
  javelin: {
    name: 'Jabalina',
    dice: [1, 6],
    type: 'piercing',
    thrown: true,
    range: [9, 36],
    mastery: 'slow',
    weight: 1,
  },
  scimitar: {
    name: 'Cimitarra',
    dice: [1, 6],
    type: 'slashing',
    martial: true,
    finesse: true,
    light: true,
    mastery: 'nick',
    weight: 1.5,
  },
  shortsword: {
    name: 'Espada corta',
    dice: [1, 6],
    type: 'piercing',
    martial: true,
    finesse: true,
    light: true,
    mastery: 'vex',
    weight: 1,
  },
  longbow: {
    name: 'Arco largo',
    dice: [1, 8],
    type: 'piercing',
    martial: true,
    ranged: true,
    range: [45, 180],
    heavy: true,
    twoHanded: true,
    mastery: 'slow',
    weight: 1,
  },
  dagger: {
    name: 'Daga',
    dice: [1, 4],
    type: 'piercing',
    finesse: true,
    light: true,
    thrown: true,
    range: [6, 18],
    mastery: 'nick',
    weight: 0.5,
  },
  shortbow: {
    name: 'Arco corto',
    dice: [1, 6],
    type: 'piercing',
    ranged: true,
    range: [24, 96],
    twoHanded: true,
    mastery: 'vex',
    weight: 1,
  },
  mace: {
    name: 'Maza',
    dice: [1, 6],
    type: 'bludgeoning',
    mastery: 'sap',
    weight: 2,
  },
  quarterstaff: {
    name: 'Bastón',
    dice: [1, 6],
    type: 'bludgeoning',
    versatile: 8,
    mastery: 'topple',
    weight: 2,
  },
  spear: {
    name: 'Lanza',
    dice: [1, 6],
    type: 'piercing',
    thrown: true,
    range: [6, 18],
    versatile: 8,
    mastery: 'sap',
    weight: 1.5,
  },
};
export const ARMOR: Record<
  string,
  {
    name: string;
    base: number;
    dexCap?: number;
    strength?: number;
    stealth?: boolean;
    category: 'light' | 'medium' | 'heavy';
    weight: number;
  }
> = {
  chainmail: {
    name: 'Cota de malla',
    base: 16,
    dexCap: 0,
    strength: 13,
    stealth: true,
    category: 'heavy',
    weight: 27.5,
  },
  'studded-leather': {
    name: 'Cuero tachonado',
    base: 12,
    category: 'light',
    weight: 6.5,
  },
  leather: {
    name: 'Armadura de cuero',
    base: 11,
    category: 'light',
    weight: 5,
  },
  'chain-shirt': {
    name: 'Camisa de malla',
    base: 13,
    dexCap: 2,
    category: 'medium',
    weight: 10,
  },
};
export const ITEMS: Record<
  string,
  { name: string; weight: number; quantity?: number }
> = {
  'component-pouch': { name: 'Bolsa de componentes', weight: 1 },
  shield: { name: 'Escudo', weight: 3 },
  arrows20: { name: 'Flecha', quantity: 20, weight: 0.025 },
  quiver: { name: 'Aljaba', weight: 0.5 },
  'explorer-pack': { name: 'Mochila', weight: 2.5 },
  bedroll: { name: 'Saco de dormir', weight: 3.5 },
  mess: { name: 'Utensilios de cocina', weight: 0.5 },
  tinderbox: { name: 'Yesquero', weight: 0.5 },
  torch: { name: 'Antorcha', weight: 0.5 },
  ration: { name: 'Ración', weight: 1 },
  waterskin: { name: 'Odre con agua', weight: 2.5 },
  rope: { name: 'Cuerda (15 m)', weight: 2.5 },
  'holy-symbol': { name: 'Símbolo sagrado', weight: 0.5 },
  'prayer-book': { name: 'Libro de oraciones', weight: 2.5 },
  robes: { name: 'Túnica', weight: 2 },
  'travel-clothes': { name: 'Ropas de viaje', weight: 2 },
  'history-book': { name: 'Libro de historia', weight: 2.5 },
  parchment10: { name: 'Pergamino', quantity: 10, weight: 0.01 },
  parchment8: { name: 'Pergamino', quantity: 8, weight: 0.01 },
  calligrapher: { name: TOOLS.calligrapher, weight: 2.5 },
  'thieves-tools': { name: TOOLS['thieves-tools'], weight: 0.5 },
  'dice-set': { name: TOOLS['dice-set'], weight: 0 },
  crowbar: { name: 'Palanqueta', weight: 2.5 },
  pouch: { name: 'Bolsa', weight: 0.5 },
  'healers-kit': { name: 'Útiles de sanador', weight: 1.5 },
  spellbook: { name: 'Libro de conjuros', weight: 1.5 },
  'arcane-focus': { name: 'Canalizador arcano', weight: 0.5 },
  ink: { name: 'Tinta y pluma', weight: 0 },
  'healing-potion': { name: 'Poción de curación', weight: 0.25 },
  oil: { name: 'Frasco de aceite', weight: 0.5 },
  lamp: { name: 'Lámpara', weight: 0.5 },
  book: { name: 'Libro', weight: 2.5 },
  caltrops: { name: 'Abrojos', weight: 1 },
  bearings: { name: 'Bolas de metal', weight: 1 },
  bell: { name: 'Campana', weight: 0 },
  'hooded-lantern': { name: 'Linterna sorda', weight: 1 },
  candle: { name: 'Vela', weight: 0 },
  'holy-water': { name: 'Agua bendita', weight: 0.5 },
  blanket: { name: 'Manta', weight: 1.5 },
};
export const PACKS: Record<string, string[]> = {
  'dungeon-pack': [
    'caltrops',
    ...Array(10).fill('torch'),
    'waterskin',
    'rope',
    'oil',
    'oil',
    'explorer-pack',
    'crowbar',
    ...Array(10).fill('ration'),
    'tinderbox',
  ],
  'burglar-pack': [
    'bearings',
    'bell',
    'waterskin',
    'rope',
    ...Array(7).fill('oil'),
    'hooded-lantern',
    'explorer-pack',
    'crowbar',
    ...Array(5).fill('ration'),
    ...Array(10).fill('candle'),
    'tinderbox',
  ],
  'priest-pack': [
    'holy-water',
    'lamp',
    'blanket',
    'explorer-pack',
    ...Array(7).fill('ration'),
    'robes',
    'tinderbox',
  ],
  'scholar-pack': [
    ...Array(10).fill('oil'),
    'parchment10',
    'lamp',
    'book',
    'explorer-pack',
    'ink',
    'tinderbox',
  ],
};
export const SPELLS: Record<
  string,
  {
    name: string;
    level: 0 | 1;
    lists: ('cleric' | 'wizard')[];
    description: string;
    concentration?: boolean;
    ritual?: boolean;
    range: number;
    action: 'action' | 'bonus' | 'reaction' | 'minute';
    components: string;
    duration: number;
  }
> = {
  guidance: {
    name: 'Guía',
    level: 0,
    lists: ['cleric'],
    description:
      '1d4 a pruebas de una habilidad elegida; requiere concentración.',
    concentration: true,
    range: 1.5,
    action: 'action',
    components: 'VS',
    duration: 10,
  },
  sacredFlame: {
    name: 'Llama sagrada',
    level: 0,
    lists: ['cleric'],
    description:
      'Salvación de Destreza o 1d8 radiante; ignora cobertura parcial.',
    range: 18,
    action: 'action',
    components: 'VS',
    duration: 0,
  },
  thaumaturgy: {
    name: 'Taumaturgia',
    level: 0,
    lists: ['cleric'],
    description:
      'Manifestaciones menores: voz, llamas, sonidos o puertas sin cerrar.',
    range: 9,
    action: 'action',
    components: 'V',
    duration: 10,
  },
  light: {
    name: 'Luz',
    level: 0,
    lists: ['cleric', 'wizard'],
    description: 'Un objeto ilumina 6 m y otros 6 m de luz tenue.',
    range: 1.5,
    action: 'action',
    components: 'VM',
    duration: 600,
  },
  mageHand: {
    name: 'Mano de mago',
    level: 0,
    lists: ['wizard'],
    description: 'Mano espectral que mueve objetos de hasta 5 kg; no ataca.',
    range: 9,
    action: 'action',
    components: 'VS',
    duration: 10,
  },
  rayOfFrost: {
    name: 'Rayo de escarcha',
    level: 0,
    lists: ['wizard'],
    description:
      'Ataque a distancia: 1d8 frío y reduce velocidad en 3 m un turno.',
    range: 18,
    action: 'action',
    components: 'VS',
    duration: 1,
  },
  prestidigitation: {
    name: 'Prestidigitación',
    level: 0,
    lists: ['wizard'],
    description: 'Efectos sensoriales y manipulaciones menores sin daño.',
    range: 3,
    action: 'action',
    components: 'VS',
    duration: 600,
  },
  bless: {
    name: 'Bendición',
    level: 1,
    lists: ['cleric'],
    description: 'Hasta tres criaturas suman 1d4 a ataques y salvaciones.',
    concentration: true,
    range: 9,
    action: 'action',
    components: 'VSM',
    duration: 10,
  },
  cureWounds: {
    name: 'Curar heridas',
    level: 1,
    lists: ['cleric'],
    description: 'Al tocar: recupera 2d8 + modificador mágico de PG.',
    range: 1.5,
    action: 'action',
    components: 'VS',
    duration: 0,
  },
  shieldOfFaith: {
    name: 'Escudo de fe',
    level: 1,
    lists: ['cleric'],
    description: '+2 a CA de una criatura; concentración hasta 10 minutos.',
    concentration: true,
    range: 18,
    action: 'bonus',
    components: 'VSM',
    duration: 100,
  },
  guidingBolt: {
    name: 'Saeta guía',
    level: 1,
    lists: ['cleric'],
    description:
      'Ataque a distancia: 4d6 radiante; ventaja al siguiente ataque contra el objetivo.',
    range: 36,
    action: 'action',
    components: 'VS',
    duration: 1,
  },
  healingWord: {
    name: 'Palabra de curación',
    level: 1,
    lists: ['cleric'],
    description: 'Acción adicional: cura 2d4 + modificador mágico.',
    range: 18,
    action: 'bonus',
    components: 'V',
    duration: 0,
  },
  detectMagic: {
    name: 'Detectar magia',
    level: 1,
    lists: ['cleric', 'wizard'],
    description: 'Percibes magia cercana y su escuela, con límites físicos.',
    concentration: true,
    ritual: true,
    range: 9,
    action: 'action',
    components: 'VS',
    duration: 100,
  },
  mageArmor: {
    name: 'Armadura de mago',
    level: 1,
    lists: ['wizard'],
    description: 'Sin armadura: CA base 13 + Destreza durante 8 horas.',
    range: 1.5,
    action: 'action',
    components: 'VSM',
    duration: 4800,
  },
  featherFall: {
    name: 'Caída de pluma',
    level: 1,
    lists: ['wizard'],
    description: 'Reacción al caer: hasta cinco criaturas descienden sin daño.',
    range: 18,
    action: 'reaction',
    components: 'VM',
    duration: 10,
  },
  sleep: {
    name: 'Dormir',
    level: 1,
    lists: ['wizard'],
    description:
      'Esfera de 1,5 m: salvaciones de Sabiduría para incapacitar y después dormir.',
    concentration: true,
    range: 18,
    action: 'action',
    components: 'VSM',
    duration: 10,
  },
  thunderwave: {
    name: 'Ola atronadora',
    level: 1,
    lists: ['wizard'],
    description:
      'Cubo de 4,5 m: salvación de Constitución; 2d8 trueno y empuje 3 m si falla.',
    range: 4.5,
    action: 'action',
    components: 'VS',
    duration: 0,
  },
  magicMissile: {
    name: 'Proyectil mágico',
    level: 1,
    lists: ['wizard'],
    description:
      'Tres dardos que aciertan; cada uno inflige 1d4 + 1 de fuerza.',
    range: 36,
    action: 'action',
    components: 'VS',
    duration: 0,
  },
};
export const CLASS_ITEMS: Record<
  ClassId,
  Record<'A' | 'B', { items: string[]; gold: number }>
> = {
  fighter: {
    A: {
      items: [
        'chainmail',
        'greatsword',
        'flail',
        ...Array(8).fill('javelin'),
        'dungeon-pack',
      ],
      gold: 4,
    },
    B: {
      items: [
        'studded-leather',
        'scimitar',
        'shortsword',
        'longbow',
        'arrows20',
        'quiver',
        'dungeon-pack',
      ],
      gold: 11,
    },
  },
  rogue: {
    A: {
      items: [
        'leather',
        'dagger',
        'dagger',
        'shortsword',
        'shortbow',
        'arrows20',
        'quiver',
        'thieves-tools',
        'burglar-pack',
      ],
      gold: 8,
    },
    B: { items: [], gold: 100 },
  },
  cleric: {
    A: {
      items: ['chain-shirt', 'shield', 'mace', 'priest-pack', 'holy-symbol'],
      gold: 7,
    },
    B: { items: [], gold: 110 },
  },
  wizard: {
    A: {
      items: [
        'dagger',
        'dagger',
        'quarterstaff',
        'spellbook',
        'scholar-pack',
        'robes',
      ],
      gold: 5,
    },
    B: { items: [], gold: 55 },
  },
};
