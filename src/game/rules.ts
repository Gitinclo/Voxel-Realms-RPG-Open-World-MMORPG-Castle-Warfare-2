/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CultivationAuraVisualSpec,
  CultivationPath,
  CultivationPathProgress,
  CultivationRealmDef,
  Disciple,
  GameResources,
  KarmaAlignment,
  MonsterTarget,
  PlayerKarmaState,
  ResourceType,
  TroopTierInfo,
  TroopType,
  WeatherType,
} from '../types';

export const MAX_CASTLE_LEVEL = 100;
export const MAX_CASTLE_TROOP_CAPACITY = 1_000_000_000_000_000n; // 1,000 Trillion
export const BASE_CASTLE_TROOP_CAPACITY = 10_000n;
export const MAX_RALLY_CAPACITY = 1_000_000_000_000n; // 1 Trillion
export const BASE_RALLY_CAPACITY = 5_000n;

export interface CastleEra {
  eraIndex: number;
  name: string;
  minLevel: number;
  maxLevel: number;
  unlockedTroopTier: number;
  buildingTheme: string;
  castleMultiplier: number;
  perkDescription: string;
}

export const CASTLE_ERAS: CastleEra[] = [
  { eraIndex: 1, name: 'Era I: Timber Encampment', minLevel: 0, maxLevel: 9, unlockedTroopTier: 2, buildingTheme: 'Timber & Earth', castleMultiplier: 1, perkDescription: 'Base gathering speed +10%' },
  { eraIndex: 2, name: 'Era II: Stone Bastion', minLevel: 10, maxLevel: 19, unlockedTroopTier: 4, buildingTheme: 'Granite Walls', castleMultiplier: 5, perkDescription: 'Troop defense +25%' },
  { eraIndex: 3, name: 'Era III: Iron Keep', minLevel: 20, maxLevel: 29, unlockedTroopTier: 6, buildingTheme: 'Reinforced Iron', castleMultiplier: 12, perkDescription: 'Shieldbearer block rating +30%' },
  { eraIndex: 4, name: 'Era IV: Steel Fortress', minLevel: 30, maxLevel: 39, unlockedTroopTier: 8, buildingTheme: 'High Carbon Steel', castleMultiplier: 20, perkDescription: 'Shooter range +40%' },
  { eraIndex: 5, name: 'Era V: Mythril Citadel', minLevel: 40, maxLevel: 49, unlockedTroopTier: 10, buildingTheme: 'Enchanted Mythril', castleMultiplier: 32, perkDescription: 'Bomber blast radius +50%' },
  { eraIndex: 6, name: 'Era VI: Obsidian Spire', minLevel: 50, maxLevel: 59, unlockedTroopTier: 12, buildingTheme: 'Volcanic Obsidian', castleMultiplier: 45, perkDescription: 'All troop attack +60%' },
  { eraIndex: 7, name: 'Era VII: Dragonscale Palace', minLevel: 60, maxLevel: 69, unlockedTroopTier: 14, buildingTheme: 'Draconic Runes', castleMultiplier: 60, perkDescription: 'Rally march speed +75%' },
  { eraIndex: 8, name: 'Era VIII: Void Sanctum', minLevel: 70, maxLevel: 79, unlockedTroopTier: 16, buildingTheme: 'Dark Matter Flux', castleMultiplier: 75, perkDescription: 'Titan damage resistance +45%' },
  { eraIndex: 9, name: 'Era IX: Astral Dominion', minLevel: 80, maxLevel: 89, unlockedTroopTier: 18, buildingTheme: 'Starlight Crystal', castleMultiplier: 90, perkDescription: 'Rally capacity boost +100%' },
  { eraIndex: 10, name: 'Era X: Celestial Imperium', minLevel: 90, maxLevel: 100, unlockedTroopTier: 20, buildingTheme: 'Divine Singularity', castleMultiplier: 100, perkDescription: 'Unlocks T20 Celestial Aegis & 1000 Trillion Capacity' },
];

export function getCastleEra(level: number): CastleEra {
  const clamped = Math.max(0, Math.min(100, level));
  return CASTLE_ERAS.find((e) => clamped >= e.minLevel && clamped <= e.maxLevel) || CASTLE_ERAS[0];
}

export function calculateCastleTroopCapacity(castleLevel: number): bigint {
  const level = Math.max(0, Math.min(MAX_CASTLE_LEVEL, castleLevel));
  if (level === 0) return BASE_CASTLE_TROOP_CAPACITY;
  if (level === MAX_CASTLE_LEVEL) return MAX_CASTLE_TROOP_CAPACITY;
  const t = level / 100;
  const growth = Math.pow(t, 5.2);
  const diff = Number(MAX_CASTLE_TROOP_CAPACITY - BASE_CASTLE_TROOP_CAPACITY);
  return BigInt(Math.floor(Number(BASE_CASTLE_TROOP_CAPACITY) + diff * growth));
}

