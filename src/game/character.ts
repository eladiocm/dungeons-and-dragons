import {
  ARMOR,
  BACKGROUNDS,
  CLASS_ITEMS,
  CLASSES,
  FEATS,
  ITEMS,
  LANGUAGES,
  PACKS,
  SKILLS,
  SPECIES,
  SPELLS,
  STYLES,
  TOOLS,
  WEAPONS,
} from './catalog.ts';
import {
  ABILITIES,
  type Ability,
  type BackgroundId,
  type CharacterDraft,
  type CharacterState,
  type ClassId,
  type InventoryItem,
  type MagicChoice,
  RuleError,
  type Scores,
  type SkillId,
} from './types.ts';

export const modifier = (score: number) => Math.floor((score - 10) / 2);
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new RuleError(message);
}
function select<T extends string>(
  value: unknown,
  choices: Record<T, unknown>,
  label: string,
): T {
  requireValue(
    typeof value === 'string' && Object.hasOwn(choices, value),
    `Elige ${label} del catálogo.`,
  );
  return value as T;
}
function list(
  value: unknown,
  count: number,
  choices: readonly string[],
  label: string,
): string[] {
  requireValue(
    Array.isArray(value) &&
      value.length === count &&
      new Set(value).size === count &&
      value.every((v) => typeof v === 'string' && choices.includes(v)),
    `Revisa ${label}: necesitas ${count} elecciones diferentes y válidas.`,
  );
  return [...value];
}
export function suggestCharacter(classId: ClassId): CharacterDraft {
  const builds: Record<
    ClassId,
    {
      scores: Scores;
      background: BackgroundId;
      boosts: Partial<Scores>;
      skills: SkillId[];
    }
  > = {
    fighter: {
      scores: { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 },
      background: 'soldier',
      boosts: { str: 2, con: 1 },
      skills: ['perception', 'survival'],
    },
    rogue: {
      scores: { str: 8, dex: 15, con: 14, int: 13, wis: 12, cha: 10 },
      background: 'criminal',
      boosts: { dex: 2, int: 1 },
      skills: ['acrobatics', 'perception', 'investigation', 'persuasion'],
    },
    cleric: {
      scores: { str: 13, dex: 10, con: 14, int: 8, wis: 15, cha: 12 },
      background: 'acolyte',
      boosts: { wis: 2, cha: 1 },
      skills: ['medicine', 'persuasion'],
    },
    wizard: {
      scores: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 },
      background: 'sage',
      boosts: { int: 2, con: 1 },
      skills: ['investigation', 'insight'],
    },
  };
  requireValue(Object.hasOwn(builds, classId), 'Clase no disponible.');
  const build = builds[classId];
  return {
    name: 'Aren',
    classId,
    speciesId: 'human',
    humanSize: 'medium',
    backgroundId: build.background,
    baseAbilities: { ...build.scores },
    boosts: { ...build.boosts },
    classSkills: [...build.skills],
    replacements: [],
    expertise: classId === 'rogue' ? ['stealth', 'sleightOfHand'] : [],
    equipment: 'A',
    fightingStyle: 'defense',
    weaponMasteries:
      classId === 'fighter'
        ? ['greatsword', 'flail', 'javelin']
        : classId === 'rogue'
          ? ['dagger', 'shortbow']
          : [],
    cantrips:
      classId === 'cleric'
        ? ['guidance', 'sacredFlame', 'thaumaturgy']
        : classId === 'wizard'
          ? ['light', 'mageHand', 'rayOfFrost']
          : [],
    spellbook:
      classId === 'wizard'
        ? [
            'mageArmor',
            'featherFall',
            'detectMagic',
            'sleep',
            'thunderwave',
            'magicMissile',
          ]
        : [],
    prepared:
      classId === 'cleric'
        ? ['bless', 'cureWounds', 'shieldOfFaith', 'guidingBolt']
        : classId === 'wizard'
          ? ['mageArmor', 'sleep', 'thunderwave', 'magicMissile']
          : [],
    divineOrder: 'protector',
    humanFeat: classId === 'rogue' ? 'savageAttacker' : 'alert',
    extraSkill:
      classId === 'fighter' || classId === 'rogue' ? 'insight' : 'perception',
    skilledChoices: ['nature', 'deception', 'performance'],
    elfSkill: 'perception',
    elfAbility: 'int',
    elfCantrip: 'prestidigitation',
    magic:
      classId === 'cleric'
        ? [
            {
              source: 'background',
              list: 'cleric',
              ability: 'wis',
              cantrips: ['light', 'thaumaturgy'],
              spell: 'healingWord',
            },
          ]
        : classId === 'wizard'
          ? [
              {
                source: 'background',
                list: 'wizard',
                ability: 'int',
                cantrips: ['prestidigitation', 'mageHand'],
                spell: 'featherFall',
              },
            ]
          : [],
    languages: ['Elfo', 'Enano'],
    rogueLanguage: 'Goblin',
    personality: '',
    alignment: 'Neutral bueno',
  };
}
export function weaponProficient(
  character: Pick<CharacterState, 'classId' | 'features'>,
  weaponId: string,
): boolean {
  const weapon = WEAPONS[weaponId];
  if (!weapon) return false;
  return (
    !weapon.martial ||
    character.classId === 'fighter' ||
    character.features.includes('protector') ||
    (character.classId === 'rogue' && Boolean(weapon.finesse || weapon.light))
  );
}
export function armorClass(
  hero: Pick<
    CharacterState,
    | 'abilities'
    | 'inventory'
    | 'classId'
    | 'features'
    | 'fightingStyle'
    | 'conditions'
  >,
): number {
  const armor = hero.inventory.find(
    (item) => item.equipped && ARMOR[item.catalogId],
  );
  const dex = modifier(hero.abilities.dex);
  const mageArmor = hero.conditions.some(
    (condition) => condition.id === 'mageArmor',
  );
  let ac = (mageArmor ? 13 : 10) + dex;
  if (armor) {
    const rule = ARMOR[armor.catalogId];
    ac = rule.base + Math.min(dex, rule.dexCap ?? Number.POSITIVE_INFINITY);
  }
  if (
    hero.inventory.some((item) => item.equipped && item.catalogId === 'shield')
  )
    ac += 2;
  if (armor && hero.classId === 'fighter' && hero.fightingStyle === 'defense')
    ac++;
  if (hero.conditions.some((condition) => condition.id === 'shieldOfFaith'))
    ac += 2;
  return ac;
}
function inventory(ids: string[], heroId: string): InventoryItem[] {
  const rows = new Map<string, InventoryItem>();
  for (const id of ids.flatMap((id) => PACKS[id] || [id])) {
    const def = ITEMS[id] || WEAPONS[id] || ARMOR[id];
    requireValue(def, `Objeto no disponible: ${id}.`);
    const old = rows.get(id);
    const quantity = 'quantity' in def ? (def.quantity as number) : 1;
    if (old) old.quantity += quantity;
    else
      rows.set(id, {
        id: `${heroId}:${id}`,
        catalogId: id,
        name: def.name,
        quantity,
        weight: def.weight,
      });
  }
  return [...rows.values()];
}
export function createCharacter(input: unknown, id: string): CharacterState {
  requireValue(record(input), 'Ficha no válida.');
  const classId = select(input.classId, CLASSES, 'una clase');
  const speciesId = select(input.speciesId, SPECIES, 'una especie');
  const backgroundId = select(input.backgroundId, BACKGROUNDS, 'un trasfondo');
  requireValue(
    typeof input.name === 'string' &&
      input.name.trim().length >= 1 &&
      input.name.trim().length <= 40 &&
      !/[\p{Cc}]/u.test(input.name),
    'El nombre debe tener entre 1 y 40 caracteres.',
  );
  const cls = CLASSES[classId],
    background = BACKGROUNDS[backgroundId];
  requireValue(
    record(input.baseAbilities) &&
      ABILITIES.every((a) =>
        Number.isInteger((input.baseAbilities as Record<string, unknown>)[a]),
      ),
    'Reparte las seis características.',
  );
  const scores = input.baseAbilities as Scores;
  requireValue(
    ABILITIES.map((a) => scores[a])
      .sort((a, b) => a - b)
      .join(',') === '8,10,12,13,14,15',
    'Reparte una sola vez 15, 14, 13, 12, 10 y 8.',
  );
  requireValue(record(input.boosts), 'Elige los aumentos del trasfondo.');
  const entries = Object.entries(input.boosts).filter(([, v]) => v !== 0);
  requireValue(
    entries.every(
      ([a, v]) =>
        background.abilities.includes(a as Ability) &&
        Number.isInteger(v) &&
        (v === 1 || v === 2),
    ) &&
      (entries
        .map(([, v]) => v)
        .sort()
        .join(',') === '1,2' ||
        entries.map(([, v]) => v).join(',') === '1,1,1'),
    'El trasfondo permite +2/+1 o +1 a sus tres características.',
  );
  const abilities = Object.fromEntries(
    ABILITIES.map((a) => [
      a,
      scores[a] + ((input.boosts as Partial<Scores>)[a] || 0),
    ]),
  ) as Scores;
  const classSkills = list(
    input.classSkills,
    cls.skillCount,
    cls.skills,
    'las habilidades de clase',
  ) as SkillId[];
  requireValue(
    Array.isArray(input.replacements) &&
      input.replacements.length <= 10 &&
      input.replacements.every((skill) => Object.hasOwn(SKILLS, skill)),
    'Revisa las habilidades que sustituyen duplicados.',
  );
  const replacements = [...input.replacements] as SkillId[];
  const proficiencies: SkillId[] = [];
  const addSkill = (skill: SkillId) => {
    if (proficiencies.includes(skill)) {
      const replacement = replacements.shift();
      requireValue(
        replacement && !proficiencies.includes(replacement),
        'Elige una habilidad distinta para sustituir una competencia repetida.',
      );
      proficiencies.push(replacement);
    } else proficiencies.push(skill);
  };
  background.skills.forEach(addSkill);
  classSkills.forEach(addSkill);
  const tools = [
    background.tool,
    ...(classId === 'rogue' ? ['thieves-tools'] : []),
  ];
  const features = [...SPECIES[speciesId].features, background.feat];
  if (speciesId === 'human') {
    addSkill(select(input.extraSkill, SKILLS, 'la habilidad adicional humana'));
    const feat = select(input.humanFeat, FEATS, 'una dote de origen');
    requireValue(
      feat === 'skilled' || feat !== background.feat,
      'Esta dote no es repetible; elige otra.',
    );
    features.push(feat);
    if (feat === 'skilled')
      for (const choice of list(
        input.skilledChoices,
        3,
        [...Object.keys(SKILLS), ...Object.keys(TOOLS)],
        'Habilidoso',
      )) {
        if (Object.hasOwn(SKILLS, choice)) {
          requireValue(
            !proficiencies.includes(choice as SkillId),
            'Habilidoso necesita competencias nuevas.',
          );
          proficiencies.push(choice as SkillId);
        } else {
          requireValue(!tools.includes(choice), 'Elige una herramienta nueva.');
          tools.push(choice);
        }
      }
  }
  if (speciesId === 'high-elf')
    addSkill(
      select(
        input.elfSkill,
        { perception: 1, insight: 1, survival: 1 },
        'Sentidos agudos',
      ),
    );
  requireValue(
    replacements.length === 0,
    'Sobran sustituciones de competencia.',
  );
  const expertise = list(
    input.expertise,
    classId === 'rogue' ? 2 : 0,
    proficiencies,
    'las pericias',
  ) as SkillId[];
  const style =
    classId === 'fighter'
      ? select(input.fightingStyle, STYLES, 'un estilo de combate')
      : 'defense';
  if (classId === 'fighter')
    features.push('secondWind', 'weaponMastery', style);
  if (classId === 'rogue')
    features.push('sneakAttack', 'expertise', 'weaponMastery', 'thievesCant');
  if (classId === 'cleric')
    features.push(
      select(
        input.divineOrder,
        { protector: 1, thaumaturge: 1 },
        'una orden divina',
      ),
    );
  if (classId === 'wizard')
    features.push('ritualAdept', 'arcaneRecovery', 'arcaneFocus');
  const weaponMasteries = list(
    input.weaponMasteries,
    classId === 'fighter' ? 3 : classId === 'rogue' ? 2 : 0,
    Object.keys(WEAPONS).filter((weapon) =>
      weaponProficient({ classId, features }, weapon),
    ),
    'las maestrías',
  );
  requireValue(
    input.equipment === 'A' ||
      (classId === 'fighter' && input.equipment === 'B'),
    'Este catálogo permite paquetes de equipo A, o A/B para guerrero; compras por oro llegarán después.',
  );
  const pack = CLASS_ITEMS[classId][input.equipment];
  const items = inventory([...pack.items, ...background.items], id);
  const armor = items.find((item) => ARMOR[item.catalogId]);
  if (armor) armor.equipped = true;
  const shield = items.find((item) => item.catalogId === 'shield');
  if (shield) shield.equipped = true;
  const firstWeapon = items.find((item) => WEAPONS[item.catalogId]);
  if (firstWeapon) firstWeapon.equipped = true;
  const magicInputs = input.magic;
  requireValue(
    Array.isArray(magicInputs) && magicInputs.length <= 2,
    'Revisa las elecciones de Iniciado en la magia.',
  );
  const innateMagic = features
    .filter((feat) => feat === 'magicCleric' || feat === 'magicWizard')
    .map((feat, index) => {
      const source =
        index === 0 && background.feat === feat ? 'background' : 'human';
      const value = magicInputs.find(
        (v: unknown) => record(v) && v.source === source,
      );
      requireValue(
        record(value),
        'Completa los conjuros de tu dote de origen.',
      );
      const spellList = feat === 'magicCleric' ? 'cleric' : 'wizard';
      requireValue(
        value.list === spellList,
        'La dote debe usar su lista de conjuros.',
      );
      const ability = select(
        value.ability,
        { int: 1, wis: 1, cha: 1 },
        'una aptitud mágica',
      );
      const cantrips = list(
        value.cantrips,
        2,
        Object.keys(SPELLS).filter(
          (s) => SPELLS[s].level === 0 && SPELLS[s].lists.includes(spellList),
        ),
        'los dos trucos de la dote',
      );
      requireValue(
        typeof value.spell === 'string' &&
          SPELLS[value.spell]?.level === 1 &&
          SPELLS[value.spell].lists.includes(spellList),
        'El conjuro de la dote debe ser de nivel 1 y de su lista.',
      );
      return {
        source,
        list: spellList,
        ability,
        cantrips,
        spell: value.spell,
        remaining: 1,
      } satisfies MagicChoice & { remaining: number };
    });
  requireValue(
    magicInputs.length === innateMagic.length,
    'Sobran elecciones de magia de origen.',
  );
  const magicClass =
    classId === 'wizard' || classId === 'cleric' ? classId : null;
  const cantripCount = magicClass
    ? features.includes('thaumaturge')
      ? 4
      : 3
    : 0;
  const cantrips = list(
    input.cantrips,
    cantripCount,
    Object.keys(SPELLS).filter(
      (s) =>
        SPELLS[s].level === 0 &&
        magicClass &&
        SPELLS[s].lists.includes(magicClass),
    ),
    'los trucos de clase',
  );
  const book = list(
    input.spellbook,
    classId === 'wizard' ? 6 : 0,
    Object.keys(SPELLS).filter(
      (s) => SPELLS[s].level === 1 && SPELLS[s].lists.includes('wizard'),
    ),
    'el libro de conjuros',
  );
  const prepared = list(
    input.prepared,
    magicClass ? 4 : 0,
    classId === 'wizard'
      ? book
      : Object.keys(SPELLS).filter(
          (s) => SPELLS[s].level === 1 && SPELLS[s].lists.includes('cleric'),
        ),
    'los conjuros preparados',
  );
  let elfMagic: CharacterState['elfMagic'];
  if (speciesId === 'high-elf') {
    const ability = select(
      input.elfAbility,
      { int: 1, wis: 1, cha: 1 },
      'la aptitud de linaje',
    );
    requireValue(
      typeof input.elfCantrip === 'string' &&
        SPELLS[input.elfCantrip]?.level === 0 &&
        SPELLS[input.elfCantrip].lists.includes('wizard'),
      'Elige un truco de mago para el linaje élfico.',
    );
    elfMagic = { ability, cantrip: input.elfCantrip };
  }
  const languages = list(input.languages, 2, LANGUAGES, 'los idiomas');
  if (classId === 'rogue') {
    requireValue(
      typeof input.rogueLanguage === 'string' &&
        LANGUAGES.includes(input.rogueLanguage) &&
        !languages.includes(input.rogueLanguage),
      'Elige un idioma adicional distinto por Jerga de ladrones.',
    );
    languages.push(input.rogueLanguage, 'Jerga de ladrones');
  }
  const hp =
    cls.hitDie + modifier(abilities.con) + (speciesId === 'dwarf' ? 1 : 0);
  const skills = Object.fromEntries(
    Object.entries(SKILLS).map(([skill, rule]) => [
      skill,
      modifier(abilities[rule.ability]) +
        (expertise.includes(skill as SkillId)
          ? 4
          : proficiencies.includes(skill as SkillId)
            ? 2
            : 0) +
        (features.includes('thaumaturge') &&
        ['arcana', 'religion'].includes(skill)
          ? Math.max(1, modifier(abilities.wis))
          : 0),
    ]),
  ) as Record<SkillId, number>;
  const hero: CharacterState = {
    id,
    name: input.name.trim(),
    classId,
    speciesId,
    backgroundId,
    level: 1,
    abilities,
    proficiencies,
    expertise,
    skills,
    saves: [...cls.saves],
    tools: [...new Set(tools)],
    languages: ['Común', ...languages],
    features,
    fightingStyle: style,
    weaponMasteries,
    hp: { current: hp, max: hp, temp: 0 },
    ac: 0,
    speed:
      armor &&
      ARMOR[armor.catalogId].strength &&
      abilities.str < (ARMOR[armor.catalogId].strength || 0)
        ? 6
        : 9,
    size:
      speciesId === 'halfling'
        ? 'small'
        : speciesId === 'human'
          ? select(input.humanSize, { small: 1, medium: 1 }, 'el tamaño humano')
          : 'medium',
    initiative: modifier(abilities.dex) + (features.includes('alert') ? 2 : 0),
    inspiration: speciesId === 'human',
    hitDie: cls.hitDie,
    hitDice: { current: 1, max: 1, longRest: true },
    resources: {},
    ...(magicClass
      ? {
          spellcasting: {
            ability:
              magicClass === 'wizard' ? ('int' as const) : ('wis' as const),
            cantrips,
            book,
            prepared,
            slots: { current: 2, max: 2, longRest: true },
          },
        }
      : {}),
    innateMagic,
    elfMagic,
    inventory: items,
    currency: pack.gold + background.gold,
    resistances: speciesId === 'dwarf' ? ['poison'] : [],
    immunities: speciesId === 'high-elf' ? ['magicalSleep'] : [],
    conditions: [],
    deathSaves: { successes: 0, failures: 0, stable: false },
    dead: false,
    personality:
      typeof input.personality === 'string'
        ? input.personality.trim().slice(0, 600)
        : '',
    alignment:
      typeof input.alignment === 'string'
        ? input.alignment.trim().slice(0, 40)
        : 'Neutral',
    xp: 0,
  };
  if (classId === 'fighter')
    hero.resources.secondWind = {
      current: 2,
      max: 2,
      shortRest: 1,
      longRest: true,
    };
  if (classId === 'wizard')
    hero.resources.arcaneRecovery = { current: 1, max: 1, longRest: true };
  if (speciesId === 'dwarf')
    hero.resources.stonecunning = { current: 2, max: 2, longRest: true };
  hero.ac = armorClass(hero);
  return hero;
}
