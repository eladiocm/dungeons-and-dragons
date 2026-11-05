import type { D20Result } from './dice.ts';
import type { Combatant, Condition } from './types.ts';
export interface Position {
  x: number;
  y: number;
}
export interface ActionBudget {
  action: boolean;
  bonus: boolean;
  reaction: boolean;
  movement: number;
  objectInteraction: boolean;
  spellSlotSpent: boolean;
  sneakAttackUsed: boolean;
  savageAttackerUsed: boolean;
  lightAttackUsed: boolean;
  lastWeapon?: string;
}
export interface BattleState {
  actors: Record<string, Combatant>;
  positions: Record<string, Position>;
  cover: Record<string, 0 | 2 | 5 | 100>;
  teams: Record<string, string>;
  order: string[];
  activeId: string;
  round: number;
  time: number;
  inCombat: boolean;
  budgets: Record<string, ActionBudget>;
  turns: Record<string, number>;
  objects: Record<
    string,
    {
      id: string;
      name: string;
      position: Position;
      weight: number;
      lightSource?: 'torch' | 'candle' | 'campfire';
      locked?: boolean;
      open?: boolean;
      magical?: boolean;
      conditions: Condition[];
    }
  >;
}
export interface RollLog {
  groupId?: string;
  actorId: string;
  label: string;
  sides: number;
  values: number[];
}
export interface BattleResolution {
  state: BattleState;
  rolls: RollLog[];
  facts: string[];
  attack?: D20Result;
}
export interface AttackOptions {
  weaponId: string;
  ranged?: boolean;
  offhand?: boolean;
  twoHanded?: boolean;
  useMastery?: boolean;
  sneakAttack?: boolean;
  savageAttacker?: boolean;
  attackRoll?: D20Result;
}