export function calculateRallyCapacity(castleLevel: number): bigint {
  const level = Math.max(0, Math.min(MAX_CASTLE_LEVEL, castleLevel));
  if (level === 0) return BASE_RALLY_CAPACITY;
  if (level === MAX_CASTLE_LEVEL) return MAX_RALLY_CAPACITY;
  const t = level / 100;
  const growth = Math.pow(t, 4.8);
  const diff = Number(MAX_RALLY_CAPACITY - BASE_RALLY_CAPACITY);
  return BigInt(Math.floor(Number(BASE_RALLY_CAPACITY) + diff * growth));
}

export function formatBigInt(num: bigint | number): string {
  const b = typeof num === 'bigint' ? num : BigInt(Math.floor(num));
  if (b < 0n) return `-${formatBigInt(-b)}`;
  if (b >= 1_000_000_000_000_000n) {
    return `${(Number(b / 10_000_000_000_000n) / 100).toFixed(2)}Q`;
  }
  if (b >= 1_000_000_000_000n) {
    return `${(Number(b / 10_000_000_000n) / 100).toFixed(2)}T`;
  }
  if (b >= 1_000_000_000n) {
    return `${(Number(b / 10_000_000n) / 100).toFixed(2)}B`;
  }
  if (b >= 1_000_000n) {
    return `${(Number(b / 10_000n) / 100).toFixed(2)}M`;
  }
  if (b >= 1_000n) {
    return `${(Number(b / 10n) / 100).toFixed(1)}K`;
  }
  return b.toString();
}

const SHIELDBEARER_NAMES = [
  'Wooden Buckler', 'Bronze Guardian', 'Iron Shieldbearer', 'Steel Vanguard', 'Adamant Sentinel',
  'Runed Bulwark', 'Mythril Phalanx', 'Dragonscale Bastion', 'Obsidian Colossus', 'Titan Aegis',
  'Solar Fortress', 'Starlight Ward', 'Void Barrier', 'Chrono Juggernaut', 'Singularity Wall',
  'Primordial Aegis', 'Nebula Custodian', 'Cosmic Protector', 'Transcendent Shield', 'Celestial Aegis',
];
const SHOOTER_NAMES = [
  'Shortbow Scout', 'Recurve Archer', 'Crossbow Hunter', 'Longbow Marksman', 'Arbalest Sniper',
  'Eagle-Eye Ranger', 'Windrunner Bow', 'Dragon-Bone Ballista', 'Arcane Deadeye', 'Plasma Ballista',
  'Thunderbolt Sniper', 'Starlight Railgun', 'Void Bowmaster', 'Quasar Striker', 'Supernova Marksman',
  'Chronos Arrow', 'Astral Sharpshooter', 'Dimensional Piercer', 'Infinity Archer', 'Celestial Deadeye',
];
const BOMBER_NAMES = [
  'Pitch Slinger', 'Powder Lobber', 'Iron Mortar', 'Catapult Engineer', 'Trebuchet Demolisher',
  'Flamethrower Crew', 'Siege Cannoneer', 'Dragonfire Mortar', 'Alchemy Bombardier', 'Magma Howitzer',
  'Storm Blaster', 'Antimatter Siege', 'Void Cataclysm', 'Orbital Bombard', 'Pulsar Demolisher',
  'Supercluster Bomber', 'Dark Matter Mortar', 'Cosmic Annihilator', 'Omega Siege Titan', 'Celestial Annihilator',
];

export function getTroopTierInfo(type: TroopType, tier: number): TroopTierInfo {
  const clampedTier = Math.max(1, Math.min(20, tier));
  const t = BigInt(clampedTier);
  const idx = clampedTier - 1;
  let name = '';
  let baseAtk = 10n;
  let baseDef = 10n;
  let baseHp = 50n;

  if (type === 'shieldbearer') {
    name = SHIELDBEARER_NAMES[idx];
    baseAtk = 8n * 2n ** (t - 1n);
    baseDef = 28n * 2n ** (t - 1n);
    baseHp = 120n * 2n ** (t - 1n);
  } else if (type === 'shooter') {
    name = SHOOTER_NAMES[idx];
    baseAtk = 32n * 2n ** (t - 1n);
    baseDef = 12n * 2n ** (t - 1n);
    baseHp = 55n * 2n ** (t - 1n);
  } else {
    name = BOMBER_NAMES[idx];
    baseAtk = 45n * 2n ** (t - 1n);
    baseDef = 16n * 2n ** (t - 1n);
    baseHp = 70n * 2n ** (t - 1n);
  }

  const powerPerUnit = (baseAtk * 3n + baseDef * 3n + baseHp) / 2n;
  const costMultiplier = 5n * 2n ** (t - 1n);

  return {
    tier: clampedTier,
    type,
    name: `T${clampedTier} ${name}`,
    attack: baseAtk,
    defense: baseDef,
    hp: baseHp,
    speed: type === 'shooter' ? 12 : type === 'shieldbearer' ? 9 : 7,
    woodCost: costMultiplier * 10n,
    steelCost: type === 'shieldbearer' ? costMultiplier * 15n : costMultiplier * 8n,
    copperCost: costMultiplier * 6n,
    grainCost: costMultiplier * 12n,
    oilCost: type === 'bomber' ? costMultiplier * 18n : costMultiplier * 5n,
    diamondCost: clampedTier > 10 ? BigInt(clampedTier - 10) * 10n : 0n,
    powerPerUnit,
    description:
      type === 'shieldbearer'
        ? 'Heavy frontline vanguard tank. Counter vs Shooters (+35%).'
        : type === 'shooter'
          ? 'Long-range armor piercer. Counter vs Bombers (+35%).'
          : 'Siege artillery demolitionist. Counter vs Shieldbearers (+35%).',
  };
}

