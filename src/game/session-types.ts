import type { AttackOptions, BattleState, RollLog } from './combat-types.ts';
import type { SpellOptions } from './spells.ts';
import type { SkillId } from './types.ts';

export type SceneId = 'square' | 'road' | 'mill' | 'chamber' | 'beacon';
export interface WorldObject {
  position?: import('./combat-types.ts').Position;
  conditions?: import('./types.ts').Condition[];
  id: string;
  sceneId: SceneId;
  name: string;
  description: string;
  weight: number;
  state: 'intact' | 'open' | 'broken' | 'taken' | 'active' | 'lit';
  locked?: boolean;
  loot?: string;
  visible: boolean;
}
export interface WorldState {
  sceneId: SceneId;
  sceneRevision: number;
  time: number;
  deadline: number;
  lastLongRestAt: number;
  visited: SceneId[];
  facts: string[];
  flags: Record<string, boolean>;
  objectives: { id: string; title: string; complete: boolean }[];
  objects: Record<string, WorldObject>;
  npcLocations: Record<string, SceneId>;
  npcDisposition: Record<string, 'neutral' | 'friendly' | 'hostile'>;
}
export type WorldOperation =
  | { type: 'fact'; text: string }
  | { type: 'access'; from: SceneId; to: SceneId; via: 'window' | 'path' }
  | {
      type: 'disposition';
      targetId: string;
      value: 'friendly' | 'neutral' | 'hostile';
    }
  | {
      type: 'object';
      targetId: string;
      state: 'open' | 'broken' | 'lit' | 'active';
    }
  | { type: 'loot'; targetId: string };
export type ActionPlan =
  | { kind: 'travel'; destination: SceneId }
  | {
      kind: 'interact';
      targetId: string;
      method:
        | 'inspect'
        | 'talk'
        | 'persuade'
        | 'sneak'
        | 'force'
        | 'use'
        | 'take'
        | 'rescue';
    }
  | ({ kind: 'attack'; targetId: string } & Omit<AttackOptions, 'attackRoll'>)
  | {
      kind: 'cast';
      spellId: string;
      targetIds: string[];
      options?: Omit<SpellOptions, 'attackRoll'>;
    }
  | { kind: 'move'; x: number; y: number }
  | {
      kind: 'maneuver';
      maneuver:
        | 'dodge'
        | 'hide'
        | 'dash'
        | 'disengage'
        | 'stand'
        | 'search'
        | 'study'
        | 'help';
      targetId?: string;
    }
  | { kind: 'feature'; feature: 'secondWind' | 'stonecunning' }
  | { kind: 'item'; itemId: string; targetId?: string }
  | { kind: 'equip'; itemId: string; equipped: boolean }
  | {
      kind: 'rest';
      rest: 'short' | 'long';
      spendHitDie?: boolean;
      arcaneRecovery?: boolean;
    }
  | { kind: 'endTurn' }
  | { kind: 'retreat' }
  | { kind: 'death' }
  | {
      kind: 'creative';
      description: string;
      skill?: SkillId;
      dc?: number;
      onSuccess: WorldOperation[];
      onFailure: WorldOperation[];
    };
export interface CampaignMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sceneId?: string;
  imagePrompt?: string;
  eventId?: string;
  narrationPending?: boolean;
}
export interface CampaignEvent {
  id: string;
  sequence: number;
  actorId: string;
  type: string;
  facts: string[];
  rolls: RollLog[];
  sceneId: SceneId;
}
export interface Ending {
  kind: 'victory' | 'failure' | 'retreat' | 'death';
  quality?: 'complete' | 'partial';
  title: string;
  epilogue: string;
}
export interface TapeDie {
  sides: number;
  value: number;
  actorId: string;
  label: string;
  groupId: string;
}
export interface ActionResult {
  state: GameSession;
  facts: string[];
  rolls: RollLog[];
}
export interface PendingAction {
  id: string;
  plan: ActionPlan;
  actorId: string;
  label: string;
  base: GameSession;
  preview?: ActionResult;
  tape: TapeDie[];
  usedRerolls: ('inspiration' | 'lucky')[];
  luckyGroups: string[];
}
export interface GameSession {
  id: string;
  schemaVersion: 2;
  rulesetVersion: 'SRD-5.2.1';
  catalogVersion: 1;
  moduleVersion: 1;
  adventureMode: 'prepared';
  version: number;
  status: 'active' | 'ended';
  phase: 'exploration' | 'combat' | 'awaiting-roll' | 'awaiting-choice';
  participants: {
    participantId: string;
    characterId: string;
    role: 'player';
  }[];
  battle: BattleState;
  world: WorldState;
  dmState: { secrets: string[] };
  messages: CampaignMessage[];
  events: CampaignEvent[];
  pending?: PendingAction;
  ending?: Ending;
}
export type GameCommand = { id: string; actorId: string } & (
  | { type: 'propose'; text: string; plan: ActionPlan }
  | { type: 'roll' | 'accept' | 'cancel'; pendingId: string }
  | {
      type: 'reroll';
      pendingId: string;
      dieIndex: number;
      source: 'inspiration' | 'lucky';
    }
  | { type: 'sync' }
);
export interface PublicSession {
  id: string;
  version: number;
  status: GameSession['status'];
  phase: GameSession['phase'];
  adventureMode: 'prepared';
  rulesetVersion: string;
  participants: GameSession['participants'];
  battle: BattleState;
  world: WorldState;
  messages: CampaignMessage[];
  events: CampaignEvent[];
  ending?: Ending;
  pending?: {
    id: string;
    label: string;
    actionKind: ActionPlan['kind'];
    stage: 'unrolled' | 'rolled';
    rolls: RollLog[];
    dice: TapeDie[];
    canInspire: boolean;
    canLucky: boolean;
  };
  scene: {
    id: SceneId;
    title: string;
    description: string;
    imagePrompt: string;
    fallback: string;
    connections: SceneId[];
  };
}
