/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_CASTLE_TROOP_CAPACITY,
  MAX_RALLY_CAPACITY,
  calculateCastleTroopCapacity,
  calculateFourPathSynergy,
  calculateMasterDiscipleEconomy,
  calculateMultiplicativePowerRating,
  calculateRallyCapacity,
  calculateRealmSuppression,
  calculateWeatherGatherRate,
  computeAStarAvoidKeepPath,
  createScaledMonsterByLevel,
  evaluatePvPKillKarma,
  formatBigInt,
  getCastleEra,
  getCultivationAuraVisualSpec,
  getTroopTierInfo,
  isWorldCoordinateWalkable,
  tickRedNameStationaryLightning,
} from './rules';
import { getAlphaFoldPlddtColor, getBioscienceTarget } from './bioscience';

test('Castle Warfare: scales to 1,000 Trillion capacity and 1 Trillion rally at Level 100 across 10 Eras', () => {
  assert.equal(calculateCastleTroopCapacity(0), 10_000n);
  assert.equal(calculateCastleTroopCapacity(100), MAX_CASTLE_TROOP_CAPACITY);
  assert.equal(calculateCastleTroopCapacity(100), 1_000_000_000_000_000n);
  assert.equal(formatBigInt(1_000_000_000_000_000n), '1.00Q');
  assert.equal(calculateRallyCapacity(100), MAX_RALLY_CAPACITY);
  assert.equal(calculateRallyCapacity(100), 1_000_000_000_000n);
  assert.equal(getCastleEra(100).eraIndex, 10);
});

test('Troop Barracks T1-T20 & Multiplicative Trillion-Scale Power Rating', () => {
  const t1 = getTroopTierInfo('shieldbearer', 1);
  const t20 = getTroopTierInfo('bomber', 20);
  assert.ok(t20.powerPerUnit > t1.powerPerUnit * 1000n);

  const power = calculateMultiplicativePowerRating({
    troops: { shieldbearer_t15: 1_000_000n, shooter_t18: 1_500_000n, bomber_t20: 2_500_000n },
    castleLevel: 100,
    highestHeroRarityMultiplier: 10,
    researchLevel: 20,
  });
  assert.ok(power >= 1_000_000_000_000n);
});

test('Four-Path Cultivation & 100x Golden Core vs Qi Refinement Realm Suppression', () => {
  const suppression = calculateRealmSuppression(2, 0); // Golden Core (2) vs Qi Refinement (0)
  assert.equal(suppression.realmDifference, 2);
  assert.equal(suppression.damageMultiplier, 100);
  assert.equal(suppression.incomingDamageReductionPct, 99);

  const synergy = calculateFourPathSynergy({
    qi: { realmIndex: 3, layer: 4, currentEnergy: 1000n },
    body: { realmIndex: 2, layer: 6, currentEnergy: 1000n },
    soul: { realmIndex: 3, layer: 2, currentEnergy: 1000n },
    mind: { realmIndex: 3, layer: 5, currentEnergy: 1000n },
  });
  assert.ok(synergy.totalCombinedMultiplier > 15);
});

test('Karma System: Red-Name Fiend, Stationary Tribulation Lightning, and Master/Disciple Economy', () => {
  const initialKarma = {
    karmaValue: 120,
    alignment: 'green_innocent' as const,
    unlawfulKills: 0,
    righteousKills: 0,
    stationarySeconds: 0,
    maxStationaryThresholdSec: 8,
    bountySpiritStones: 0n,
    isLocationRevealed: false,
    lastLightningStrikeMsg: null,
    droppedLootHistory: [],
  };

  const pkResult = evaluatePvPKillKarma({
    currentKarma: initialKarma,
    attackerRealmIndex: 2,
    victimRealmIndex: 0,
    victimKarmaValue: 100,
    victimName: 'Junior Disciple Lin',
  });
  assert.equal(pkResult.updatedKarma.alignment, 'red_fiend');
  assert.equal(pkResult.updatedKarma.isLocationRevealed, true);

  const lightningStrike = tickRedNameStationaryLightning({
    karma: pkResult.updatedKarma,
    isMoving: false,
    deltaSec: 8,
  });
  assert.equal(lightningStrike.struckByInstantKillLightning, true);
  assert.ok(lightningStrike.updatedKarma.droppedLootHistory.length > 0);

  const economy = calculateMasterDiscipleEconomy({
    masterRealmIndex: 3,
    disciples: [
      {
        id: 'd1',
        name: 'Yang Tiandong',
        chineseName: '杨天冬',
        realmIndex: 2,
        layer: 5,
        loyalty: 98,
        distanceMeters: 12,
        baseSpiritStonesPerSec: 450n,
        baseQiPerSec: 1800n,
        equippedSkills: ['skill_heaven_earth_sleeve'],
      },
    ],
    masterTaxRatePct: 20,
  });
  assert.equal(economy.nearDisciplesCount, 1);
  assert.ok(economy.totalMasterTaxSpiritStonesPerSec > 0n);
});

test('Cultivator Aura Visual Cues & Monster Lv 1-1000 AI Pathfinding', () => {
  assert.equal(getCultivationAuraVisualSpec(0).cueType, 'none');
  assert.equal(getCultivationAuraVisualSpec(1).cueType, 'faint_white_glow');
  assert.equal(getCultivationAuraVisualSpec(2).cueType, 'spinning_golden_core');
  assert.equal(getCultivationAuraVisualSpec(3).cueType, 'floating_nascent_baby');
  assert.equal(getCultivationAuraVisualSpec(21, 6).haloCount, 6);

  const m1000 = createScaledMonsterByLevel(1000);
  assert.equal(m1000.tier, 'world_titan');
  assert.equal(isWorldCoordinateWalkable(0, 0), false);
  const path = computeAStarAvoidKeepPath({ x: -16, z: 0 }, { x: 16, z: 0 });
  assert.ok(path.every((pt) => isWorldCoordinateWalkable(pt.x, pt.z)));
  assert.ok(calculateWeatherGatherRate(1000n, 'oil', 'storm') > 1000n);
});

test('Bioscience Protein Workbench: canonical AlphaFold pLDDT 4-band colors and TP53/BRCA1/EGFR/HBB structures', () => {
  assert.equal(getAlphaFoldPlddtColor(95).hex, '#0053D6');
  assert.equal(getAlphaFoldPlddtColor(80).hex, '#65CBF3');
  assert.equal(getAlphaFoldPlddtColor(60).hex, '#FFDB13');
  assert.equal(getAlphaFoldPlddtColor(40).hex, '#FF7D45');

  const tp53 = getBioscienceTarget('TP53');
  assert.equal(tp53.uniprotId, 'P04637');
  assert.ok(tp53.residues.length >= 30);
  assert.ok(tp53.residues.some((r) => r.isMutationHotspot));
});