export function getCastleUpgradeCost(currentLevel: number): GameResources {
  const nextLvl = BigInt(currentLevel + 1);
  const factor = nextLvl ** 2n;
  return {
    wood: factor * 2500n,
    steel: factor * 1800n,
    copper: factor * 1200n,
    grain: factor * 2000n,
    oil: factor * 900n,
    diamond: nextLvl * 50n,
  };
}

export function calculateMultiplicativePowerRating(params: {
  troops: Record<string, bigint>;
  castleLevel: number;
  highestHeroRarityMultiplier: number;
  researchLevel: number;
}): bigint {
  const era = getCastleEra(params.castleLevel);
  const castleMult = BigInt(Math.max(1, era.castleMultiplier));
  const heroMult = BigInt(Math.max(1, Math.floor(params.highestHeroRarityMultiplier)));
  const researchMult = BigInt(Math.max(1, Math.min(5, Math.floor(params.researchLevel / 4) + 1)));

  let baseTroopPower = 0n;
  for (const [key, count] of Object.entries(params.troops)) {
    if (count <= 0n) continue;
    const parts = key.split('_t');
    const tier = parts.length > 1 ? parseInt(parts[1], 10) : 1;
    const tierPower = BigInt(Math.max(1, Math.floor(Math.pow(1.25, tier - 1))));
    baseTroopPower += count * tierPower;
  }
  if (baseTroopPower === 0n) {
    baseTroopPower = BigInt(params.castleLevel * 50_000 + 10_000);
  }
  return baseTroopPower * castleMult * heroMult * researchMult;
}

// ============================================================================
// FOUR-PATH CULTIVATION, REALM SUPPRESSION (100x), KARMA & MASTER/DISCIPLE
// ============================================================================

