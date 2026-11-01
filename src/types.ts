/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TroopType = 'shieldbearer' | 'shooter' | 'bomber';
export type ResourceType = 'wood' | 'steel' | 'copper' | 'diamond' | 'grain' | 'oil';
export type WeatherType = 'clear' | 'rain' | 'snow' | 'storm';
export type CultivationPath = 'qi' | 'body' | 'soul' | 'mind';
export type CultivationEra = 'mortal' | 'immortal_sage' | 'chaos_dao' | 'ultimate_origin';
export type KarmaAlignment = 'green_innocent' | 'white_neutral' | 'gold_justice' | 'red_fiend';
export type AuraVisualCueType =
  | 'none'
  | 'faint_white_glow'
  | 'spinning_golden_core'
  | 'floating_nascent_baby'
  | 'divine_halos';

export interface GameResources {
  wood: bigint;
  steel: bigint;
  copper: bigint;
  diamond: bigint;
  grain: bigint;
  oil: bigint;
}

export interface TroopTierInfo {
  tier: number; // 1 to 20
  type: TroopType;
  name: string;
  attack: bigint;
  defense: bigint;
  hp: bigint;
  speed: number;
  woodCost: bigint;
  steelCost: bigint;
  copperCost: bigint;
  grainCost: bigint;
  oilCost: bigint;
  diamondCost: bigint;
  powerPerUnit: bigint;
  description: string;
}

export interface CultivationRealmDef {
  id: string;
  path: CultivationPath;
  name: string;
  chineseName: string;
  era: CultivationEra;
  index: number; // 0 to 22
  totalLayers: 9;
  description: string;
  basePowerMultiplier: number;
  baseQiPerLayer: bigint;
  tribulationRounds: number;
  icon: string;
}

export interface CultivationPathProgress {
  realmIndex: number; // 0 to 22
  layer: number; // 1 to 9
  currentEnergy: bigint;
}

export interface PlayerKarmaState {
  karmaValue: number;
  alignment: KarmaAlignment;
  unlawfulKills: number;
  righteousKills: number;
  stationarySeconds: number;
  maxStationaryThresholdSec: number;
  bountySpiritStones: bigint;
  isLocationRevealed: boolean;
  lastLightningStrikeMsg: string | null;
  droppedLootHistory: string[];
}

export interface Disciple {
  id: string;
  name: string;
  chineseName: string;
  realmIndex: number;
  layer: number;
  loyalty: number;
  distanceMeters: number;
  baseSpiritStonesPerSec: bigint;
  baseQiPerSec: bigint;
  equippedSkills: string[];
}

export interface CultivationAuraVisualSpec {
  cueType: AuraVisualCueType;
  label: string;
  chineseLabel: string;
  description: string;
  primaryColorHex: string;
  secondaryColorHex: string;
  hdrPeakLuminanceNits: number;
  haloCount: number;
  hasTranslucentChestCore: boolean;
  hasFloatingBabyAvatar: boolean;
  suppressOverheadLevelTag: boolean;
}

export interface MonsterTarget {
  id: string;
  name: string;
  level: number; // 1 to 1000
  tier: 'minion' | 'elite' | 'boss' | 'world_titan';
  hp: bigint;
  maxHp: bigint;
  attack: bigint;
  defense: bigint;
  x: number;
  z: number;
  expReward: bigint;
  aiState: 'patrolling' | 'stalking_player' | 'flanking_march' | 'attack_windup' | 'enraged_berserk';
  movementPolicy: 'pack_swarmer' | 'shielded_charger' | 'flanking_orbiter' | 'blink_intercepter' | 'supreme_arbiter';
  counterTroop: TroopType;
}

export interface NPCEntity {
  id: string;
  name: string;
  role: 'elder' | 'guard' | 'blacksmith' | 'merchant' | 'marshal' | 'mystic';
  level: number;
  x: number;
  z: number;
  statusText: string;
  stashWood: bigint;
  stashSteel: bigint;
  stashDiamond: bigint;
}

export interface ProteinResiduePoint {
  residueIndex: number;
  aminoAcid: string;
  domainName: string;
  plddt: number; // 0 to 100
  x: number;
  y: number;
  z: number;
  isMutationHotspot?: boolean;
  clinicalVariantNote?: string;
}

export interface BioscienceTargetProfile {
  symbol: string;
  uniprotId: string;
  pdbId: string;
  proteinName: string;
  organism: string;
  sequenceLength: number;
  meanPlddt: number;
  provenance: '[Predicted by model]' | '[Experimentally determined]';
  alphafoldUrl: string;
  rcsbUrl: string;
  uniprotUrl: string;
  chemblLigandName: string;
  chemblIc50Nm: number;
  elixirBuffSummary: string;
  residues: ProteinResiduePoint[];
}
