export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export type Ability = (typeof ABILITIES)[number];
export type Scores = Record<Ability, number>;
export type ClassId = 'fighter' | 'rogue' | 'cleric' | 'wizard';
export type SpeciesId = 'human' | 'dwarf' | 'halfling' | 'high-elf';
export type BackgroundId = 'acolyte' | 'criminal' | 'sage' | 'soldier';
export type DamageType =
  | 'slashing'
  | 'piercing'
  | 'bludgeoning'
  | 'fire'
  | 'cold'
  | 'lightning'
  | 'thunder'
  | 'acid'
  | 'poison'
  | 'necrotic'
  | 'radiant'
  | 'force'
  | 'psychic';
export type SkillId =
  | 'athletics'
  | 'acrobatics'
  | 'sleightOfHand'
  | 'stealth'
  | 'arcana'
  | 'history'
  | 'investigation'
  | 'nature'
  | 'religion'
  | 'animalHandling'
  | 'insight'
  | 'medicine'
  | 'perception'
  | 'survival'
  | 'deception'
  | 'intimidation'
  | 'performance'
  | 'persuasion';
export type FightingStyle = 'defense' | 'archery' | 'greatWeapon' | 'twoWeapon';
export type OriginFeat =
  | 'alert'
  | 'savageAttacker'
  | 'skilled'
  | 'magicCleric'
  | 'magicWizard';
export interface MagicChoice {
  source: 'background' | 'human';
  list: 'cleric' | 'wizard';
  ability: 'int' | 'wis' | 'cha';
  cantrips: string[];
  spell: string;
}
export interface CharacterDraft {
  name: string;
  classId: ClassId;
  speciesId: SpeciesId;
  backgroundId: BackgroundId;
  baseAbilities: Scores;
  boosts: Partial<Scores>;
  classSkills: SkillId[];
  replacements: SkillId[];
  expertise: SkillId[];
  equipment: 'A' | 'B';
  fightingStyle: FightingStyle;
  weaponMasteries: string[];
  cantrips: string[];
  spellbook: string[];
  prepared: string[];
  divineOrder: 'protector' | 'thaumaturge';
  humanFeat: OriginFeat;
  extraSkill: SkillId;
  skilledChoices: string[];
  elfSkill: 'perception' | 'insight' | 'survival';
  elfAbility: 'int' | 'wis' | 'cha';
  elfCantrip: string;
  magic: MagicChoice[];
  languages: string[];
  rogueLanguage: string;
  personality: string;
  alignment: string;
}
export interface Resource {
  current: number;
  max: number;
  shortRest?: number;
  longRest?: boolean;
}
export interface InventoryItem {
  id: string;
  catalogId: string;
  name: string;
  quantity: number;
  weight: number;
  equipped?: boolean;
  mission?: boolean;
}
export interface InnateMagic extends MagicChoice {
  remaining: number;
}
export interface Spellcasting {
  ability: Ability;
  cantrips: string[];
  book: string[];
  prepared: string[];
  slots: Resource;
}
export interface Condition {
  id: string;
  source?: string;
  expires?: number;
  saveAbility?: Ability;
  dc?: number;
  data?: Record<string, string | number | boolean>;
}
export interface CharacterState {
  id: string;
  name: string;
  classId: ClassId;
  speciesId: SpeciesId;
  backgroundId: BackgroundId;
  level: 1;
  abilities: Scores;
  proficiencies: SkillId[];
  expertise: SkillId[];
  skills: Record<SkillId, number>;
  saves: Ability[];
  tools: string[];
  languages: string[];
  features: string[];
  fightingStyle: FightingStyle;
  weaponMasteries: string[];
  hp: { current: number; max: number; temp: number };
  ac: number;
  speed: number;
  size: 'small' | 'medium';
  initiative: number;
  inspiration: boolean;
  hitDie: number;
  hitDice: Resource;
  resources: Record<string, Resource>;
  spellcasting?: Spellcasting;
  innateMagic: InnateMagic[];
  elfMagic?: { ability: Ability; cantrip: string };
  inventory: InventoryItem[];
  currency: number;
  resistances: DamageType[];
  immunities: string[];
  conditions: Condition[];
  deathSaves: { successes: number; failures: number; stable: boolean };
  dead: boolean;
  personality: string;
  alignment: string;
  xp: number;
}
export type Roller = (sides: number) => number;
export class RuleError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'RuleError';
    this.status = status;
  }
}