export const CULTIVATION_REALMS: CultivationRealmDef[] = [
  { id: 'r0', path: 'qi', name: 'Qi Refinement', chineseName: '炼气期', era: 'mortal', index: 0, totalLayers: 9, description: 'Absorbing worldly Qi into mortal meridians.', basePowerMultiplier: 1.1, baseQiPerLayer: 5_000n, tribulationRounds: 0, icon: '🌱' },
  { id: 'r1', path: 'qi', name: 'Foundation Establishment', chineseName: '筑基期', era: 'mortal', index: 1, totalLayers: 9, description: 'Condensing gaseous Qi into a liquid spiritual sea.', basePowerMultiplier: 2.0, baseQiPerLayer: 80_000n, tribulationRounds: 1, icon: '🌊' },
  { id: 'r2', path: 'qi', name: 'Golden Core Realm', chineseName: '金丹期', era: 'mortal', index: 2, totalLayers: 9, description: 'Compressing the spiritual sea into an indestructible Golden Core.', basePowerMultiplier: 5.0, baseQiPerLayer: 1_200_000n, tribulationRounds: 2, icon: '🟡' },
  { id: 'r3', path: 'qi', name: 'Nascent Soul Realm', chineseName: '元婴期', era: 'mortal', index: 3, totalLayers: 9, description: 'Birthing an astral Nascent Soul infant inside the Dantian.', basePowerMultiplier: 15.0, baseQiPerLayer: 18_000_000n, tribulationRounds: 3, icon: '👶' },
  { id: 'r4', path: 'qi', name: 'Soul Formation Realm', chineseName: '化神期', era: 'mortal', index: 4, totalLayers: 9, description: 'Merging the Nascent Soul with natural laws.', basePowerMultiplier: 50.0, baseQiPerLayer: 250_000_000n, tribulationRounds: 3, icon: '✨' },
  { id: 'r5', path: 'qi', name: 'Void Returning Realm', chineseName: '炼虚期', era: 'mortal', index: 5, totalLayers: 9, description: 'Stepping into the spatial void.', basePowerMultiplier: 180.0, baseQiPerLayer: 3_500_000_000n, tribulationRounds: 4, icon: '🌌' },
  { id: 'r6', path: 'qi', name: 'Body Integration Realm', chineseName: '合体期', era: 'mortal', index: 6, totalLayers: 9, description: 'Fusing physical body and soul into one domain.', basePowerMultiplier: 650.0, baseQiPerLayer: 50_000_000_000n, tribulationRounds: 5, icon: '⚡' },
  { id: 'r7', path: 'qi', name: 'Tribulation Transcendence', chineseName: '渡劫期', era: 'mortal', index: 7, totalLayers: 9, description: 'Weathering Nine Heavenly Lightning Tribulations.', basePowerMultiplier: 2_500.0, baseQiPerLayer: 700_000_000_000n, tribulationRounds: 6, icon: '🌩️' },
  { id: 'r8', path: 'qi', name: 'Mahayana Realm', chineseName: '大乘期', era: 'mortal', index: 8, totalLayers: 9, description: 'Peak of the mortal world awaiting immortal ascension.', basePowerMultiplier: 10_000.0, baseQiPerLayer: 10_000_000_000_000n, tribulationRounds: 7, icon: '👑' },
  { id: 'r9', path: 'qi', name: 'Loose Immortal', chineseName: '散仙', era: 'immortal_sage', index: 9, totalLayers: 9, description: 'Shedding mortal flesh for immortal Qi.', basePowerMultiplier: 50_000.0, baseQiPerLayer: 150_000_000_000_000n, tribulationRounds: 4, icon: '☁️' },
  { id: 'r10', path: 'qi', name: 'Earth Immortal', chineseName: '地仙', era: 'immortal_sage', index: 10, totalLayers: 9, description: 'Anchoring spirit in terrestrial leylines.', basePowerMultiplier: 250_000.0, baseQiPerLayer: 2_000_000_000_000_000n, tribulationRounds: 4, icon: '⛰️' },
  { id: 'r11', path: 'qi', name: 'Heaven Immortal', chineseName: '天仙', era: 'immortal_sage', index: 11, totalLayers: 9, description: 'Resonating with the Nine Heavens.', basePowerMultiplier: 1_200_000.0, baseQiPerLayer: 30_000_000_000_000_000n, tribulationRounds: 5, icon: '☀️' },
  { id: 'r12', path: 'qi', name: 'Grand Xuan Immortal', chineseName: '太乙真仙', era: 'immortal_sage', index: 12, totalLayers: 9, description: 'Grasping deep cosmic permutations.', basePowerMultiplier: 6_000_000.0, baseQiPerLayer: 450_000_000_000_000_000n, tribulationRounds: 5, icon: '🔮' },
  { id: 'r13', path: 'qi', name: 'Golden Immortal', chineseName: '大罗金仙', era: 'immortal_sage', index: 13, totalLayers: 9, description: 'Unconditional immortality free from the five elements.', basePowerMultiplier: 35_000_000.0, baseQiPerLayer: 6_000_000_000_000_000_000n, tribulationRounds: 6, icon: '🌟' },
  { id: 'r14', path: 'qi', name: 'Taiyi Golden Immortal', chineseName: '太乙金仙', era: 'immortal_sage', index: 14, totalLayers: 9, description: 'Severing linear fate strings.', basePowerMultiplier: 200_000_000.0, baseQiPerLayer: 85_000_000_000_000_000_000n, tribulationRounds: 6, icon: '🪐' },
  { id: 'r15', path: 'qi', name: 'Zenith Heaven Golden Immortal', chineseName: '大罗至仙', era: 'immortal_sage', index: 15, totalLayers: 9, description: 'Stepping out of the River of Time.', basePowerMultiplier: 1_200_000_000.0, baseQiPerLayer: 1_200_000_000_000_000_000_000n, tribulationRounds: 7, icon: '⏳' },
  { id: 'r16', path: 'qi', name: 'Pseudo-Sage', chineseName: '准圣', era: 'immortal_sage', index: 16, totalLayers: 9, description: 'Slicing away the three corpses.', basePowerMultiplier: 8_000_000_000.0, baseQiPerLayer: 18_000_000_000_000_000_000_000n, tribulationRounds: 7, icon: '🗡️' },
  { id: 'r17', path: 'qi', name: 'Heavenly Dao Sage', chineseName: '天道圣人', era: 'immortal_sage', index: 17, totalLayers: 9, description: 'Immortal and omnipotent within the home universe.', basePowerMultiplier: 60_000_000_000.0, baseQiPerLayer: 250_000_000_000_000_000_000_000n, tribulationRounds: 8, icon: '🏛️' },
  { id: 'r18', path: 'qi', name: 'Freedom Sage Realm', chineseName: '自在圣人', era: 'immortal_sage', index: 18, totalLayers: 9, description: 'Unbound by a single universe’s Heavenly Dao.', basePowerMultiplier: 500_000_000_000.0, baseQiPerLayer: 3_500_000_000_000_000_000_000_000n, tribulationRounds: 8, icon: '🦅' },
  { id: 'r19', path: 'qi', name: 'Great Dao Sage', chineseName: '大道圣人', era: 'chaos_dao', index: 19, totalLayers: 9, description: 'Controlling an independent Great Dao Law in the Chaos.', basePowerMultiplier: 4_500_000_000_000.0, baseQiPerLayer: 50_000_000_000_000_000_000_000_000n, tribulationRounds: 9, icon: '🌀' },
  { id: 'r20', path: 'qi', name: 'Great Dao Supreme', chineseName: '大道至尊', era: 'chaos_dao', index: 20, totalLayers: 9, description: 'Creating and shattering universes in a breath.', basePowerMultiplier: 40_000_000_000_000.0, baseQiPerLayer: 750_000_000_000_000_000_000_000_000n, tribulationRounds: 9, icon: '💥' },
  { id: 'r21', path: 'qi', name: 'Dao Creator', chineseName: '创造道者', era: 'chaos_dao', index: 21, totalLayers: 9, description: 'Supreme creators of Great Dao Worlds with concentric Divine Halos.', basePowerMultiplier: 500_000_000_000_000.0, baseQiPerLayer: 10_000_000_000_000_000_000_000_000_000n, tribulationRounds: 9, icon: '☀️' },
  { id: 'r22', path: 'qi', name: 'Ultimate Origin Supreme', chineseName: '终极元尊', era: 'ultimate_origin', index: 22, totalLayers: 9, description: 'Han Jue’s exclusive omnipotent pinnacle above all Dao Creators.', basePowerMultiplier: 10_000_000_000_000_000.0, baseQiPerLayer: 200_000_000_000_000_000_000_000_000_000n, tribulationRounds: 9, icon: '♾️' },
];

export function calculateQiRequired(realmIndex: number, layer: number): bigint {
  const realm = CULTIVATION_REALMS[Math.max(0, Math.min(22, realmIndex))] || CULTIVATION_REALMS[0];
  const clampedLayer = Math.max(1, Math.min(9, layer));
  return BigInt(Math.floor(Number(realm.baseQiPerLayer) * Math.pow(1.35, clampedLayer - 1)));
}

export function calculateCultivationMultiplier(realmIndex: number, layer: number): number {
  const realm = CULTIVATION_REALMS[Math.max(0, Math.min(22, realmIndex))] || CULTIVATION_REALMS[0];
  const clampedLayer = Math.max(1, Math.min(9, layer));
  return realm.basePowerMultiplier * (1 + (clampedLayer - 1) * 0.12);
}

/**
 * Realm Suppression (境界压制):
 * Each major realm above opponent grants 10x damage (Golden Core [2] vs Qi Refinement [0] = 10^2 = 100x Damage!).
 */
export function calculateRealmSuppression(attackerRealmIndex: number, defenderRealmIndex: number): {
  realmDifference: number;
  damageMultiplier: number;
  incomingDamageReductionPct: number;
  suppressionLabel: string;
} {
  const clampedAttacker = Math.max(0, Math.min(22, attackerRealmIndex));
  const clampedDefender = Math.max(0, Math.min(22, defenderRealmIndex));
  const realmDifference = clampedAttacker - clampedDefender;
  const damageMultiplier = Math.pow(10, realmDifference);
  const incomingDamageReductionPct =
    realmDifference > 0 ? Number(((1 - 1 / damageMultiplier) * 100).toFixed(2)) : 0;

  let suppressionLabel = 'Equal Realm Clash (1.0x Damage)';
  if (realmDifference >= 3) {
    suppressionLabel = `Absolute Dimension Crushing (${damageMultiplier.toLocaleString()}x Damage)`;
  } else if (realmDifference === 2) {
    suppressionLabel = 'Major Realm Suppression (100x Damage — Core Fantasy)';
  } else if (realmDifference === 1) {
    suppressionLabel = 'Realm Suppression (10x Damage)';
  } else if (realmDifference < 0) {
    suppressionLabel = `Suppressed by Higher Realm (${damageMultiplier}x Damage)`;
  }
  return {
    realmDifference,
    damageMultiplier,
    incomingDamageReductionPct,
    suppressionLabel,
  };
}

export function calculateFourPathSynergy(paths: Record<CultivationPath, CultivationPathProgress>): {
  qiMult: number;
  bodyMult: number;
  soulMult: number;
  mindMult: number;
  minRealmIndex: number;
  resonanceBonusMult: number;
  totalCombinedMultiplier: number;
} {
  const qiMult = calculateCultivationMultiplier(paths.qi.realmIndex, paths.qi.layer);
  const bodyMult = calculateCultivationMultiplier(paths.body.realmIndex, paths.body.layer);
  const soulMult = calculateCultivationMultiplier(paths.soul.realmIndex, paths.soul.layer);
  const mindMult = calculateCultivationMultiplier(paths.mind.realmIndex, paths.mind.layer);

  const minRealmIndex = Math.min(
    paths.qi.realmIndex,
    paths.body.realmIndex,
    paths.soul.realmIndex,
    paths.mind.realmIndex,
  );
  const resonanceBonusMult = Number((1 + minRealmIndex * 0.35).toFixed(2));
  const secondaryHarmony =
    1 +
    Math.log10(Math.max(1, bodyMult)) * 0.45 +
    Math.log10(Math.max(1, soulMult)) * 0.45 +
    Math.log10(Math.max(1, mindMult)) * 0.35;
  const totalCombinedMultiplier = qiMult * secondaryHarmony * resonanceBonusMult;

  return {
    qiMult,
    bodyMult,
    soulMult,
    mindMult,
    minRealmIndex,
    resonanceBonusMult,
    totalCombinedMultiplier,
  };
}

export function getKarmaAlignment(karmaValue: number): KarmaAlignment {
  if (karmaValue < 0) return 'red_fiend';
  if (karmaValue >= 300) return 'gold_justice';
  if (karmaValue >= 50) return 'green_innocent';
  return 'white_neutral';
}

export function evaluatePvPKillKarma(params: {
  currentKarma: PlayerKarmaState;
  attackerRealmIndex: number;
  victimRealmIndex: number;
  victimKarmaValue: number;
  victimName: string;
}): {
  updatedKarma: PlayerKarmaState;
  bountyEarnedSpiritStones: bigint;
  message: string;
} {
  const { currentKarma, attackerRealmIndex, victimRealmIndex, victimKarmaValue, victimName } = params;
  const realmGap = Math.max(1, attackerRealmIndex - victimRealmIndex);

  if (victimKarmaValue >= 0 && attackerRealmIndex > victimRealmIndex) {
    const karmaPenalty = Math.max(250, realmGap * 200);
    const nextVal = Math.min(-100, currentKarma.karmaValue - karmaPenalty);
    const addedBounty = BigInt(realmGap * 50_000);
    const updatedKarma: PlayerKarmaState = {
      ...currentKarma,
      karmaValue: nextVal,
      alignment: 'red_fiend',
      unlawfulKills: currentKarma.unlawfulKills + 1,
      bountySpiritStones: currentKarma.bountySpiritStones + addedBounty,
      isLocationRevealed: true,
    };
    return {
      updatedKarma,
      bountyEarnedSpiritStones: 0n,
      message: `[RED NAME FIEND] Slaughtered innocent ${victimName}! Karma: ${nextVal}. Coordinates broadcast & Tribulation Lightning armed!`,
    };
  }
  if (victimKarmaValue < 0) {
    const nextVal = currentKarma.karmaValue + 150;
    const rewardStones = BigInt(Math.abs(victimKarmaValue) * 400);
    const updatedKarma: PlayerKarmaState = {
      ...currentKarma,
      karmaValue: nextVal,
      alignment: getKarmaAlignment(nextVal),
      righteousKills: currentKarma.righteousKills + 1,
      bountySpiritStones: nextVal >= 0 ? 0n : currentKarma.bountySpiritStones,
      isLocationRevealed: nextVal < 0,
    };
    return {
      updatedKarma,
      bountyEarnedSpiritStones: rewardStones,
      message: `[HEAVENLY JUSTICE] Executed Red-Name Fiend ${victimName}! Claimed +${formatBigInt(rewardStones)} Spirit Stones!`,
    };
  }
  const nextVal = currentKarma.karmaValue - 20;
  return {
    updatedKarma: {
      ...currentKarma,
      karmaValue: nextVal,
      alignment: getKarmaAlignment(nextVal),
      isLocationRevealed: nextVal < 0,
    },
    bountyEarnedSpiritStones: 0n,
    message: `Defeated ${victimName} in equal-realm combat.`,
  };
}

export function tickRedNameStationaryLightning(params: {
  karma: PlayerKarmaState;
  isMoving: boolean;
  deltaSec?: number;
}): {
  updatedKarma: PlayerKarmaState;
  struckByInstantKillLightning: boolean;
  warningMessage: string | null;
} {
  const { karma, isMoving, deltaSec = 1 } = params;
  if (karma.karmaValue >= 0 || isMoving) {
    return {
      updatedKarma: { ...karma, stationarySeconds: 0, lastLightningStrikeMsg: null },
      struckByInstantKillLightning: false,
      warningMessage: null,
    };
  }
  const nextSec = karma.stationarySeconds + deltaSec;
  if (nextSec >= karma.maxStationaryThresholdSec) {
    const msg = '⚡ [HEAVENLY JUDGMENT] Instant-Kill Crimson Tribulation Bolt struck stationary Red-Name Fiend!';
    return {
      updatedKarma: {
        ...karma,
        stationarySeconds: 0,
        lastLightningStrikeMsg: msg,
        droppedLootHistory: ['Jade Pure Nine-Heavens Mantra Scroll', ...karma.droppedLootHistory].slice(0, 6),
      },
      struckByInstantKillLightning: true,
      warningMessage: msg,
    };
  }
  return {
    updatedKarma: { ...karma, stationarySeconds: nextSec },
    struckByInstantKillLightning: false,
    warningMessage: `Tribulation Lock-On: ${nextSec}s / ${karma.maxStationaryThresholdSec}s stationary!`,
  };
}

export function calculateMasterDiscipleEconomy(params: {
  masterRealmIndex: number;
  disciples: Disciple[];
  masterTaxRatePct: number;
}): {
  proximitySpeedBuffPct: number;
  nearDisciplesCount: number;
  totalMasterTaxSpiritStonesPerSec: bigint;
  totalMasterTaxQiPerSec: bigint;
} {
  const { masterRealmIndex, disciples, masterTaxRatePct } = params;
  const clampedTax = Math.max(5, Math.min(50, masterTaxRatePct));
  const proximitySpeedBuffPct = 40 + Math.min(160, masterRealmIndex * 12);
  let nearDisciplesCount = 0;
  let totalMasterTaxSpiritStonesPerSec = 0n;
  let totalMasterTaxQiPerSec = 0n;

  for (const d of disciples) {
    const isNear = d.distanceMeters <= 50 && masterRealmIndex >= d.realmIndex;
    if (isNear) nearDisciplesCount += 1;
    const buffPct = (isNear ? proximitySpeedBuffPct : 0) + d.equippedSkills.length * 35;
    const mult = 1 + buffPct / 100;
    const grossStones = BigInt(Math.floor(Number(d.baseSpiritStonesPerSec) * mult));
    const grossQi = BigInt(Math.floor(Number(d.baseQiPerSec) * mult));
    totalMasterTaxSpiritStonesPerSec += (grossStones * BigInt(clampedTax)) / 100n;
    totalMasterTaxQiPerSec += (grossQi * BigInt(clampedTax)) / 100n;
  }

  return {
    proximitySpeedBuffPct,
    nearDisciplesCount,
    totalMasterTaxSpiritStonesPerSec,
    totalMasterTaxQiPerSec,
  };
}

export function getCultivationAuraVisualSpec(
  realmIndex: number,
  masteredGreatDaos: number = 4,
): CultivationAuraVisualSpec {
  const clampedRealm = Math.max(0, Math.min(22, realmIndex));
  const clampedDaos = Math.max(1, Math.min(12, masteredGreatDaos));

  if (clampedRealm === 0) {
    return {
      cueType: 'none',
      label: 'Qi Refinement (No External Aura)',
      chineseLabel: '炼气内敛',
      description: 'Mortal vessel with internal meridian circulation.',
      primaryColorHex: '#94a3b8',
      secondaryColorHex: '#475569',
      hdrPeakLuminanceNits: 120,
      haloCount: 0,
      hasTranslucentChestCore: false,
      hasFloatingBabyAvatar: false,
      suppressOverheadLevelTag: true,
    };
  }
  if (clampedRealm === 1) {
    return {
      cueType: 'faint_white_glow',
      label: 'Foundation Establishment (Faint White Mist Glow)',
      chineseLabel: '筑基灵雾',
      description: 'Purified spiritual mist radiating from pores.',
      primaryColorHex: '#f8fafc',
      secondaryColorHex: '#bae6fd',
      hdrPeakLuminanceNits: 420,
      haloCount: 0,
      hasTranslucentChestCore: false,
      hasFloatingBabyAvatar: false,
      suppressOverheadLevelTag: true,
    };
  }
  if (clampedRealm === 2) {
    return {
      cueType: 'spinning_golden_core',
      label: 'Golden Core (Spinning Core in Translucent Chest & Back)',
      chineseLabel: '金丹流转',
      description: 'Solid Golden Core revolving behind the back and gleaming in the Dantian.',
      primaryColorHex: '#fbbf24',
      secondaryColorHex: '#f59e0b',
      hdrPeakLuminanceNits: 1150,
      haloCount: 1,
      hasTranslucentChestCore: true,
      hasFloatingBabyAvatar: false,
      suppressOverheadLevelTag: true,
    };
  }
  if (clampedRealm >= 21) {
    return {
      cueType: 'divine_halos',
      label: `Dao Creator (${clampedDaos} Great Dao Divine Halos)`,
      chineseLabel: `万道神轮 · ${clampedDaos}道`,
      description: `${clampedDaos} concentric HDR10+ Divine Rings revolving behind the Sovereign.`,
      primaryColorHex: '#fde047',
      secondaryColorHex: '#c084fc',
      hdrPeakLuminanceNits: 4000,
      haloCount: clampedDaos,
      hasTranslucentChestCore: true,
      hasFloatingBabyAvatar: false,
      suppressOverheadLevelTag: true,
    };
  }
  return {
    cueType: 'floating_nascent_baby',
    label: 'Nascent Soul (Floating Astral Baby Avatar Above Head)',
    chineseLabel: '元婴显化',
    description: 'Luminous astral Nascent Soul infant meditating above the crown.',
    primaryColorHex: '#38bdf8',
    secondaryColorHex: '#a855f7',
    hdrPeakLuminanceNits: 1850,
    haloCount: clampedRealm >= 15 ? 2 : 0,
    hasTranslucentChestCore: false,
    hasFloatingBabyAvatar: true,
    suppressOverheadLevelTag: true,
  };
}

// ============================================================================
// WEATHER, DAILY LOGIN & WORLD AI (MONSTERS LV 1-1000 + A* PATHFINDING)
// ============================================================================

export function calculateWeatherGatherRate(
  baseRate: bigint,
  resourceType: ResourceType,
  weather: WeatherType,
): bigint {
  let mult = 1.0;
  if (weather === 'rain') {
    if (resourceType === 'wood') mult = 1.35;
    else if (resourceType === 'grain') mult = 1.4;
    else if (resourceType === 'steel') mult = 0.85;
  } else if (weather === 'snow') {
    if (resourceType === 'diamond') mult = 1.45;
    else if (resourceType === 'copper') mult = 1.2;
    else if (resourceType === 'grain') mult = 0.75;
  } else if (weather === 'storm') {
    if (resourceType === 'oil') mult = 1.5;
    else if (resourceType === 'steel') mult = 1.35;
    else if (resourceType === 'wood') mult = 0.8;
  }
  return BigInt(Math.max(1, Math.floor(Number(baseRate) * mult)));
}

export function createScaledMonsterByLevel(level: number, x = 16, z = -14): MonsterTarget {
  const clamped = Math.max(1, Math.min(1000, Math.floor(level)));
  const lf = BigInt(clamped);
  const tier: MonsterTarget['tier'] =
    clamped >= 851 ? 'world_titan' : clamped >= 201 ? 'boss' : clamped >= 51 ? 'elite' : 'minion';
  const tierMult = tier === 'world_titan' ? 180n : tier === 'boss' ? 45n : tier === 'elite' ? 12n : 3n;
  const hp = (1200n + lf * lf * 240n) * tierMult;
  const attack = (45n + lf * lf * 5n) * tierMult;
  const defense = (30n + lf * lf * 4n) * tierMult;
  const expReward = (250n + lf * 1450n) * tierMult;

  const movementPolicy: MonsterTarget['movementPolicy'] =
    clamped >= 851
      ? 'supreme_arbiter'
      : clamped >= 501
        ? 'blink_intercepter'
        : clamped >= 201
          ? 'flanking_orbiter'
          : clamped >= 51
            ? 'shielded_charger'
            : 'pack_swarmer';

  const counterTroop: TroopType =
    clamped >= 501 ? 'bomber' : clamped >= 201 ? 'shooter' : 'shieldbearer';

  return {
    id: `mon_lv${clamped}_${Math.abs(x)}`,
    name:
      tier === 'world_titan'
        ? `Celestial Ender Titan [Lv.${clamped}]`
        : tier === 'boss'
          ? `Infernal Sovereign Wyrm [Lv.${clamped}]`
          : tier === 'elite'
            ? `Obsidian Runic Golem [Lv.${clamped}]`
            : `Feral Bramble Pack [Lv.${clamped}]`,
    level: clamped,
    tier,
    hp,
    maxHp: hp,
    attack,
    defense,
    x,
    z,
    expReward,
    aiState: tier === 'world_titan' ? 'enraged_berserk' : 'patrolling',
    movementPolicy,
    counterTroop,
  };
}

export function isWorldCoordinateWalkable(x: number, z: number): boolean {
  if (x < -36 || x > 36 || z < -36 || z > 36) return false;
  // Central Castle Keep occupies [-7.5..7.5, -7.5..7.5]
  if (Math.abs(x) < 7.5 && Math.abs(z) < 7.5) return false;
  return true;
}

export function computeAStarAvoidKeepPath(
  start: { x: number; z: number },
  goal: { x: number; z: number },
): Array<{ x: number; z: number }> {
  const waypoints: Array<{ x: number; z: number }> = [];
  // If direct line crosses central keep, route around perimeter corner
  const crossesKeep =
    Math.sign(start.x) !== Math.sign(goal.x) &&
    Math.abs(start.z) < 9 &&
    Math.abs(goal.z) < 9;
  if (crossesKeep) {
    waypoints.push({ x: 0, z: 12 });
  }
  const safeGoal = isWorldCoordinateWalkable(goal.x, goal.z)
    ? goal
    : { x: goal.x >= 0 ? 10 : -10, z: goal.z >= 0 ? 10 : -10 };
  waypoints.push(safeGoal);
  return waypoints;
}
