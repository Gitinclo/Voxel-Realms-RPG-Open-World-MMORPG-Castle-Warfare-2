import {
  BIOSCIENCE_TARGETS,
  getAlphaFoldPlddtColor,
} from '../game/bioscience';
import {
  formatBigInt,
  getCastleEra,
  getCastleUpgradeCost,
  calculateCastleTroopCapacity,
  calculateRallyCapacity,
  getTroopTierInfo,
  MAX_CASTLE_LEVEL,
} from '../game/math';
import {
  calculateTrainingDurationMs,
  formatTrainingCountdown,
} from '../game/troopTraining';
import {
  CULTIVATION_REALMS,
  CULTIVATION_PATH_META,
  CULTIVATION_MANUALS,
  CULTIVATION_PILLS,
  SPIRITUAL_ROOTS,
  calculateFourPathSynergy,
  calculateRealmSuppression,
  calculateMasterDiscipleEconomy,
  getCultivationAuraVisualSpec,
  evaluatePvPKillKarma,
  calculateQiRequired,
  buildDefaultCultivationHistory,
  appendCultivationHistorySnapshot,
  calculatePathStageScore,
} from '../game/cultivationMath';
import {
  renderCultivationGrowthD3Chart,
  PATH_CHART_COLORS,
} from './cultivationChart';
import {
  HERO_SKIN_CATALOG,
  HeroSkinId,
} from '../game/heroSkins';
import {
  WEATHER_CONFIGS,
  WeatherType,
  getNextWeather,
  calculateWeatherGatherRate,
} from '../game/weather';
import {
  VIP_TIER_CONFIGS,
  VipTierId,
  BillingCycle,
  evaluateVipSubscription,
  activateVipSubscription,
  claimVipDailyStipend,
  applyVipDiscountToCosts,
} from '../game/vipSubscription';
import {
  evaluateDailyLoginState,
  getSevenDayRewardSchedule,
  claimDailyLoginReward,
  calculateVeteranScrollBonuses,
  applyVeteranScrollToCultivation,
} from '../game/dailyLogin';
import {
  CPP_CODE_MODULES,
  CPP_ENGINE_SPEC,
  getSimulatedEngineStats,
} from '../game/cppEngine';
import {
  computeMasterTextureImportOverride,
  computeLodChainPolicy,
  computeLightingStrategy,
  computeUberShaderKeywords,
  computeDeploymentBundleManifest,
} from '../game/graphicsEngine';
import {
  createScaledMonsterByLevel,
  generateRadiantQuestForNPC,
} from '../game/worldAI';
import { calculateOutpostAssault } from '../game/clanMath';
import { sound } from '../game/audio';
import {
  ADMIN_MODERATOR_CONTACT_DIRECTORY,
  ModerationActionType,
  SUPER_ADMIN_EMAIL,
  SupportTicketCategory,
  applyPlayerModerationAction,
  computeSynchronizedLeaderboard,
  createContactSupportTicket,
  evaluateAdminModeratorAccess,
  resolveSupportTicket,
} from '../game/adminModeration';
import {
  appendBattleChronicleToFirestore,
  createGoogleDocChronicle,
  createGoogleFormRecruitment,
  createGoogleMeetWarRoom,
  createGoogleSheetLedger,
  createGoogleSlidesDeck,
  createGoogleTaskQuest,
  googleSignIn,
  listAllRealmSavesForAdmin,
  listGoogleContactsAllies,
  listGoogleDriveFiles,
  listGoogleKeepNotes,
  listGmailDispatches,
  loadRealmStateFromFirestore,
  logout,
  saveRealmStateToFirestore,
  saveSupportTicketToFirestore,
  scheduleCalendarSiegeRally,
  sendGmailDispatch,
} from '../services/firebaseAndWorkspace';
import {
  analyzeMediaWithArgon,
  generateLyriaMusic,
  generateOmniFlashVideo,
  generateOrEditGeminiImage,
  queryGeminiMapsGrounding,
  queryGeminiSearchGrounding,
  sendGeminiChatMessage,
  synthesizeGeminiSpeech,
  transcribeAudioWithGemini,
} from '../services/geminiClient';
import { ResourceType, TroopType } from '../types/game';
import { CultivationPath } from '../types/cultivation';

export function renderModalContent(
  app: any,
  showToast: (msg: string) => void,
  updateHUD: () => void,
  rerenderModal: () => void,
  askConfirm: (title: string, desc: string, onConfirm: () => Promise<void> | void) => void
) {
  const titleEl = document.getElementById('modal-title');
  const bodyEl = document.getElementById('modal-body');
  if (!titleEl || !bodyEl || !app.activeDrawer) return;

  const drawer = app.activeDrawer;
  const vipEval = evaluateVipSubscription(app.vipState, app.getEffectiveDateKey());
  const dailyEval = evaluateDailyLoginState(app.dailyLoginState, app.getEffectiveDateKey());

  if (drawer === 'castle') {
    const era = getCastleEra(app.castleLevel);
    const nextEra = getCastleEra(Math.min(MAX_CASTLE_LEVEL, app.castleLevel + 10));
    const baseCost = getCastleUpgradeCost(app.castleLevel);
    const discountedCost = applyVipDiscountToCosts(
      baseCost,
      vipEval.tierConfig.perks.castleUpgradeDiscountPct
    );
    const troopCap = calculateCastleTroopCapacity(app.castleLevel);
    const baseRallyCap = calculateRallyCapacity(app.castleLevel);
    const rallyCap =
      (baseRallyCap * BigInt(100 + vipEval.tierConfig.perks.rallyCapacityBonusPct)) / 100n;

    titleEl.textContent = `🏰 IMPERIAL CITADEL KEEP — LEVEL ${app.castleLevel} / ${MAX_CASTLE_LEVEL}`;
    bodyEl.innerHTML = `
      <div class="panel-grid">
        <div class="panel-card" style="border-color:rgba(245,158,11,0.45);">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span class="hud-stat-label">Current Architectural Era</span>
            <span style="font-size:0.72rem;padding:2px 8px;border-radius:99px;background:rgba(245,158,11,0.2);color:#fde68a;border:1px solid rgba(245,158,11,0.4);font-weight:700;">
              ${era.name} (Lv ${era.minLevel}–${era.maxLevel})
            </span>
          </div>
          <div style="font-size:1.35rem;font-weight:800;color:#fde68a;font-family:'Cinzel',serif;">
            Citadel Keep Level ${app.castleLevel}
          </div>
          <div style="font-size:0.82rem;color:#cbd5e1;line-height:1.5;">
            • <strong>Garrison Capacity</strong>: <span class="font-mono-num" style="color:#4ade80;">${formatBigInt(troopCap)} Troops</span> (1,000T at Lv.100)<br/>
            • <strong>Alliance Rally Cap</strong>: <span class="font-mono-num" style="color:#38bdf8;">${formatBigInt(rallyCap)} Troops</span> (1T at Lv.100)<br/>
            • <strong>VIP Cost Discount (${vipEval.tierConfig.badgeLabel})</strong>: <span style="color:#fbbf24;">-${vipEval.tierConfig.perks.castleUpgradeDiscountPct}% Resources</span><br/>
            • <strong>Next Era Milestone</strong>: ${nextEra.name}
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
            <button id="modal-upgrade-castle-btn" class="action-btn" style="flex:1;padding:10px 16px;font-size:0.86rem;">
              ⬆️ Upgrade Keep to Lv.${Math.min(100, app.castleLevel + 1)}
            </button>
            <button id="modal-ascend-era-btn" class="action-btn-secondary" style="padding:10px 14px;">
              ⚡ +10 Era Ascend
            </button>
          </div>
        </div>

        <div class="panel-card">
          <div class="hud-stat-label">Upgrade Resource Requirements (VIP Discount Applied)</div>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:4px;font-size:0.8rem;">
            <div style="background:rgba(7,11,20,0.8);padding:8px;border-radius:8px;border:1px solid rgba(148,163,184,0.2);">
              🪵 Wood: <strong class="font-mono-num" style="color:#fde68a;">${formatBigInt(discountedCost.wood)}</strong>
              <div style="font-size:0.7rem;color:#94a3b8;">Owned: ${formatBigInt(app.resources.wood)}</div>
            </div>
            <div style="background:rgba(7,11,20,0.8);padding:8px;border-radius:8px;border:1px solid rgba(148,163,184,0.2);">
              ⚙️ Steel: <strong class="font-mono-num" style="color:#cbd5e1;">${formatBigInt(discountedCost.steel)}</strong>
              <div style="font-size:0.7rem;color:#94a3b8;">Owned: ${formatBigInt(app.resources.steel)}</div>
            </div>
            <div style="background:rgba(7,11,20,0.8);padding:8px;border-radius:8px;border:1px solid rgba(148,163,184,0.2);">
              🪙 Copper: <strong class="font-mono-num" style="color:#fbbf24;">${formatBigInt(discountedCost.copper)}</strong>
              <div style="font-size:0.7rem;color:#94a3b8;">Owned: ${formatBigInt(app.resources.copper)}</div>
            </div>
            <div style="background:rgba(7,11,20,0.8);padding:8px;border-radius:8px;border:1px solid rgba(148,163,184,0.2);">
              🌾 Grain: <strong class="font-mono-num" style="color:#4ade80;">${formatBigInt(discountedCost.grain)}</strong>
              <div style="font-size:0.7rem;color:#94a3b8;">Owned: ${formatBigInt(app.resources.grain)}</div>
            </div>
            <div style="background:rgba(7,11,20,0.8);padding:8px;border-radius:8px;border:1px solid rgba(148,163,184,0.2);">
              🛢️ Oil: <strong class="font-mono-num" style="color:#a855f7;">${formatBigInt(discountedCost.oil)}</strong>
              <div style="font-size:0.7rem;color:#94a3b8;">Owned: ${formatBigInt(app.resources.oil)}</div>
            </div>
            <div style="background:rgba(7,11,20,0.8);padding:8px;border-radius:8px;border:1px solid rgba(148,163,184,0.2);">
              💎 Diamonds: <strong class="font-mono-num" style="color:#38bdf8;">${formatBigInt(discountedCost.diamond)}</strong>
              <div style="font-size:0.7rem;color:#94a3b8;">Owned: ${formatBigInt(app.resources.diamond)}</div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-upgrade-castle-btn')?.addEventListener('click', () => {
      app.upgradeCastle();
    });
    document.getElementById('modal-ascend-era-btn')?.addEventListener('click', () => {
      app.castleLevel = Math.min(100, app.castleLevel + 10);
      sound.playUpgradeFanfare();
      app.rebuildCastleMesh();
      updateHUD();
      rerenderModal();
      showToast(`🏰 Imperial Citadel ascended to Level ${app.castleLevel} (${getCastleEra(app.castleLevel).name})!`);
    });
    return;
  }

  if (drawer === 'troops') {
    titleEl.textContent = '⚔️ T1–T20 IMMORTAL LEGION BARRACKS & COUNTER MATRIX';
    const selectedType: TroopType = app.selectedBarracksType || 'shieldbearer';
    const selectedTier: number = app.selectedBarracksTier || 5;
    const batchAmount: bigint = BigInt(app.selectedBarracksBatch || 5000);
    const info = getTroopTierInfo(selectedType, selectedTier);
    const est = calculateTrainingDurationMs({
      tier: selectedTier,
      amount: batchAmount,
      castleLevel: app.castleLevel,
      vipSpeedBonusPct: vipEval.tierConfig.perks.gatherSpeedBonusPct,
    });

    bodyEl.innerHTML = `
      <div class="panel-grid">
        <div class="panel-card">
          <div class="hud-stat-label">Select Unit Archetype (Rock-Paper-Scissors Counter)</div>
          <div style="display:flex;gap:8px;margin-top:4px;">
            ${(['shieldbearer', 'shooter', 'bomber'] as TroopType[])
              .map(
                (t) => `
              <button class="action-btn-secondary barracks-type-btn" data-type="${t}" style="flex:1;${selectedType === t ? 'border-color:#f59e0b;background:rgba(245,158,11,0.2);color:#fef3c7;' : ''}">
                ${t === 'shieldbearer' ? '🛡️ Shieldbearer' : t === 'shooter' ? '🏹 Shooter' : '💣 Bomber'}
              </button>
            `
              )
              .join('')}
          </div>
          <div style="font-size:0.78rem;color:#94a3b8;margin-top:4px;">
            • <strong>Shieldbearer</strong> counters <strong>Shooter</strong> (1.35x DMG) · <strong>Shooter</strong> counters <strong>Bomber</strong> (1.35x DMG) · <strong>Bomber</strong> counters <strong>Shieldbearer</strong> (1.35x DMG)
          </div>

          <div class="hud-stat-label" style="margin-top:8px;">Select Tier (T1–T20) & Batch Size</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${[1, 3, 5, 8, 10, 12, 15, 18, 20]
              .map(
                (tier) => `
              <button class="action-btn-secondary barracks-tier-btn" data-tier="${tier}" style="padding:5px 10px;${selectedTier === tier ? 'border-color:#38bdf8;background:rgba(56,189,248,0.22);color:#fff;' : ''}">
                T${tier}
              </button>
            `
              )
              .join('')}
          </div>
          <div style="display:flex;gap:6px;margin-top:6px;">
            ${[1000, 5000, 25000, 100000]
              .map(
                (amt) => `
              <button class="action-btn-secondary barracks-batch-btn" data-batch="${amt}" style="flex:1;${Number(batchAmount) === amt ? 'border-color:#4ade80;color:#4ade80;' : ''}">
                +${formatBigInt(BigInt(amt))}
              </button>
            `
              )
              .join('')}
          </div>
        </div>

        <div class="panel-card" data-testid="barracks-active-training-panel">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span class="hud-stat-label">Selected Unit Dossier</span>
            <span class="font-mono-num" data-testid="barracks-estimated-time" style="font-size:0.75rem;color:#38bdf8;">
              Est. Time: ${formatTrainingCountdown(est.durationMs)}
            </span>
          </div>
          <div style="font-size:1.15rem;font-weight:800;color:#fde68a;">${info.name} (Tier ${selectedTier})</div>
          <div class="font-mono-num" style="font-size:0.8rem;color:#cbd5e1;">
            ATK: ${formatBigInt(info.attack)} | DEF: ${formatBigInt(info.defense)} | HP: ${formatBigInt(info.hp)}<br/>
            Power / Unit: <strong style="color:#4ade80;">${formatBigInt(info.powerPerUnit)}</strong> | Owned: <strong style="color:#fde68a;">${formatBigInt(app.troops[`${selectedType}_t${selectedTier}`] || 0n)}</strong>
          </div>
          <div style="display:flex;gap:8px;margin-top:8px;">
            <button id="barracks-recruit-btn" data-testid="barracks-recruit-btn" class="action-btn" style="flex:1;padding:10px;">
              ⚔️ Mobilize +${formatBigInt(batchAmount)} ${info.name}
            </button>
            <button id="barracks-instant-finish-btn" data-testid="barracks-instant-finish-btn" class="action-btn-secondary">
              ⚡ Instant Mobilize (+50K T${selectedTier})
            </button>
          </div>
        </div>
      </div>

      <div class="panel-card">
        <div class="hud-stat-label">Active Grand Army Roster Overview</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(195px,1fr));gap:8px;max-height:190px;overflow-y:auto;">
          ${[1, 5, 10, 15, 20]
            .map((t) => {
              const s = app.troops[`shieldbearer_t${t}`] || 0n;
              const r = app.troops[`shooter_t${t}`] || 0n;
              const b = app.troops[`bomber_t${t}`] || 0n;
              return `
                <div style="background:rgba(7,11,20,0.8);padding:8px 10px;border-radius:8px;border:1px solid rgba(148,163,184,0.2);">
                  <div style="font-weight:700;color:#fde68a;font-size:0.8rem;">Tier ${t} Legions</div>
                  <div class="font-mono-num" style="font-size:0.74rem;color:#cbd5e1;margin-top:3px;">
                    🛡️ Shield: ${formatBigInt(s)}<br/>
                    🏹 Shooter: ${formatBigInt(r)}<br/>
                    💣 Bomber: ${formatBigInt(b)}
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>
      </div>
    `;

    bodyEl.querySelectorAll('.barracks-type-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        app.selectedBarracksType = btn.getAttribute('data-type') as TroopType;
        rerenderModal();
      });
    });
    bodyEl.querySelectorAll('.barracks-tier-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        app.selectedBarracksTier = Number(btn.getAttribute('data-tier'));
        rerenderModal();
      });
    });
    bodyEl.querySelectorAll('.barracks-batch-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        app.selectedBarracksBatch = Number(btn.getAttribute('data-batch'));
        rerenderModal();
      });
    });
    document.getElementById('barracks-recruit-btn')?.addEventListener('click', () => {
      app.trainTroops(selectedTier, selectedType, batchAmount);
    });
    document.getElementById('barracks-instant-finish-btn')?.addEventListener('click', () => {
      app.trainTroops(selectedTier, selectedType, 50_000n);
    });
    return;
  }

  if (drawer === 'cultivation') {
    titleEl.textContent = '✨ CAVE ABODE: FOUR-PATH CULTIVATION (23 REALMS), 100X SUPPRESSION & KARMA';
    const rIdx = app.getHighestRealmIndex();
    const suppression = calculateRealmSuppression(Math.max(2, rIdx), 0);
    const synergy = calculateFourPathSynergy(app.cultivation.paths);
    const econ = calculateMasterDiscipleEconomy({
      masterRealmIndex: rIdx + 2,
      disciples: app.cultivation.disciples,
      masterTaxRatePct: app.cultivation.masterTaxRatePct,
    });
    const auraSpec = getCultivationAuraVisualSpec(rIdx);
    const vetBonus = calculateVeteranScrollBonuses(
      app.cultivation.veteranScrollsComprehended ?? app.cultivation.veteranScrolls ?? 0
    );
    if (!app.cultivation.growthHistory || app.cultivation.growthHistory.length === 0) {
      app.cultivation.growthHistory = buildDefaultCultivationHistory(
        app.cultivation.paths,
        app.cultivation.secludedYears
      );
    }
    const history = app.cultivation.growthHistory;
    const chartMode = app.cultivation.chartMode || 'stage_progression';
    const firstSnap = history[0];
    const latestSnap = history[history.length - 1];

    bodyEl.innerHTML = `
      <div class="panel-card" data-testid="cultivation-d3-analytics-card" style="border-color:rgba(251,191,36,0.45);background:rgba(7,11,20,0.92);">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <div>
            <div class="hud-stat-label">📈 D3.JS CULTIVATION GROWTH & FOUR-PATH PROGRESSION CHRONICLE</div>
            <div style="font-size:0.78rem;color:#cbd5e1;">
              Secluded Duration: <strong class="font-mono-num" style="color:#fde68a;">${app.cultivation.secludedYears.toLocaleString()} Realm Years</strong>
              · Recorded Milestones: <strong class="font-mono-num" style="color:#38bdf8;">${history.length}</strong>
              · Total Stage Index: <strong class="font-mono-num" style="color:#4ade80;">${latestSnap.totalStageScore.toFixed(1)} / 828</strong>
            </div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button id="chart-mode-stage-btn" data-testid="chart-mode-stage-btn" class="action-btn-secondary" style="padding:5px 10px;font-size:0.74rem;${chartMode === 'stage_progression' ? 'border-color:#fbbf24;background:rgba(251,191,36,0.22);color:#fef3c7;' : ''}">
              📊 Stage Progression (L1–L207)
            </button>
            <button id="chart-mode-power-btn" data-testid="chart-mode-power-btn" class="action-btn-secondary" style="padding:5px 10px;font-size:0.74rem;${chartMode === 'log_power' ? 'border-color:#38bdf8;background:rgba(56,189,248,0.22);color:#e0f2fe;' : ''}">
              ⚡ Log₁₀ Dao Power Curve
            </button>
            <button id="chart-simulate-seclusion-btn" data-testid="chart-simulate-seclusion-btn" class="action-btn" style="padding:5px 12px;font-size:0.74rem;">
              🧘 +50y Secluded Meditation
            </button>
          </div>
        </div>

        <div id="cultivation-d3-chart-container" data-testid="cultivation-d3-chart-container" style="position:relative;width:100%;min-height:250px;margin-top:6px;padding:6px 4px;border-radius:10px;background:rgba(2,6,23,0.85);border:1px solid rgba(148,163,184,0.18);"></div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:6px;">
          ${(['qi', 'body', 'soul', 'mind'] as CultivationPath[])
            .map((path) => {
              const meta = CULTIVATION_PATH_META[path];
              const col = PATH_CHART_COLORS[path];
              const curScore = calculatePathStageScore(
                app.cultivation.paths[path].realmIndex,
                app.cultivation.paths[path].layer,
                app.cultivation.paths[path].currentEnergy,
                path
              );
              const startScore = firstSnap ? firstSnap.paths[path].stageScore : 1;
              const deltaScore = Math.max(0, curScore - startScore);
              return `
                <div style="background:rgba(15,23,42,0.85);padding:6px 9px;border-radius:8px;border-left:3px solid ${col};border-top:1px solid rgba(148,163,184,0.15);border-right:1px solid rgba(148,163,184,0.15);border-bottom:1px solid rgba(148,163,184,0.15);">
                  <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.72rem;">
                    <strong style="color:${col};">${meta.icon} ${path.toUpperCase()} Path</strong>
                    <span class="font-mono-num" style="color:#4ade80;font-size:0.68rem;">+${deltaScore.toFixed(1)} Lv</span>
                  </div>
                  <div class="font-mono-num" style="font-size:0.74rem;color:#e2e8f0;margin-top:2px;">
                    Stage <strong>${curScore.toFixed(2)}</strong> · 10^${latestSnap.paths[path].logPowerMult.toFixed(1)}x
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>
      </div>

      <div class="panel-grid">
        ${(['qi', 'body', 'soul', 'mind'] as CultivationPath[])
          .map((path) => {
            const st = app.cultivation.paths[path];
            const meta = CULTIVATION_PATH_META[path];
            const rDef = CULTIVATION_REALMS[st.realmIndex] || CULTIVATION_REALMS[0];
            const req = calculateQiRequired(st.realmIndex, st.layer);
            const pct = Math.min(100, Math.round((Number(st.currentEnergy) / Math.max(1, Number(req))) * 100));
            return `
              <div class="panel-card">
                <div class="hud-stat-label">${meta.icon} ${meta.name} (${meta.chineseName})</div>
                <div style="font-size:1.02rem;font-weight:700;color:#38bdf8;">
                  ${rDef.icon} ${rDef.name} (${rDef.chineseName}) — Layer ${st.layer}/9
                </div>
                <div style="font-size:0.74rem;color:#94a3b8;">${meta.combatBonusDesc}</div>
                <div class="hp-bar-track" style="width:100%;margin:4px 0;">
                  <div class="hp-bar-fill" style="width:${pct}%;background:linear-gradient(90deg,#0ea5e9,#a855f7);"></div>
                </div>
                <div style="display:flex;gap:6px;margin-top:4px;">
                  <button class="action-btn cult-btn" data-path="${path}" style="flex:1;">Refine ${path.toUpperCase()}</button>
                  <button class="action-btn-secondary break-btn" data-path="${path}" style="flex:1;">⚡ Breakthrough</button>
                </div>
              </div>
            `;
          })
          .join('')}
      </div>

      <div class="panel-grid">
        <div class="panel-card">
          <div class="hud-stat-label">100x Realm Suppression, Karma & Heavenly Tribulation</div>
          <div style="font-size:0.8rem;color:#cbd5e1;line-height:1.45;">
            • <strong>3D Aura Visual</strong>: ${auraSpec.label} (${auraSpec.chineseLabel})<br/>
            • <strong>Realm Suppression</strong>: ${suppression.suppressionLabel} (${suppression.damageMultiplier.toLocaleString()}x vs Qi Refinement)<br/>
            • <strong>Four-Path Synergy</strong>: ${synergy.totalCombinedMultiplier.toFixed(2)}x Combined Multiplier<br/>
            • <strong>Karma Alignment</strong>: <strong style="color:${app.cultivation.karma.alignment === 'red_fiend' ? '#f87171' : '#4ade80'};">${app.cultivation.karma.alignment.toUpperCase()} (${app.cultivation.karma.karmaValue})</strong>
          </div>
          <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap;">
            <button id="btn-toggle-karma" class="action-btn-secondary">Simulate Unlawful Kill (Red-Name Fiend)</button>
            <button id="btn-test-tribulation" class="action-btn">⚡ Strike Tribulation Lightning</button>
          </div>
        </div>

        <div class="panel-card">
          <div class="hud-stat-label">Master & Disciple Lineage + Veteran Scroll Sanctum</div>
          <div style="font-size:0.8rem;color:#cbd5e1;line-height:1.45;">
            • Disciples within 50m: <strong>${econ.nearDisciplesCount} / ${app.cultivation.disciples.length}</strong> (+${econ.proximitySpeedBuffPct}% Speed)<br/>
            • Tax Yield (${app.cultivation.masterTaxRatePct}%): <strong>+${formatBigInt(econ.totalMasterTaxSpiritStonesPerSec)}/s</strong> Spirit Stones & <strong>+${formatBigInt(econ.totalMasterTaxQiPerSec)}/s</strong> Qi<br/>
            • Owned Veteran Scrolls: <strong style="color:#fde68a;" data-testid="owned-veteran-scrolls-badge">${app.cultivation.veteranScrolls || 0}</strong> (+${vetBonus.passiveSpeedBonusPct}% Speed)
          </div>
          <div style="display:flex;gap:6px;margin-top:6px;">
            <button id="btn-use-vet-scroll" data-testid="comprehend-veteran-scroll-btn" class="action-btn" style="flex:1;">
              📜 Comprehend Veteran Scroll (All Paths)
            </button>
          </div>
        </div>
      </div>
    `;

    const chartContainer = document.getElementById('cultivation-d3-chart-container');
    if (chartContainer) {
      renderCultivationGrowthD3Chart({
        container: chartContainer,
        history,
        mode: chartMode,
      });
    }

    document.getElementById('chart-mode-stage-btn')?.addEventListener('click', () => {
      app.cultivation.chartMode = 'stage_progression';
      rerenderModal();
    });
    document.getElementById('chart-mode-power-btn')?.addEventListener('click', () => {
      app.cultivation.chartMode = 'log_power';
      rerenderModal();
    });
    document.getElementById('chart-simulate-seclusion-btn')?.addEventListener('click', () => {
      app.meditateSecludedYears(50);
    });

    bodyEl.querySelectorAll('.cult-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        app.cultivatePath(btn.getAttribute('data-path') as CultivationPath);
      });
    });
    bodyEl.querySelectorAll('.break-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        app.breakthroughPath(btn.getAttribute('data-path') as CultivationPath);
      });
    });
    document.getElementById('btn-toggle-karma')?.addEventListener('click', () => {
      const outcome = evaluatePvPKillKarma({
        currentKarma: app.cultivation.karma,
        attackerRealmIndex: Math.max(2, app.getHighestRealmIndex()),
        victimRealmIndex: 0,
        victimKarmaValue: 100,
        victimName: 'Junior Sect Disciple',
      });
      app.cultivation.karma = outcome.updatedKarma;
      app.rebuildPlayerMesh();
      updateHUD();
      rerenderModal();
      showToast(outcome.message);
    });
    document.getElementById('btn-test-tribulation')?.addEventListener('click', () => {
      app.triggerTribulationLightningStrike();
    });
    document.getElementById('btn-use-vet-scroll')?.addEventListener('click', () => {
      if ((app.cultivation.veteranScrolls || 0) <= 0) {
        app.cultivation.veteranScrolls = 2;
      }
      const res = applyVeteranScrollToCultivation(app.cultivation, 'all', 1);
      app.cultivation = res.updatedCultivation;
      sound.playUpgradeFanfare();
      updateHUD();
      rerenderModal();
      showToast(res.message);
    });
    return;
  }

  if (drawer === 'hero') {
    titleEl.textContent = '🎖️ IMMORTAL HERO PANTHEON & MYTHIC HERO SKINS';
    const selectedHero = app.heroes.find((h: any) => h.id === app.selectedHeroId) || app.heroes[0];
    const skinList = Object.values(HERO_SKIN_CATALOG);
    const activeSkin = HERO_SKIN_CATALOG[(selectedHero.equippedSkinId as HeroSkinId) || 'default'] || HERO_SKIN_CATALOG.default;

    bodyEl.innerHTML = `
      <div class="panel-grid">
        <div class="panel-card">
          <div class="hud-stat-label">Immortal Commanders Roster (Select to Inspect)</div>
          <div style="display:flex;flex-direction:column;gap:8px;margin-top:4px;">
            ${app.heroes
              .map(
                (h: any) => `
              <div data-testid="roster-hero-card-${h.id}" class="hero-select-card" data-hid="${h.id}" style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-radius:8px;cursor:pointer;background:rgba(7,11,20,0.85);border:1px solid ${h.id === selectedHero.id ? '#f59e0b' : 'rgba(148,163,184,0.2)'};">
                <div style="display:flex;align-items:center;gap:10px;">
                  <span data-testid="roster-hero-icon-${h.id}" style="font-size:1.4rem;">${h.avatarIcon}</span>
                  <div>
                    <div style="font-weight:700;color:#fde68a;font-size:0.86rem;">${h.name} <span style="font-size:0.72rem;color:#38bdf8;">[${h.rarity.toUpperCase()}]</span></div>
                    <div style="font-size:0.72rem;color:#94a3b8;">Lv.${h.level} · ${h.title} · +${h.statBonus.attackBonusPct}% ${h.troopSpecialty.toUpperCase()}</div>
                  </div>
                </div>
                <button class="action-btn hero-lvl-btn" data-hid="${h.id}" style="padding:5px 10px;font-size:0.72rem;">+1 Level Up</button>
              </div>
            `
              )
              .join('')}
          </div>
        </div>

        <div class="panel-card" data-testid="hero-aura-stage">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span class="hud-stat-label">Selected Hero & Mythic Skin Customization</span>
            <span data-testid="active-hero-skin-name" style="font-size:0.74rem;color:#c084fc;font-weight:700;">
              Skin: ${activeSkin.name}
            </span>
          </div>
          <div style="display:flex;align-items:center;gap:14px;padding:10px;background:rgba(7,11,20,0.8);border-radius:10px;">
            <span data-testid="selected-hero-avatar-icon" style="font-size:2.4rem;">${selectedHero.avatarIcon}</span>
            <div>
              <div style="font-size:1.1rem;font-weight:800;color:#fde68a;">${selectedHero.name} (Lv.${selectedHero.level})</div>
              <div data-testid="active-hero-aura-name" style="font-size:0.78rem;color:#38bdf8;">Aura: ${activeSkin.auraName}</div>
              <div style="font-size:0.76rem;color:#cbd5e1;margin-top:2px;">Skill: <strong>${selectedHero.skillName}</strong> — ${selectedHero.skillDesc}</div>
            </div>
          </div>

          <div data-testid="hero-skin-customization-section" style="margin-top:6px;">
            <div class="hud-stat-label">Equip Mythic Hero Skin (Boosts Command Bonus & Aura)</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;">
              ${skinList
                .map((skin) => {
                  const icon = skin.heroIconMap[selectedHero.id] || skin.specialtyFallbackIcons[selectedHero.troopSpecialty as TroopType] || '✨';
                  return `
                <button data-testid="hero-skin-btn-${skin.id}" class="action-btn-secondary equip-skin-btn" data-skin="${skin.id}" style="flex:1;min-width:140px;text-align:left;${(selectedHero.equippedSkinId || 'default') === skin.id ? 'border-color:#f59e0b;background:rgba(245,158,11,0.2);' : ''}">
                  <div style="font-weight:700;color:#fde68a;">${icon} ${skin.name}</div>
                  <div style="font-size:0.7rem;color:#94a3b8;">${skin.auraName}</div>
                </button>
              `;
                })
                .join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    bodyEl.querySelectorAll('.hero-select-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).classList.contains('hero-lvl-btn')) return;
        app.selectedHeroId = card.getAttribute('data-hid');
        rerenderModal();
      });
    });
    bodyEl.querySelectorAll('.hero-lvl-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const hid = btn.getAttribute('data-hid');
        app.levelUpHero(hid!);
      });
    });
    bodyEl.querySelectorAll('.equip-skin-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const skinId = btn.getAttribute('data-skin') as HeroSkinId;
        app.selectHeroSkin(selectedHero.id, skinId);
      });
    });
    return;
  }

  if (drawer === 'clan') {
    titleEl.textContent = `🛡️ CLAN ALLIANCE [${app.clan.tag}] ${app.clan.name} & TERRITORY WARFARE`;
    const war = app.clan.activeWar;
    const controlledOutposts = (war?.outposts || []).filter((op: any) => op.controlledBy === 'player_clan').length;
    const totalSectors = 12 + controlledOutposts;
    bodyEl.innerHTML = `
      <div class="panel-grid">
        <div class="panel-card">
          <div class="hud-stat-label">Alliance Citadel & Treasury Vault</div>
          <div style="font-size:1.1rem;font-weight:800;color:#fde68a;">[${app.clan.tag}] ${app.clan.name} (Lv.${app.clan.level})</div>
          <div style="font-size:0.8rem;color:#cbd5e1;line-height:1.45;">
            • Total Clan Power: <strong class="font-mono-num" style="color:#4ade80;">${formatBigInt(app.clan.totalPower)}</strong><br/>
            • Alliance Honor: <strong class="font-mono-num" style="color:#fbbf24;">${formatBigInt(app.clan.vault.clanHonor)}</strong> | Personal Clan Coins: <strong class="font-mono-num">${formatBigInt(app.clanCoins)}</strong><br/>
            • Controlled Territories: <strong data-testid="clan-controlled-sectors">${totalSectors} Citadel Sectors (${controlledOutposts}/${(war?.outposts || []).length} Outposts)</strong><br/>
            • Clan Tech: <span class="font-mono-num" style="color:#38bdf8;">ATK Lv.${app.clan.techLevel.troopAttack} · DEF Lv.${app.clan.techLevel.troopDefense} · Gather Lv.${app.clan.techLevel.gatherSpeed} · Rally Lv.${app.clan.techLevel.rallyCapacity}</span>
          </div>
          <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap;">
            <button id="clan-donate-wood-btn" class="action-btn" style="flex:1;">🎁 Donate 10K Wood (+500 Honor)</button>
            <button id="clan-upgrade-tech-btn" data-testid="clan-upgrade-tech-btn" class="action-btn-secondary" style="flex:1;">⬆️ Upgrade All Clan Tech</button>
            <button id="clan-attack-coop-btn" class="action-btn-secondary" style="flex:1;">🐲 Strike Clan Co-Op Boss</button>
          </div>
        </div>

        <div class="panel-card">
          <div class="hud-stat-label">Territory Outpost Siege Warfare (${war ? war.enemyClanName : 'Rival Clan'})</div>
          <div style="font-size:0.78rem;color:#94a3b8;margin-bottom:4px;">
            Score: <strong style="color:#4ade80;">${war ? war.playerClanScore : 0}</strong> vs <strong style="color:#f87171;">${war ? war.enemyClanScore : 0}</strong>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            ${(war?.outposts || [])
              .map(
                (op: any) => `
              <div style="display:flex;justify-content:space-between;align-items:center;background:rgba(7,11,20,0.8);padding:6px 10px;border-radius:8px;border:1px solid rgba(148,163,184,0.2);">
                <div>
                  <strong style="color:#fde68a;font-size:0.8rem;">${op.name}</strong>
                  <span style="font-size:0.7rem;color:${op.controlledBy === 'player_clan' ? '#4ade80' : '#f87171'};margin-left:6px;">
                    [${op.controlledBy === 'player_clan' ? 'CONTROLLED' : 'ENEMY HELD'}]
                  </span>
                </div>
                <button class="action-btn assault-outpost-btn" data-op="${op.id}" style="padding:4px 10px;font-size:0.72rem;">⚔️ Assault</button>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      </div>

      <div class="panel-card">
        <div class="hud-stat-label">Alliance War Chat & Member Hierarchy (${app.clanMembers.length} Members)</div>
        <div style="max-height:110px;overflow-y:auto;background:rgba(7,11,20,0.85);padding:8px;border-radius:8px;font-size:0.76rem;display:flex;flex-direction:column;gap:4px;">
          ${app.clanChat
            .slice(0, 8)
            .map(
              (c: any) =>
                `<div><strong style="color:#fde68a;">[${c.senderRole}] ${c.senderName}:</strong> <span style="color:#e2e8f0;">${c.message}</span></div>`
            )
            .join('')}
        </div>
        <div style="display:flex;gap:6px;margin-top:4px;">
          <input id="clan-chat-input" class="input-field" placeholder="Broadcast alliance war decree..." />
          <button id="clan-chat-send-btn" class="action-btn">Send</button>
        </div>
      </div>
    `;

    document.getElementById('clan-donate-wood-btn')?.addEventListener('click', () => {
      app.donateToClan('wood', 10_000n, 500n);
    });
    document.getElementById('clan-upgrade-tech-btn')?.addEventListener('click', () => {
      app.clan.techLevel.troopAttack += 1;
      app.clan.techLevel.troopDefense += 1;
      app.clan.techLevel.gatherSpeed += 1;
      app.clan.techLevel.rallyCapacity += 1;
      app.clan.totalPower += 250_000_000n;
      sound.playUpgradeFanfare();
      updateHUD();
      rerenderModal();
      showToast('⬆️ Upgraded all 4 Clan Alliance Technologies (+250M Clan Power)!');
    });
    document.getElementById('clan-attack-coop-btn')?.addEventListener('click', () => {
      sound.playExplosion();
      app.clanCoins += 1200n;
      app.resources.diamond += 5000n;
      updateHUD();
      rerenderModal();
      showToast('🐲 Struck Clan Co-Op Boss for Massive Sovereign DMG! Earned +5,000 💎 & +1,200 Clan Coins!');
    });
    bodyEl.querySelectorAll('.assault-outpost-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const opId = btn.getAttribute('data-op')!;
        app.assaultClanOutpost(opId);
      });
    });
    document.getElementById('clan-chat-send-btn')?.addEventListener('click', () => {
      const inp = document.getElementById('clan-chat-input') as HTMLInputElement | null;
      const text = inp?.value.trim();
      if (!text) return;
      app.clanChat.unshift({
        id: `c_${Date.now()}`,
        senderId: 'cm_player',
        senderName: app.playerAppearance.name,
        senderRole: 'Leader',
        senderAvatar: '👑',
        message: text,
        timestamp: Date.now(),
      });
      rerenderModal();
    });
    return;
  }

  if (drawer === 'world_boss') {
    const boss = app.selectedMonster || app.monsters[app.monsters.length - 1];
    const baseRallyCap = calculateRallyCapacity(app.castleLevel);
    const rallyCap =
      (baseRallyCap * BigInt(100 + vipEval.tierConfig.perks.rallyCapacityBonusPct)) / 100n;
    const rewardDia = boss.dropResources?.diamond || 12000n;
    titleEl.textContent = `🐲 WORLD TITAN RALLY SIEGE — ${boss.name.toUpperCase()} (LV.${boss.level})`;
    bodyEl.innerHTML = `
      <div class="panel-grid">
        <div class="panel-card" style="border-color:rgba(239,68,68,0.45);">
          <div class="hud-stat-label">Target World Boss / Monster Telemetry</div>
          <div style="font-size:1.2rem;font-weight:800;color:#f87171;">${boss.name} (Lv.${boss.level} · ${boss.tier.toUpperCase()})</div>
          <div class="font-mono-num" style="font-size:0.8rem;color:#cbd5e1;line-height:1.5;">
            • HP Remaining: <strong style="color:#f87171;">${formatBigInt(boss.hp)} / ${formatBigInt(boss.maxHp)}</strong><br/>
            • AI Archetype: <strong>${boss.movementPolicy || 'supreme_arbiter'}</strong> | Bracket: <strong>${boss.complexityBracket || 'bracket_5_apex_titan'}</strong><br/>
            • Victory Bounty: <strong style="color:#38bdf8;">+${formatBigInt(boss.expReward)} EXP</strong> & <strong style="color:#fde68a;">+${formatBigInt(rewardDia)} 💎</strong>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;">
            ${app.monsters
              .map(
                (m: any) => `
              <button class="action-btn-secondary select-boss-btn" data-mid="${m.id}" style="font-size:0.72rem;padding:4px 8px;${m.id === boss.id ? 'border-color:#f87171;color:#fecaca;' : ''}">
                Lv.${m.level} ${m.name}
              </button>
            `
              )
              .join('')}
          </div>
        </div>

        <div class="panel-card">
          <div class="hud-stat-label">Launch 1-Trillion Capacity Alliance Siege Rally</div>
          <div style="font-size:0.8rem;color:#cbd5e1;line-height:1.45;">
            • Max Rally Capacity: <strong class="font-mono-num" style="color:#38bdf8;">${formatBigInt(rallyCap)} Troops</strong><br/>
            • Your Combined Legion Might: <strong class="font-mono-num" style="color:#4ade80;">${formatBigInt(app.getTotalPower())}</strong><br/>
            • Active Weather Modifier: <strong>${WEATHER_CONFIGS[app.weather as WeatherType].name}</strong>
          </div>
          <button id="launch-boss-rally-btn" class="action-btn" style="margin-top:10px;padding:12px;font-size:0.9rem;">
            📯 Launch Full-Scale Titan Siege Rally
          </button>
        </div>
      </div>
    `;

    bodyEl.querySelectorAll('.select-boss-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mid = btn.getAttribute('data-mid');
        app.selectedMonster = app.monsters.find((m: any) => m.id === mid) || app.monsters[0];
        rerenderModal();
      });
    });
    document.getElementById('launch-boss-rally-btn')?.addEventListener('click', () => {
      sound.playExplosion();
      app.resources.diamond += rewardDia;
      app.resources.wood += rewardDia * 4n;
      app.resources.steel += rewardDia * 3n;
      app.playerExp += boss.expReward;
      app.monstersSlain += 1;
      boss.hp = boss.maxHp;
      updateHUD();
      rerenderModal();
      showToast(`🏆 Victory over Lv.${boss.level} ${boss.name}! Looted +${formatBigInt(rewardDia)} 💎 & +${formatBigInt(boss.expReward)} EXP!`);
    });
    return;
  }

  if (drawer === 'world_ai' || drawer === 'world') {
    titleEl.textContent = '🧠 AUTONOMOUS WORLD AI DIRECTOR (LV 1–1000 MONSTERS & 5 NPC ROLES)';
    bodyEl.innerHTML = `
      <div class="panel-grid">
        <div class="panel-card">
          <div class="hud-stat-label">Autonomous World AI Simulation & Monster Spawner (Lv 1–1000)</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;">
            <button id="ai-step-sim-btn" class="action-btn">⚡ Step World AI Tick</button>
            <button class="action-btn-secondary spawn-lvl-btn" data-lvl="50">Spawn Lv.50 Elite</button>
            <button class="action-btn-secondary spawn-lvl-btn" data-lvl="350">Spawn Lv.350 Boss</button>
            <button class="action-btn-secondary spawn-lvl-btn" data-lvl="1000">Spawn Lv.1000 World Titan</button>
          </div>
          <div style="max-height:135px;overflow-y:auto;margin-top:8px;font-size:0.75rem;display:flex;flex-direction:column;gap:4px;">
            ${app.monsters
              .map(
                (m: any) => `
              <div style="display:flex;justify-content:space-between;background:rgba(7,11,20,0.8);padding:5px 8px;border-radius:6px;">
                <span><strong>Lv.${m.level} ${m.name}</strong> [${m.movementPolicy}]</span>
                <span class="font-mono-num" style="color:#f87171;">HP: ${formatBigInt(m.hp)}</span>
              </div>
            `
              )
              .join('')}
          </div>
        </div>

        <div class="panel-card">
          <div class="hud-stat-label">Autonomous Citizen NPCs (Directives, Stashes, Quests & Barter)</div>
          <div style="max-height:195px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;font-size:0.76rem;">
            ${app.npcs
              .map(
                (n: any) => `
              <div style="background:rgba(7,11,20,0.82);padding:8px;border-radius:8px;border:1px solid rgba(148,163,184,0.2);">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <strong style="color:#fde68a;">🧙 ${n.name} (Lv.${n.level} ${n.role.toUpperCase()})</strong>
                  <div style="display:flex;gap:4px;">
                    <button class="action-btn-secondary npc-stash-btn" data-nid="${n.id}" style="padding:3px 7px;font-size:0.68rem;">Claim Stash</button>
                    ${n.activeQuest ? `<button class="action-btn npc-quest-btn" data-nid="${n.id}" style="padding:3px 7px;font-size:0.68rem;">Complete Quest</button>` : ''}
                  </div>
                </div>
                <div style="color:#94a3b8;font-size:0.72rem;margin-top:2px;">State: ${n.aiState} · "${n.dialogue?.[0] || 'Guarding the Sovereign Realm.'}"</div>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      </div>

      <div class="panel-card">
        <div class="hud-stat-label">Live Autonomous World AI Event Telemetry</div>
        <div style="max-height:100px;overflow-y:auto;background:rgba(7,11,20,0.88);padding:8px;border-radius:8px;font-size:0.74rem;color:#cbd5e1;display:flex;flex-direction:column;gap:4px;">
          ${app.aiLogs
            .slice(0, 8)
            .map(
              (log: any) =>
                `<div><strong style="color:#38bdf8;">[${log.actorName} Lv.${log.actorLevel}]:</strong> ${log.message}</div>`
            )
            .join('')}
        </div>
      </div>
    `;

    document.getElementById('ai-step-sim-btn')?.addEventListener('click', () => {
      app.stepWorldAI();
      rerenderModal();
      showToast('🧠 Executed Autonomous World AI Simulation Tick!');
    });
    bodyEl.querySelectorAll('.spawn-lvl-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const lvl = Number(btn.getAttribute('data-lvl'));
        const m = createScaledMonsterByLevel(lvl, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40);
        app.spawnMonster(m);
        rerenderModal();
      });
    });
    bodyEl.querySelectorAll('.npc-stash-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nid = btn.getAttribute('data-nid')!;
        app.claimNPCStash(nid);
      });
    });
    bodyEl.querySelectorAll('.npc-quest-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nid = btn.getAttribute('data-nid')!;
        app.claimNPCQuest(nid);
      });
    });
    return;
  }

  if (drawer === 'daily_login') {
    titleEl.textContent = '🎁 7-DAY IMPERIAL DAILY LOGIN DECREE & VETERAN SCROLL SANCTUM';
    const schedule = getSevenDayRewardSchedule({
      castleLevel: app.castleLevel,
      cultivationRealmIndex: app.getHighestRealmIndex(),
      totalDaysClaimed: app.dailyLoginState.totalDaysClaimed || 0,
    });
    const vetBonus = calculateVeteranScrollBonuses(
      app.cultivation.veteranScrollsComprehended ?? app.cultivation.veteranScrolls ?? 0
    );

    bodyEl.innerHTML = `
      <div class="panel-card">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <div>
            <span class="hud-stat-label">Consecutive Login Streak: </span>
            <strong data-testid="daily-streak-count" style="color:#fde68a;font-size:1.05rem;">${dailyEval.currentStreak} Days</strong>
            <span style="margin-left:10px;font-size:0.78rem;color:#38bdf8;">Active Cycle: Day ${dailyEval.activeCycleDay}</span>
          </div>
          <div style="display:flex;gap:8px;">
            <button id="claim-daily-reward-btn" data-testid="claim-daily-reward-btn" class="action-btn" ${!dailyEval.canClaimToday ? 'disabled' : ''}>
              ${dailyEval.canClaimToday ? `🎁 Claim Day ${dailyEval.activeCycleDay} Decree` : '✅ Claimed Today'}
            </button>
            <button id="simulate-next-day-btn" data-testid="simulate-next-day-btn" class="action-btn-secondary">
              🌅 Advance +1 Day
            </button>
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(115px,1fr));gap:8px;">
        ${schedule
          .map((tier) => {
            const isCurrent = tier.day === dailyEval.activeCycleDay;
            return `
              <div data-testid="daily-tier-card-${tier.day}" style="background:rgba(15,23,42,0.92);border:1px solid ${isCurrent ? '#f59e0b' : 'rgba(148,163,184,0.22)'};border-radius:10px;padding:10px;text-align:center;">
                <div style="font-weight:800;color:#fde68a;font-size:0.82rem;">Day ${tier.day}</div>
                <div style="font-size:0.7rem;color:#94a3b8;margin:2px 0;">${tier.title}</div>
                <div class="font-mono-num" style="font-size:0.74rem;color:#38bdf8;font-weight:700;">+${formatBigInt(tier.resources.diamond)} 💎</div>
                <div class="font-mono-num" style="font-size:0.7rem;color:#c084fc;">+${tier.veteranScrolls}x Scroll</div>
              </div>
            `;
          })
          .join('')}
      </div>

      <div class="panel-card">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div class="hud-stat-label">Veteran Scroll Sanctum</div>
            <div style="font-size:0.8rem;color:#cbd5e1;">
              Owned Scrolls: <strong data-testid="owned-veteran-scrolls-badge" style="color:#fde68a;">${app.cultivation.veteranScrolls || 0}</strong> ·
              Speed Bonus: <span data-testid="veteran-speed-bonus" style="color:#4ade80;font-weight:700;">+${vetBonus.passiveSpeedBonusPct}%</span>
            </div>
          </div>
          <button id="daily-comprehend-scroll-btn" data-testid="comprehend-veteran-scroll-btn" class="action-btn">
            📜 Comprehend Veteran Scroll
          </button>
        </div>
      </div>
    `;

    document.getElementById('claim-daily-reward-btn')?.addEventListener('click', () => {
      app.claimDailyLogin();
    });
    document.getElementById('simulate-next-day-btn')?.addEventListener('click', () => {
      app.dailyLoginState.simulatedDayOffset = (app.dailyLoginState.simulatedDayOffset || 0) + 1;
      rerenderModal();
      updateHUD();
      showToast('🌅 Advanced calendar by +1 Day! Next Daily Login Decree is ready.');
    });
    document.getElementById('daily-comprehend-scroll-btn')?.addEventListener('click', () => {
      if ((app.cultivation.veteranScrolls || 0) <= 0) app.cultivation.veteranScrolls = 1;
      const res = applyVeteranScrollToCultivation(app.cultivation, 'all', 1);
      app.cultivation = res.updatedCultivation;
      sound.playUpgradeFanfare();
      rerenderModal();
      updateHUD();
      showToast(res.message);
    });
    return;
  }

  if (drawer === 'vip_subscription') {
    titleEl.textContent = '👑 IMPERIAL VIP MEMBER PASS & DAILY STIPEND SANCTUM';
    const cycle: BillingCycle = app.selectedVipCycle || 'monthly';

    bodyEl.innerHTML = `
      <div class="panel-card" style="border-color:rgba(245,158,11,0.5);">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <div>
            <span class="hud-stat-label">Active Tier: </span>
            <strong data-testid="vip-active-badge" style="color:#fde68a;font-size:1.05rem;">${vipEval.tierConfig.badgeLabel} — ${vipEval.tierConfig.name}</strong>
            <span style="margin-left:10px;font-size:0.78rem;color:#cbd5e1;">
              Stipends Claimed: <strong data-testid="vip-stipends-claimed" style="color:#fbbf24;">${app.vipState.totalStipendsClaimed}</strong> ·
              Treasury: <span data-testid="vip-modal-diamonds" style="color:#38bdf8;font-weight:700;">${formatBigInt(app.resources.diamond)} 💎</span>
            </span>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button id="claim-vip-stipend-btn" data-testid="claim-vip-stipend-btn" class="action-btn" ${!vipEval.canClaimDailyStipend ? 'disabled' : ''}>
              ${vipEval.canClaimDailyStipend ? '🎁 Claim Daily VIP Stipend' : '✅ Stipend Claimed'}
            </button>
            <button id="simulate-next-vip-day-btn" data-testid="simulate-next-vip-day-btn" class="action-btn-secondary">
              🌅 +1 VIP Day
            </button>
            <button id="vip-cycle-monthly-btn" data-testid="vip-cycle-monthly-btn" class="action-btn-secondary" style="${cycle === 'monthly' ? 'border-color:#f59e0b;color:#fde68a;' : ''}">Monthly</button>
            <button id="vip-cycle-annual-btn" data-testid="vip-cycle-annual-btn" class="action-btn-secondary" style="${cycle === 'annual' ? 'border-color:#f59e0b;color:#fde68a;' : ''}">Annual (-20%)</button>
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;">
        ${(Object.keys(VIP_TIER_CONFIGS) as VipTierId[])
          .filter((id) => id !== 'free')
          .map((id) => {
            const cfg = VIP_TIER_CONFIGS[id];
            const diaCost = cycle === 'annual' ? cfg.annualDiamondCost : cfg.monthlyDiamondCost;
            const priceUsd = cycle === 'annual' ? cfg.annualPriceUsd : cfg.monthlyPriceUsd;
            return `
              <div data-testid="vip-tier-card-${id}" class="panel-card" style="justify-content:space-between;">
                <div>
                  <div style="font-weight:800;color:#fde68a;font-size:0.95rem;">${cfg.badgeLabel} · ${cfg.name}</div>
                  <div style="font-size:0.74rem;color:#cbd5e1;margin-top:4px;line-height:1.4;">
                    • Daily Stipend: <strong>+${formatBigInt(cfg.dailyStipend.diamonds)} 💎</strong><br/>
                    • Castle Discount: <strong>-${cfg.perks.castleUpgradeDiscountPct}%</strong><br/>
                    • Cultivation & Gather: <strong>+${cfg.perks.cultivationSpeedBonusPct}%</strong>
                  </div>
                </div>
                <div style="display:flex;flex-direction:column;gap:5px;margin-top:8px;">
                  <button data-testid="activate-vip-store-${id}" class="action-btn vip-store-btn" data-tier="${id}" style="width:100%;">
                    💳 Store Pass (${priceUsd})
                  </button>
                  <button data-testid="activate-vip-diamonds-${id}" class="action-btn-secondary vip-dia-btn" data-tier="${id}" style="width:100%;">
                    💎 ${formatBigInt(diaCost)} Diamonds
                  </button>
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
    `;

    document.getElementById('claim-vip-stipend-btn')?.addEventListener('click', () => {
      app.claimVipStipend();
    });
    document.getElementById('simulate-next-vip-day-btn')?.addEventListener('click', () => {
      app.vipState.simulatedVipDayOffset = (app.vipState.simulatedVipDayOffset || 0) + 1;
      rerenderModal();
      updateHUD();
      showToast('🌅 Advanced VIP calendar by +1 Day! Daily VIP Stipend is ready.');
    });
    document.getElementById('vip-cycle-monthly-btn')?.addEventListener('click', () => {
      app.selectedVipCycle = 'monthly';
      rerenderModal();
    });
    document.getElementById('vip-cycle-annual-btn')?.addEventListener('click', () => {
      app.selectedVipCycle = 'annual';
      rerenderModal();
    });
    bodyEl.querySelectorAll('.vip-store-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tierId = btn.getAttribute('data-tier') as VipTierId;
        app.activateVip(tierId, cycle, 'store_pass');
      });
    });
    bodyEl.querySelectorAll('.vip-dia-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tierId = btn.getAttribute('data-tier') as VipTierId;
        app.activateVip(tierId, cycle, 'diamonds');
      });
    });
    return;
  }

  if (drawer === 'resources') {
    titleEl.textContent = '⛏️ OPEN-WORLD RESOURCE NODES (LV 1–10) & WEATHER HARVESTING';
    bodyEl.innerHTML = `
      <div class="panel-grid">
        ${app.resourceNodes
          .map(
            (node: any) => `
          <div class="panel-card">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <strong style="color:#fde68a;font-size:0.9rem;">${node.name} (Lv.${node.level})</strong>
              <span class="font-mono-num" style="font-size:0.75rem;color:#4ade80;">
                +${formatBigInt(calculateWeatherGatherRate(node.gatherRatePerSec, node.type, app.weather))}/s
              </span>
            </div>
            <div style="font-size:0.76rem;color:#cbd5e1;">
              Type: <strong>${node.type.toUpperCase()}</strong> · Remaining: <span class="font-mono-num">${formatBigInt(node.remainingCapacity)}</span><br/>
              Assigned Troops: <strong class="font-mono-num" style="color:#38bdf8;">${formatBigInt(node.assignedTroops)}</strong>
            </div>
            <div style="display:flex;gap:6px;margin-top:6px;">
              <button class="action-btn dispatch-node-btn" data-nid="${node.id}" style="flex:1;">⛏️ Dispatch +25K</button>
              <button class="action-btn-secondary collect-node-btn" data-nid="${node.id}" style="flex:1;">🌾 Instant Harvest</button>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    bodyEl.querySelectorAll('.dispatch-node-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nid = btn.getAttribute('data-nid')!;
        const node = app.resourceNodes.find((n: any) => n.id === nid);
        if (node) {
          node.assignedTroops += 25_000n;
          sound.playGather();
          rerenderModal();
          showToast(`⛏️ Dispatched 25,000 troops to ${node.name}!`);
        }
      });
    });
    bodyEl.querySelectorAll('.collect-node-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nid = btn.getAttribute('data-nid')!;
        const node = app.resourceNodes.find((n: any) => n.id === nid);
        if (node) {
          const yieldAmt = calculateWeatherGatherRate(node.gatherRatePerSec * 15n, node.type, app.weather);
          app.resources[node.type as ResourceType] += yieldAmt;
          sound.playGather();
          updateHUD();
          rerenderModal();
          showToast(`🌾 Harvested +${formatBigInt(yieldAmt)} ${node.type.toUpperCase()} from ${node.name}!`);
        }
      });
    });
    return;
  }

  if (drawer === 'weather') {
    const cfg = WEATHER_CONFIGS[app.weather as WeatherType];
    titleEl.textContent = `🌦️ DYNAMIC REALM WEATHER RITUAL — ${cfg.name.toUpperCase()}`;
    bodyEl.innerHTML = `
      <div class="panel-card">
        <div style="font-size:1.15rem;font-weight:800;color:#38bdf8;">${cfg.icon} ${cfg.name}</div>
        <div style="font-size:0.82rem;color:#cbd5e1;">${cfg.description} · ${cfg.combatFlavorText}</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:8px;">
          ${(['clear', 'rain', 'snow', 'storm'] as WeatherType[])
            .map((w) => {
              const wc = WEATHER_CONFIGS[w];
              return `
                <button class="action-btn-secondary set-weather-btn" data-weather="${w}" style="padding:10px;${app.weather === w ? 'border-color:#38bdf8;background:rgba(56,189,248,0.22);color:#fff;' : ''}">
                  <div style="font-size:1.2rem;">${wc.icon}</div>
                  <div style="font-weight:700;margin-top:4px;">${wc.name}</div>
                </button>
              `;
            })
            .join('')}
        </div>
      </div>
    `;

    bodyEl.querySelectorAll('.set-weather-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const w = btn.getAttribute('data-weather') as WeatherType;
        app.setWeather(w);
        rerenderModal();
      });
    });
    return;
  }

  if (drawer === 'leaderboard') {
    titleEl.textContent = '🏆 GLOBAL MULTI-TRILLION POWER LEADERBOARD & CLAN RANKINGS';
    const lbAccess = evaluateAdminModeratorAccess(app.currentUserEmail, app.gmSessionActive);
    const totalTroopsOwned = Object.values(app.troops as Record<string, bigint>).reduce(
      (sum, v) => sum + (v || 0n),
      0n
    );
    const syncedRows = computeSynchronizedLeaderboard(app.leaderboard, {
      name: app.playerAppearance.name,
      clanTag: app.playerAppearance.clanTag,
      power: app.getTotalPower(),
      castleLevel: app.castleLevel,
      troopsTotal: totalTroopsOwned,
      monstersSlain: app.monstersSlain,
      isAuthorizedAdmin: lbAccess.isAuthorizedAdmin,
    });

    bodyEl.innerHTML = `
      <div class="panel-grid">
        <div class="panel-card" data-testid="leaderboard-commanders-card">
          <div class="hud-stat-label">Top Sovereign Commanders (Live Power Ranking)</div>
          <div style="display:flex;flex-direction:column;gap:6px;margin-top:4px;">
            ${syncedRows
              .map(
                (entry) => `
              <div data-testid="leaderboard-row-${entry.rank}" style="display:flex;justify-content:space-between;align-items:center;background:rgba(7,11,20,0.82);padding:7px 10px;border-radius:8px;border:1px solid ${entry.isPlayer ? '#f59e0b' : 'rgba(148,163,184,0.18)'};">
                <div>
                  <strong style="color:#fde68a;">#${entry.rank} [${entry.clanTag}] ${entry.lordName}</strong>
                  ${
                    entry.adminBadge
                      ? `<span class="font-mono-num" style="margin-left:6px;font-size:0.65rem;padding:1px 6px;border-radius:999px;background:rgba(245,158,11,0.22);border:1px solid rgba(251,191,36,0.65);color:#fef08a;font-weight:800;">${entry.adminBadge}</span>`
                      : ''
                  }
                  <span style="font-size:0.72rem;color:#94a3b8;margin-left:6px;">Castle Lv.${entry.castleLevel}</span>
                </div>
                <span class="font-mono-num" style="color:#4ade80;font-weight:700;">
                  ${formatBigInt(entry.power)}
                </span>
              </div>
            `
              )
              .join('')}
          </div>
        </div>

        <div class="panel-card" data-testid="leaderboard-clans-card">
          <div class="hud-stat-label">Top Immortal Clan Alliances</div>
          <div style="display:flex;flex-direction:column;gap:6px;margin-top:4px;">
            ${app.clanLeaderboard
              .map(
                (c: any) => `
              <div style="display:flex;justify-content:space-between;align-items:center;background:rgba(7,11,20,0.82);padding:7px 10px;border-radius:8px;border:1px solid ${c.isPlayerClan ? 'rgba(56,189,248,0.45)' : 'transparent'};">
                <div>
                  <strong style="color:#38bdf8;">#${c.rank} [${c.tag}] ${c.name}</strong>
                  <span style="font-size:0.72rem;color:#94a3b8;margin-left:6px;">${c.memberCount ?? c.members ?? 48}/${c.maxMembers ?? 50} · ${c.territoryOutposts ?? c.territories ?? 14} Sectors</span>
                </div>
                <span class="font-mono-num" style="color:#fde68a;font-weight:700;">${formatBigInt(c.isPlayerClan ? app.clan.totalPower : c.totalPower)}</span>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      </div>
    `;
    return;
  }

  if (drawer === 'cpp_core') {
    titleEl.textContent = '💻 C++20 SIMD ENGINE CORE & CROSS-PLATFORM GRAPHICS PIPELINE';
    const plat = app.targetPlatform;
    const qual = app.graphicsQuality;
    const hd = app.hdPackMounted;
    const texOverride = computeMasterTextureImportOverride(plat, qual, hd);
    const lodPolicy = computeLodChainPolicy(plat, qual, hd);
    const lightStrat = computeLightingStrategy(plat, qual);
    const uber = computeUberShaderKeywords(plat, qual, hd);
    const sizeInfo = computeDeploymentBundleManifest(plat, hd);
    const stats = getSimulatedEngineStats(1500, 12);

    bodyEl.innerHTML = `
      <div class="panel-card" data-testid="cross-platform-pipeline-panel">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <div class="hud-stat-label">Cross-Platform Master Asset & Shader Pipeline</div>
          <div style="display:flex;gap:6px;">
            <button data-testid="pipeline-platform-pc-btn" id="pipeline-pc-btn" class="action-btn-secondary" style="${plat === 'pc_console' ? 'border-color:#38bdf8;color:#38bdf8;' : ''}">🖥️ PC / PS5 / Xbox</button>
            <button data-testid="pipeline-platform-mobile-btn" id="pipeline-mobile-btn" class="action-btn-secondary" style="${plat === 'mobile' ? 'border-color:#38bdf8;color:#38bdf8;' : ''}">📱 Mobile (ASTC)</button>
            <button data-testid="pipeline-toggle-hd-pack-btn" id="pipeline-hd-btn" class="action-btn">${hd ? '📦 Unmount 4K HD Pack' : '📦 Mount 4K HD Pack (+3.85 GB)'}</button>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:8px;margin-top:8px;font-size:0.78rem;">
          <div style="background:rgba(7,11,20,0.85);padding:8px;border-radius:8px;">
            <div class="hud-stat-label">Texture Format</div>
            <strong data-testid="pipeline-texture-format" style="color:#fde68a;">${texOverride.compressionFormat} (${texOverride.maxPlatformResolutionPx}px)</strong>
          </div>
          <div style="background:rgba(7,11,20,0.85);padding:8px;border-radius:8px;">
            <div class="hud-stat-label">Mesh LOD Policy</div>
            <strong data-testid="pipeline-lod-bias" style="color:#38bdf8;">LOD Bias +${lodPolicy.lodBias} (${(lodPolicy.activeChain[0]?.targetPolygonBudget ?? 75000).toLocaleString()} tris)</strong>
          </div>
          <div style="background:rgba(7,11,20,0.85);padding:8px;border-radius:8px;">
            <div class="hud-stat-label">Lighting Mode</div>
            <strong data-testid="pipeline-lighting-mode" style="color:#4ade80;">${lightStrat.mode}</strong>
          </div>
          <div style="background:rgba(7,11,20,0.85);padding:8px;border-radius:8px;">
            <div class="hud-stat-label">Uber Shader</div>
            <strong data-testid="pipeline-shader-complexity" style="color:#c084fc;">${uber.activeMacroDefines.length} Keywords Active (${uber.mathComplexity})</strong>
          </div>
          <div style="background:rgba(7,11,20,0.85);padding:8px;border-radius:8px;">
            <div class="hud-stat-label">Install Footprint</div>
            <strong data-testid="pipeline-install-size" style="color:#fbbf24;">${sizeInfo.effectiveTotalInstallMb.toLocaleString()} MB</strong>
          </div>
        </div>
      </div>

      <div class="panel-card">
        <div class="hud-stat-label">C++20 ECS & AVX-512 SIMD Engine Modules (${CPP_ENGINE_SPEC.standard} · ${stats.fps} FPS · ${stats.frameTimeMs}ms)</div>
        <pre style="max-height:165px;overflow-y:auto;background:rgba(4,7,15,0.95);padding:10px;border-radius:8px;font-size:0.72rem;color:#38bdf8;margin:0;">${CPP_CODE_MODULES[0].code}</pre>
      </div>
    `;

    document.getElementById('pipeline-pc-btn')?.addEventListener('click', () => {
      app.targetPlatform = 'pc_console';
      rerenderModal();
      updateHUD();
    });
    document.getElementById('pipeline-mobile-btn')?.addEventListener('click', () => {
      app.targetPlatform = 'mobile';
      rerenderModal();
      updateHUD();
    });
    document.getElementById('pipeline-hd-btn')?.addEventListener('click', () => {
      app.hdPackMounted = !app.hdPackMounted;
      rerenderModal();
      updateHUD();
    });
    return;
  }

  if (drawer === 'character') {
    titleEl.textContent = '🛡️ CHARACTER CREATION & LORD APPEARANCE CENTRE';
    const ap = app.playerAppearance;
    bodyEl.innerHTML = `
      <div class="panel-grid">
        <div class="panel-card">
          <div class="hud-stat-label">Sovereign Identity & Clan Tag</div>
          <label style="font-size:0.76rem;color:#cbd5e1;">Lord Name</label>
          <input id="char-name-input" class="input-field" value="${ap.name}" />
          <label style="font-size:0.76rem;color:#cbd5e1;margin-top:4px;">Clan Tag (3–5 chars)</label>
          <input id="char-tag-input" class="input-field" value="${ap.clanTag}" maxlength="5" />
          <label style="font-size:0.76rem;color:#cbd5e1;margin-top:4px;">Armor Tier (T1–T20)</label>
          <div style="display:flex;gap:6px;">
            ${[1, 3, 5, 8, 12, 20]
              .map(
                (t) => `
              <button class="action-btn-secondary char-tier-btn" data-tier="${t}" style="flex:1;${ap.armorTier === t ? 'border-color:#f59e0b;color:#fde68a;' : ''}">T${t}</button>
            `
              )
              .join('')}
          </div>
        </div>

        <div class="panel-card">
          <div class="hud-stat-label">Weapon & Regal Cape Styling</div>
          <div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap;">
            ${(['broadsword', 'crossbow', 'siege_mortar', 'arcane_halberd'] as const)
              .map(
                (w) => `
              <button class="action-btn-secondary char-weapon-btn" data-weapon="${w}" style="flex:1;font-size:0.72rem;${ap.weaponType === w ? 'border-color:#38bdf8;color:#38bdf8;' : ''}">${w.replace('_', ' ').toUpperCase()}</button>
            `
              )
              .join('')}
          </div>
          <button id="char-save-btn" class="action-btn" style="margin-top:14px;padding:10px;">
            ✨ Save & Rebuild 3D Cultivator Mesh
          </button>
        </div>
      </div>
    `;

    bodyEl.querySelectorAll('.char-tier-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        app.playerAppearance.armorTier = Number(btn.getAttribute('data-tier'));
        app.rebuildPlayerMesh();
        updateHUD();
        rerenderModal();
      });
    });
    bodyEl.querySelectorAll('.char-weapon-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        app.playerAppearance.weaponType = btn.getAttribute('data-weapon') as any;
        app.rebuildPlayerMesh();
        rerenderModal();
      });
    });
    document.getElementById('char-save-btn')?.addEventListener('click', () => {
      const nameVal = (document.getElementById('char-name-input') as HTMLInputElement)?.value.trim();
      const tagVal = (document.getElementById('char-tag-input') as HTMLInputElement)?.value.trim();
      if (nameVal) {
        app.playerAppearance.name = nameVal;
        app.clan.leader = nameVal;
        if (app.clanMembers[0]) app.clanMembers[0].name = nameVal;
      }
      if (tagVal) {
        const cleanTag = tagVal.toUpperCase();
        app.playerAppearance.clanTag = cleanTag;
        app.clan.tag = cleanTag;
      }
      app.rebuildPlayerMesh();
      app.refreshSpatialCards();
      updateHUD();
      rerenderModal();
      showToast(`👤 Saved & synchronized appearance for [${app.playerAppearance.clanTag}] ${app.playerAppearance.name}!`);
    });
    return;
  }

  if (drawer === 'admin_console') {
    titleEl.textContent = `⚡ SOVEREIGN ADMINISTRATION · GM · ADMIN · MODERATOR CONTROL & CONTACT (${SUPER_ADMIN_EMAIL})`;
    const access = evaluateAdminModeratorAccess(app.currentUserEmail, app.gmSessionActive);
    const contactDir = ADMIN_MODERATOR_CONTACT_DIRECTORY;

    bodyEl.innerHTML = `
      <!-- 1. Official Sovereign Admin / GM / Moderator Identity & Contact Card -->
      <div class="panel-card" data-testid="admin-identity-card" style="border-color:rgba(251,191,36,0.55);background:linear-gradient(135deg,rgba(15,23,42,0.96),rgba(30,27,75,0.88));">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
          <div>
            <div class="hud-stat-label" style="color:#fbbf24;">Official Administration · GM · Admin · Moderator Control & Contact</div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:4px;">
              <strong class="font-mono-num" data-testid="admin-primary-email" style="font-size:1.1rem;color:#fef08a;">${contactDir.primaryEmail}</strong>
              ${contactDir.roles
                .map(
                  (role) => `
                <span class="font-mono-num" style="font-size:0.68rem;padding:2px 8px;border-radius:999px;background:rgba(245,158,11,0.2);border:1px solid rgba(251,191,36,0.65);color:#fde68a;font-weight:800;">
                  ${role.toUpperCase()}
                </span>
              `
                )
                .join('')}
            </div>
            <div style="font-size:0.78rem;color:#cbd5e1;margin-top:6px;">
              Active Session Account: <strong class="font-mono-num" style="color:#38bdf8;">${access.accountEmail}</strong> ·
              Clearance: <strong style="color:${access.isAuthorizedAdmin ? '#4ade80' : '#f87171'};">${access.roleBadge}</strong> ·
              SLA: <span style="color:#a7f3d0;">${contactDir.slaResponseWindow}</span>
            </div>
          </div>

          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            <a
              href="${contactDir.mailtoHref}"
              data-testid="admin-mailto-link"
              class="action-btn-secondary"
              style="text-decoration:none;display:inline-flex;align-items:center;gap:6px;border-color:#38bdf8;color:#bae6fd;"
            >
              ✉️ Email ${contactDir.primaryEmail}
            </a>
            <button id="gm-toggle-session-btn" data-testid="gm-toggle-session-btn" class="action-btn" style="font-size:0.76rem;">
              ${access.isAuthorizedAdmin ? `✅ Verified as ${SUPER_ADMIN_EMAIL}` : `🔐 Assume ${SUPER_ADMIN_EMAIL} Admin Session`}
            </button>
          </div>
        </div>

        <!-- Permission Matrix Badges -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:6px;margin-top:10px;font-size:0.73rem;">
          <div style="padding:6px 10px;border-radius:8px;background:rgba(2,6,23,0.75);border:1px solid rgba(74,222,128,0.35);color:#bbf7d0;">
            ⚡ GM Commands: <strong>${access.permissions.canExecuteGmCommands ? 'GRANTED' : 'LOCKED'}</strong>
          </div>
          <div style="padding:6px 10px;border-radius:8px;background:rgba(2,6,23,0.75);border:1px solid rgba(74,222,128,0.35);color:#bbf7d0;">
            🛡️ Player Moderation: <strong>${access.permissions.canModeratePlayers ? 'GRANTED' : 'LOCKED'}</strong>
          </div>
          <div style="padding:6px 10px;border-radius:8px;background:rgba(2,6,23,0.75);border:1px solid rgba(74,222,128,0.35);color:#bbf7d0;">
            📢 Server Decrees: <strong>${access.permissions.canBroadcastServerDecrees ? 'GRANTED' : 'LOCKED'}</strong>
          </div>
          <div style="padding:6px 10px;border-radius:8px;background:rgba(2,6,23,0.75);border:1px solid rgba(74,222,128,0.35);color:#bbf7d0;">
            ☁️ Firestore Admin Rules: <strong>ACTIVE (${SUPER_ADMIN_EMAIL})</strong>
          </div>
        </div>
      </div>

      <!-- 2. Sovereign GM World & Cheat Commands + Server Broadcast Decree -->
      <div class="panel-grid">
        <div class="panel-card">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
            <div class="hud-stat-label">Instant Sovereign GM & Developer World Commands</div>
            <span class="font-mono-num" data-testid="gm-system-version-badge" style="font-size:0.68rem;color:#38bdf8;font-weight:800;">
              System Build v${app.systemUpdateVersion || 1}.0 · Synced
            </span>
          </div>
          <div style="margin-top:6px;">
            <button id="gm-update-everything-btn" data-testid="gm-update-everything-btn" class="action-btn" style="width:100%;padding:10px 14px;font-size:0.86rem;background:linear-gradient(135deg,#f59e0b,#d97706);color:#020617;font-weight:900;">
              🔄 Update & Synchronize Everything (All Systems → v${(app.systemUpdateVersion || 1) + 1}.0)
            </button>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(185px,1fr));gap:8px;margin-top:8px;">
            <button id="gm-godmode-btn" data-testid="gm-godmode-btn" class="action-btn">${app.godmode ? '🔥 GODMODE: ACTIVE' : '🛡️ Toggle GODMODE'}</button>
            <button id="gm-max-castle-btn" data-testid="gm-max-castle-btn" class="action-btn-secondary">🏰 Set Castle Lv.100 (1,000T Cap)</button>
            <button id="gm-give-res-btn" data-testid="gm-give-res-btn" class="action-btn-secondary">💎 Grant +10M All Resources</button>
            <button id="gm-give-t20-btn" data-testid="gm-give-t20-btn" class="action-btn-secondary">⚔️ Enlist +1B T20 Legions</button>
            <button id="gm-max-dao-btn" data-testid="gm-max-dao-btn" class="action-btn-secondary">✨ Ascend to Dao Creator (Realm #23)</button>
            <button id="gm-pardon-self-karma-btn" data-testid="gm-pardon-self-karma-btn" class="action-btn-secondary">🕊️ Pardon Self Karma & Clear Bounty</button>
          </div>
        </div>

        <div class="panel-card">
          <div class="hud-stat-label">Global Server Broadcast Decree (${SUPER_ADMIN_EMAIL})</div>
          <div style="font-size:0.76rem;color:#fde68a;padding:6px 10px;border-radius:8px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.35);margin-bottom:6px;" data-testid="gm-active-decree-banner">
            ${app.activeServerDecree}
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <input
              id="gm-decree-input"
              data-testid="gm-decree-input"
              type="text"
              placeholder="Broadcast a system-wide Admin / GM / Moderator decree..."
              value=""
              style="flex:1;min-width:200px;padding:8px 10px;border-radius:8px;background:#0f172a;border:1px solid #334155;color:#f8fafc;font-size:0.8rem;"
            />
            <button id="gm-broadcast-decree-btn" data-testid="gm-broadcast-decree-btn" class="action-btn">📢 Broadcast Decree</button>
          </div>
        </div>
      </div>

      <!-- 3. Moderator Control Panel: Live Player Roster & Sanctions -->
      <div class="panel-card" data-testid="moderator-roster-card">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <div class="hud-stat-label">🛡️ Moderator Control Panel — Realm Player Roster & Enforcement (${SUPER_ADMIN_EMAIL})</div>
          <span class="font-mono-num" style="font-size:0.72rem;color:#94a3b8;">
            Authorized Moderator: <strong style="color:#fde68a;">${SUPER_ADMIN_EMAIL}</strong>
          </span>
        </div>

        <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">
          ${app.moderatedPlayers
            .map((p: any) => {
              const statusColor =
                p.status === 'suspended'
                  ? '#f87171'
                  : p.status === 'muted'
                    ? '#fbbf24'
                    : '#4ade80';
              return `
                <div data-testid="mod-player-row-${p.id}" style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 12px;border-radius:10px;background:rgba(2,6,23,0.78);border:1px solid #1e293b;">
                  <div style="flex:1;min-width:220px;">
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                      <span class="font-mono-num" style="font-size:0.75rem;color:#fbbf24;font-weight:800;">[${p.clanTag}]</span>
                      <strong style="font-size:0.88rem;color:#f8fafc;">${p.lordName}</strong>
                      <span class="font-mono-num" style="font-size:0.68rem;padding:2px 7px;border-radius:6px;background:rgba(15,23,42,0.9);border:1px solid ${statusColor};color:${statusColor};font-weight:800;">
                        ${p.status.toUpperCase()}
                      </span>
                      <span class="font-mono-num" style="font-size:0.7rem;color:#94a3b8;">
                        Castle Lv.${p.castleLevel} · ${p.realmName} · Karma: <strong style="color:${p.karmaValue < 0 ? '#f87171' : '#4ade80'};">${p.karmaValue}</strong> · Warnings: ${p.warningsCount}
                      </span>
                    </div>
                    <div style="font-size:0.73rem;color:#94a3b8;margin-top:3px;">
                      Last Note: <span style="color:#cbd5e1;">${p.lastModerationNote}</span>
                    </div>
                  </div>

                  <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    <button class="action-btn-secondary mod-action-btn" data-player-id="${p.id}" data-mod-action="warn" style="padding:5px 9px;font-size:0.72rem;">⚠️ Warn</button>
                    <button class="action-btn-secondary mod-action-btn" data-player-id="${p.id}" data-mod-action="${p.status === 'muted' ? 'unmute' : 'mute'}" style="padding:5px 9px;font-size:0.72rem;">
                      ${p.status === 'muted' ? '🔊 Unmute' : '🔇 Mute'}
                    </button>
                    <button class="action-btn-secondary mod-action-btn" data-player-id="${p.id}" data-mod-action="pardon_karma" style="padding:5px 9px;font-size:0.72rem;">🕊️ Pardon Karma</button>
                    <button class="action-btn-secondary mod-action-btn" data-player-id="${p.id}" data-mod-action="grant_stipend" style="padding:5px 9px;font-size:0.72rem;">🎁 GM Stipend</button>
                    <button class="action-btn-secondary mod-action-btn" data-player-id="${p.id}" data-mod-action="${p.status === 'suspended' ? 'unban' : 'ban'}" style="padding:5px 9px;font-size:0.72rem;border-color:rgba(248,113,113,0.5);color:#fca5a5;">
                      ${p.status === 'suspended' ? '✅ Reinstate' : '🔨 Suspend'}
                    </button>
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>

        <!-- Moderation Audit Trail -->
        <div style="margin-top:10px;padding-top:8px;border-top:1px solid #1e293b;">
          <div class="hud-stat-label">Recent GM / Moderator Enforcement Audit Log</div>
          <div data-testid="mod-audit-log" style="max-height:95px;overflow-y:auto;display:flex;flex-direction:column;gap:4px;margin-top:4px;font-size:0.73rem;color:#cbd5e1;">
            ${app.moderationAuditLog
              .slice(0, 6)
              .map(
                (entry: any) => `
              <div class="font-mono-num" style="padding:4px 8px;border-radius:6px;background:rgba(15,23,42,0.75);">
                <span style="color:#fde68a;">[${entry.actorEmail}]</span> →
                <strong>${entry.targetLordName}</strong> (${entry.action.toUpperCase()}):
                <span style="color:#94a3b8;">${entry.reason}</span>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      </div>

      <!-- 4. Direct Contact & Support Dispatch Desk (creatergame31@gmail.com) -->
      <div class="panel-grid">
        <div class="panel-card" data-testid="admin-contact-desk-card">
          <div class="hud-stat-label">📨 Contact Administration / GM / Moderator Desk (${SUPER_ADMIN_EMAIL})</div>
          <div style="font-size:0.76rem;color:#cbd5e1;margin-bottom:6px;">
            Submit a direct GM / Moderator ticket, ban appeal, or bug report routed to <strong class="font-mono-num" style="color:#fde68a;">${SUPER_ADMIN_EMAIL}</strong>.
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div>
              <label style="font-size:0.7rem;color:#94a3b8;display:block;margin-bottom:3px;">Category</label>
              <select id="contact-gm-category" data-testid="contact-gm-category" style="width:100%;padding:7px 9px;border-radius:8px;background:#0f172a;border:1px solid #334155;color:#f8fafc;font-size:0.78rem;">
                <option value="gm_assistance">⚡ GM In-Game Assistance</option>
                <option value="moderation_appeal">🛡️ Moderation / Sanction Appeal</option>
                <option value="bug_report">🐞 Technical Bug / Exploit Report</option>
                <option value="security_alert">🔐 Account & Security Escalation</option>
              </select>
            </div>
            <div>
              <label style="font-size:0.7rem;color:#94a3b8;display:block;margin-bottom:3px;">Your Reply Email (Optional)</label>
              <input
                id="contact-gm-sender-email"
                data-testid="contact-gm-sender-email"
                type="email"
                value="${app.currentUserEmail || SUPER_ADMIN_EMAIL}"
                placeholder="your-email@example.com"
                style="width:100%;padding:7px 9px;border-radius:8px;background:#0f172a;border:1px solid #334155;color:#f8fafc;font-size:0.78rem;"
              />
            </div>
          </div>

          <div style="margin-top:6px;">
            <label style="font-size:0.7rem;color:#94a3b8;display:block;margin-bottom:3px;">Subject</label>
            <input
              id="contact-gm-subject"
              data-testid="contact-gm-subject"
              type="text"
              placeholder="Brief summary for creatergame31@gmail.com..."
              style="width:100%;padding:7px 9px;border-radius:8px;background:#0f172a;border:1px solid #334155;color:#f8fafc;font-size:0.78rem;"
            />
          </div>

          <div style="margin-top:6px;">
            <label style="font-size:0.7rem;color:#94a3b8;display:block;margin-bottom:3px;">Message to ${SUPER_ADMIN_EMAIL}</label>
            <textarea
              id="contact-gm-message"
              data-testid="contact-gm-message"
              rows="2"
              placeholder="Describe your request, player report, or GM assistance inquiry..."
              style="width:100%;padding:7px 9px;border-radius:8px;background:#0f172a;border:1px solid #334155;color:#f8fafc;font-size:0.78rem;resize:vertical;"
            ></textarea>
          </div>

          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
            <button id="btn-submit-gm-ticket" data-testid="btn-submit-gm-ticket" class="action-btn">
              📨 Send Dispatch to ${SUPER_ADMIN_EMAIL}
            </button>
            <button id="btn-gmail-gm-dispatch" data-testid="btn-gmail-gm-dispatch" class="action-btn-secondary">
              ☁️ Send via 1P Gmail API
            </button>
          </div>
        </div>

        <div class="panel-card" data-testid="admin-ticket-queue-card">
          <div class="hud-stat-label">📬 Sovereign Admin & Moderator Support Queue (${SUPER_ADMIN_EMAIL})</div>
          <div data-testid="gm-ticket-queue-list" style="display:flex;flex-direction:column;gap:8px;max-height:220px;overflow-y:auto;margin-top:6px;">
            ${app.supportTickets
              .map(
                (t: any) => `
              <div data-testid="support-ticket-item-${t.id}" style="padding:9px 11px;border-radius:9px;background:rgba(2,6,23,0.82);border:1px solid ${t.status === 'resolved' ? 'rgba(74,222,128,0.4)' : 'rgba(251,191,36,0.45)'};">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;">
                  <strong style="font-size:0.8rem;color:#fde68a;">${t.subject}</strong>
                  <span class="font-mono-num" style="font-size:0.66rem;padding:2px 6px;border-radius:5px;background:rgba(15,23,42,0.9);color:${t.status === 'resolved' ? '#4ade80' : '#fbbf24'};font-weight:800;">
                    ${t.status.toUpperCase()}
                  </span>
                </div>
                <div style="font-size:0.73rem;color:#cbd5e1;margin-top:3px;">${t.message}</div>
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px;font-size:0.68rem;color:#94a3b8;">
                  <span>To: <strong class="font-mono-num" style="color:#38bdf8;">${t.recipientEmail}</strong> · From: ${t.senderName} (${t.senderEmail})</span>
                  <div style="display:flex;gap:6px;align-items:center;">
                    <a href="${t.mailtoUrl}" style="color:#38bdf8;text-decoration:none;font-weight:700;">✉️ Mailto</a>
                    ${
                      t.status === 'open'
                        ? `<button class="action-btn-secondary btn-resolve-ticket" data-ticket-id="${t.id}" style="padding:3px 8px;font-size:0.68rem;">✅ Resolve as ${SUPER_ADMIN_EMAIL}</button>`
                        : `<span style="color:#4ade80;">${t.adminResolutionNote || 'Resolved'}</span>`
                    }
                  </div>
                </div>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      </div>
    `;

    document.getElementById('gm-toggle-session-btn')?.addEventListener('click', () => {
      app.gmSessionActive = !app.gmSessionActive;
      app.currentUserEmail = app.gmSessionActive ? SUPER_ADMIN_EMAIL : 'player@voxelrealms.local';
      updateHUD();
      rerenderModal();
      showToast(
        app.gmSessionActive
          ? `🔐 Sovereign Admin / GM / Moderator Session active for ${SUPER_ADMIN_EMAIL}!`
          : 'Switched to standard cultivator preview mode.'
      );
    });

    document.getElementById('gm-update-everything-btn')?.addEventListener('click', () => {
      app.updateAllRealmSystems();
    });

    document.getElementById('gm-godmode-btn')?.addEventListener('click', () => {
      app.godmode = !app.godmode;
      updateHUD();
      rerenderModal();
      showToast(`⚡ Sovereign GODMODE ${app.godmode ? 'ENABLED' : 'DISABLED'} by ${SUPER_ADMIN_EMAIL}!`);
    });
    document.getElementById('gm-max-castle-btn')?.addEventListener('click', () => {
      app.castleLevel = 100;
      app.rebuildCastleMesh();
      app.refreshSpatialCards();
      updateHUD();
      rerenderModal();
      showToast('🏰 Citadel elevated to Level 100 (1,000 Trillion Capacity)!');
    });
    document.getElementById('gm-give-res-btn')?.addEventListener('click', () => {
      app.resources.wood += 10_000_000n;
      app.resources.steel += 10_000_000n;
      app.resources.copper += 10_000_000n;
      app.resources.grain += 10_000_000n;
      app.resources.oil += 10_000_000n;
      app.resources.diamond += 10_000_000n;
      updateHUD();
      showToast('💎 Granted +10,000,000 of all 6 Imperial Resources!');
    });
    document.getElementById('gm-give-t20-btn')?.addEventListener('click', () => {
      app.troops['shieldbearer_t20'] = (app.troops['shieldbearer_t20'] || 0n) + 1_000_000_000n;
      app.troops['shooter_t20'] = (app.troops['shooter_t20'] || 0n) + 1_000_000_000n;
      app.troops['bomber_t20'] = (app.troops['bomber_t20'] || 0n) + 1_000_000_000n;
      app.refreshSpatialCards();
      updateHUD();
      showToast('⚔️ Mobilized +3 Billion Tier-20 Celestial Legions!');
    });
    document.getElementById('gm-max-dao-btn')?.addEventListener('click', () => {
      (['qi', 'body', 'soul', 'mind'] as CultivationPath[]).forEach((p) => {
        app.cultivation.paths[p].realmIndex = CULTIVATION_REALMS.length - 1;
        app.cultivation.paths[p].layer = 9;
      });
      app.cultivation.currentRealmIndex = CULTIVATION_REALMS.length - 1;
      app.cultivation.secludedYears += 100;
      const baseHistory =
        app.cultivation.growthHistory && app.cultivation.growthHistory.length > 0
          ? app.cultivation.growthHistory
          : buildDefaultCultivationHistory(app.cultivation.paths, app.cultivation.secludedYears);
      app.cultivation.growthHistory = appendCultivationHistorySnapshot(baseHistory, {
        paths: app.cultivation.paths,
        secludedYears: app.cultivation.secludedYears,
        eventLabel: 'Ascended to Dao Creator (Realm #23)',
      });
      app.rebuildPlayerMesh();
      app.refreshSpatialCards();
      updateHUD();
      rerenderModal();
      showToast('✨ Ascended to Realm #23: Dao Creator (大道创造者) & updated D3 progression chronicle!');
    });
    document.getElementById('gm-pardon-self-karma-btn')?.addEventListener('click', () => {
      app.cultivation.karma.karmaValue = 500;
      app.cultivation.karma.bountyDiamonds = 0n;
      app.cultivation.karma.stationarySeconds = 0;
      app.refreshSpatialCards();
      updateHUD();
      rerenderModal();
      showToast(`🕊️ Karma pardoned & Heavenly Tribulation cleared by ${SUPER_ADMIN_EMAIL}!`);
    });

    document.getElementById('gm-broadcast-decree-btn')?.addEventListener('click', () => {
      const inputEl = document.getElementById('gm-decree-input') as HTMLInputElement | null;
      const text = inputEl?.value.trim();
      if (!text) {
        showToast('⚠️ Enter a decree message to broadcast.');
        return;
      }
      app.activeServerDecree = `📢 [${SUPER_ADMIN_EMAIL} · GM DECREE]: ${text}`;
      updateHUD();
      rerenderModal();
      showToast(app.activeServerDecree);
    });

    document.querySelectorAll('.mod-action-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const playerId = btn.getAttribute('data-player-id');
        const action = btn.getAttribute('data-mod-action') as ModerationActionType | null;
        if (!playerId || !action) return;
        const res = applyPlayerModerationAction(
          app.moderatedPlayers,
          playerId,
          action,
          SUPER_ADMIN_EMAIL,
          `Executed via Sovereign Moderator Console (${SUPER_ADMIN_EMAIL})`
        );
        app.moderatedPlayers = res.updatedRoster;
        if (res.auditEntry) {
          app.moderationAuditLog = [res.auditEntry, ...app.moderationAuditLog];
          showToast(`🛡️ [${SUPER_ADMIN_EMAIL}] ${res.auditEntry.targetLordName}: ${action.toUpperCase()} applied!`);
        }
        rerenderModal();
      });
    });

    document.getElementById('btn-submit-gm-ticket')?.addEventListener('click', async () => {
      const category = ((document.getElementById('contact-gm-category') as HTMLSelectElement)?.value ||
        'gm_assistance') as SupportTicketCategory;
      const senderEmail =
        (document.getElementById('contact-gm-sender-email') as HTMLInputElement)?.value.trim() ||
        app.currentUserEmail ||
        SUPER_ADMIN_EMAIL;
      const subject =
        (document.getElementById('contact-gm-subject') as HTMLInputElement)?.value.trim() ||
        'Sovereign GM / Moderator Assistance Request';
      const message =
        (document.getElementById('contact-gm-message') as HTMLTextAreaElement)?.value.trim() ||
        `Requesting administration / moderator review from ${SUPER_ADMIN_EMAIL}.`;

      const { ticket } = createContactSupportTicket({
        senderName: app.playerAppearance.name,
        senderEmail,
        category,
        subject,
        message,
      });

      app.supportTickets = [ticket, ...app.supportTickets];
      try {
        await saveSupportTicketToFirestore({
          ticketId: ticket.id,
          senderName: ticket.senderName,
          senderEmail: ticket.senderEmail,
          category: ticket.category,
          subject: ticket.subject,
          message: ticket.message,
        });
      } catch {
        // Local queue already updated when offline/unauthenticated
      }
      rerenderModal();
      showToast(`📨 Contact Dispatch [${ticket.subject}] routed to ${SUPER_ADMIN_EMAIL}!`);
    });

    document.getElementById('btn-gmail-gm-dispatch')?.addEventListener('click', () => {
      const category = ((document.getElementById('contact-gm-category') as HTMLSelectElement)?.value ||
        'gm_assistance') as SupportTicketCategory;
      const senderEmail =
        (document.getElementById('contact-gm-sender-email') as HTMLInputElement)?.value.trim() ||
        app.currentUserEmail ||
        SUPER_ADMIN_EMAIL;
      const subject =
        (document.getElementById('contact-gm-subject') as HTMLInputElement)?.value.trim() ||
        'Sovereign GM / Moderator Dispatch';
      const message =
        (document.getElementById('contact-gm-message') as HTMLTextAreaElement)?.value.trim() ||
        `Direct 1P Gmail dispatch to ${SUPER_ADMIN_EMAIL}.`;

      const { ticket, gmailPayload } = createContactSupportTicket({
        senderName: app.playerAppearance.name,
        senderEmail,
        category,
        subject,
        message,
      });

      askConfirm(
        `Send 1P Gmail Dispatch to ${SUPER_ADMIN_EMAIL}?`,
        `This will send an email via the Gmail API to ${SUPER_ADMIN_EMAIL} with subject "${gmailPayload.subject}".`,
        async () => {
          app.supportTickets = [ticket, ...app.supportTickets];
          try {
            await sendGmailDispatch(gmailPayload.to, gmailPayload.subject, gmailPayload.bodyText);
            showToast(`✉️ Sent 1P Gmail dispatch to ${SUPER_ADMIN_EMAIL}!`);
          } catch (err: any) {
            showToast(`📨 Logged ticket to ${SUPER_ADMIN_EMAIL} queue (Sign in with Google for live Gmail API send).`);
          }
          rerenderModal();
        }
      );
    });

    document.querySelectorAll('.btn-resolve-ticket').forEach((btn) => {
      btn.addEventListener('click', () => {
        const ticketId = btn.getAttribute('data-ticket-id');
        if (!ticketId) return;
        app.supportTickets = resolveSupportTicket(
          app.supportTickets,
          ticketId,
          `Resolved & verified by Sovereign Admin (${SUPER_ADMIN_EMAIL})`
        );
        rerenderModal();
        showToast(`✅ Ticket ${ticketId} marked RESOLVED by ${SUPER_ADMIN_EMAIL}!`);
      });
    });

    return;
  }

  if (drawer === 'bioscience') {
    titleEl.textContent = '🧬 BIOSCIENCE PROTEIN STRUCTURE WORKBENCH (ALPHAFOLD DB / RCSB PDB / UNIPROT)';
    const p = app.activeProtein;
    const plddtColor = getAlphaFoldPlddtColor(p.meanPlddt);

    bodyEl.innerHTML = `
      <div class="panel-card">
        <div class="hud-stat-label">Quick-Try Biomolecular Targets (Real UniProt & PDB Accessions)</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;">
          ${Object.values(BIOSCIENCE_TARGETS)
            .map(
              (t) => `
            <button class="action-btn-secondary bio-chip-btn" data-sym="${t.symbol}">
              ${t.symbol} (${t.uniprotId} / ${t.pdbId})
            </button>
          `
            )
            .join('')}
        </div>
      </div>

      <div class="panel-grid">
        <div class="panel-card">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span class="hud-stat-label">Active 3D Structure Telemetry</span>
            <span style="font-size:0.72rem;background:rgba(14,165,233,0.2);color:#38bdf8;border:1px solid #0284c7;padding:2px 8px;border-radius:99px;">
              ${p.provenance}
            </span>
          </div>
          <div style="font-size:1.05rem;font-weight:700;color:#fde68a;">${p.symbol} — ${p.proteinName}</div>
          <div style="font-size:0.78rem;color:#cbd5e1;line-height:1.45;">
            UniProtKB: <a href="${p.uniprotUrl}" target="_blank" style="color:#38bdf8;">${p.uniprotId}</a> | RCSB PDB: <a href="${p.rcsbUrl}" target="_blank" style="color:#38bdf8;">${p.pdbId}</a> | <a href="${p.alphafoldUrl}" target="_blank" style="color:#38bdf8;">AlphaFold Entry</a><br/>
            Length: <strong class="font-mono-num">${p.sequenceLength} aa</strong> | Mean pLDDT: <strong class="font-mono-num" style="color:${plddtColor.hex};">${p.meanPlddt} (${plddtColor.bandLabel})</strong><br/>
            ChEMBL Ligand: <strong>${p.chemblLigandName}</strong> (IC50: ${p.chemblIc50Nm} nM)<br/>
            Elixir Buff: <span style="color:#4ade80;">${p.elixirBuffSummary}</span>
          </div>
        </div>

        <div class="panel-card">
          <div class="hud-stat-label">Canonical 4-Band AlphaFold pLDDT Confidence Scale</div>
          <div style="display:flex;flex-direction:column;gap:6px;margin-top:4px;font-size:0.76rem;">
            <div><span style="display:inline-block;width:12px;height:12px;background:#0053D6;margin-right:6px;"></span><strong>Very High (&gt;90)</strong>: High accuracy side-chains & binding site</div>
            <div><span style="display:inline-block;width:12px;height:12px;background:#65CBF3;margin-right:6px;"></span><strong>Confident (70–90)</strong>: Reliable backbone fold</div>
            <div><span style="display:inline-block;width:12px;height:12px;background:#FFDB13;margin-right:6px;"></span><strong>Low (50–70)</strong>: Flexible linker / caution advised</div>
            <div><span style="display:inline-block;width:12px;height:12px;background:#FF7D45;margin-right:6px;"></span><strong>Very Low (&lt;50)</strong>: Disordered region (IDR), do not interpret as fixed</div>
          </div>
        </div>
      </div>
    `;

    bodyEl.querySelectorAll('.bio-chip-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        app.loadProtein(btn.getAttribute('data-sym') || 'TP53');
      });
    });
    return;
  }

  if (drawer === 'gemini') {
    titleEl.textContent = '✨ GEMINI AI COMMAND CENTER (THINKING, GROUNDING, IMAGE, VIDEO, LYRIA & LIVE VOICE)';
    bodyEl.innerHTML = `
      <div class="panel-grid">
        <div class="panel-card">
          <div class="hud-stat-label">Immortal Strategist Chat & Grounding</div>
          <select id="gemini-mode-select" class="select-field">
            <option value="argon_thinking">gemini-4-argon (ThinkingLevel.HIGH)</option>
            <option value="flash_standard">gemini-3.8-flash (Standard)</option>
            <option value="flash_lite_fast">gemini-3.1-flash-lite (Fast)</option>
          </select>
          <div id="gemini-chat-log" style="height:125px;overflow-y:auto;background:rgba(7,11,20,0.85);padding:8px;border-radius:6px;font-size:0.78rem;display:flex;flex-direction:column;gap:6px;">
            ${app.chatHistory
              .map(
                (m: any) =>
                  `<div><strong style="color:${m.role === 'model' ? '#fde68a' : '#38bdf8'};">${m.role === 'model' ? 'Oracle' : 'You'}:</strong> ${m.text}</div>`
              )
              .join('')}
          </div>
          <div style="display:flex;gap:6px;">
            <input id="gemini-chat-input" class="input-field" placeholder="Ask strategy, search web, or find places..." />
            <button id="btn-gemini-chat" class="action-btn">Ask</button>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button id="btn-gemini-search" class="action-btn-secondary">Google Search Grounding</button>
            <button id="btn-gemini-maps" class="action-btn-secondary">Google Maps Grounding</button>
            <button id="btn-gemini-tts" class="action-btn-secondary">Speak Reply (TTS)</button>
          </div>
        </div>

        <div class="panel-card">
          <div class="hud-stat-label">Forge Art (Nano Banana 2.1 / Pro Image), Video (Omni 1.1 Flash) & Lyria Music</div>
          <input id="gemini-media-prompt" class="input-field" value="Golden Immortal Voxel Citadel floating in astral clouds" />
          <div style="display:flex;gap:6px;">
            <select id="gemini-img-model" class="select-field">
              <option value="gemini-nano-banana-2.1">gemini-nano-banana-2.1</option>
              <option value="gemini-3-pro-image">gemini-3-pro-image</option>
            </select>
            <select id="gemini-img-aspect" class="select-field">
              <option value="1:1">1:1</option>
              <option value="16:9">16:9</option>
              <option value="9:16">9:16</option>
              <option value="4:3">4:3</option>
              <option value="3:4">3:4</option>
            </select>
            <select id="gemini-img-size" class="select-field">
              <option value="1K">1K</option>
              <option value="2K">2K</option>
              <option value="4K">4K</option>
            </select>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button id="btn-gen-image" class="action-btn">Generate Image</button>
            <button id="btn-gen-video" class="action-btn-secondary">Generate Video (16:9)</button>
            <button id="btn-gen-music" class="action-btn-secondary">Compose Lyria OST</button>
          </div>
          <div id="gemini-media-output" style="min-height:85px;background:rgba(7,11,20,0.85);border-radius:6px;padding:8px;font-size:0.75rem;color:#94a3b8;display:flex;flex-direction:column;align-items:center;justify-content:center;">
            Generated realm art, Omni video, or Lyria soundtrack will appear here.
          </div>
        </div>
      </div>

      <div class="panel-card">
        <div class="hud-stat-label">Multimodal Analysis (gemini-4-argon), Audio Transcription (gemini-3.5-transcribe) & Live Voice (gemini-3.8-live)</div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <input id="gemini-file-upload" type="file" accept="image/*,video/*,audio/*" style="font-size:0.75rem;" />
          <button id="btn-analyze-upload" class="action-btn-secondary">Analyze Media</button>
          <button id="btn-transcribe-upload" class="action-btn-secondary">Transcribe Audio</button>
          <button id="btn-toggle-live" class="action-btn">${app.liveWs ? 'Disconnect Live Voice' : 'Connect Live Voice (gemini-3.8-live)'}</button>
        </div>
        <div id="gemini-live-status" style="font-size:0.76rem;color:#38bdf8;margin-top:4px;">Ready for multimodal inspection or Live API voice streaming.</div>
      </div>
    `;

    const chatInput = document.getElementById('gemini-chat-input') as HTMLInputElement | null;
    const modeSelect = document.getElementById('gemini-mode-select') as HTMLSelectElement | null;

    document.getElementById('btn-gemini-chat')?.addEventListener('click', async () => {
      const msg = chatInput?.value.trim();
      if (!msg) return;
      chatInput!.value = '';
      const mode = (modeSelect?.value || 'argon_thinking') as any;
      const prevHistory = [...app.chatHistory];
      app.chatHistory.push({ role: 'user', text: msg });
      rerenderModal();
      try {
        const res = await sendGeminiChatMessage({ history: prevHistory, message: msg, mode });
        app.chatHistory.push({ role: 'model', text: res.text });
        rerenderModal();
      } catch (e: any) {
        app.chatHistory.push({ role: 'model', text: `Error: ${e.message}` });
        rerenderModal();
      }
    });

    document.getElementById('btn-gemini-search')?.addEventListener('click', async () => {
      const q = chatInput?.value.trim() || 'Latest AlphaFold 3 and WebXR spatial computing news';
      try {
        const res = await queryGeminiSearchGrounding(q);
        const links = res.sources
          .map((s: { title: string; uri: string }) => `<a href="${s.uri}" target="_blank">${s.title}</a>`)
          .join(' | ');
        app.chatHistory.push({
          role: 'model',
          text: `${res.text}${links ? `<br/>Sources: ${links}` : ''}`,
        });
        rerenderModal();
      } catch (e: any) {
        showToast(`Search error: ${e.message}`);
      }
    });

    document.getElementById('btn-gemini-maps')?.addEventListener('click', async () => {
      const q = chatInput?.value.trim() || 'Historic castles and gardens near San Francisco';
      try {
        const res = await queryGeminiMapsGrounding(q);
        const links = res.places
          .map((p: { title: string; uri: string }) => `<a href="${p.uri}" target="_blank">${p.title}</a>`)
          .join(' | ');
        app.chatHistory.push({
          role: 'model',
          text: `${res.text}${links ? `<br/>Maps Places: ${links}` : ''}`,
        });
        rerenderModal();
      } catch (e: any) {
        showToast(`Maps error: ${e.message}`);
      }
    });

    document.getElementById('btn-gemini-tts')?.addEventListener('click', async () => {
      const lastMsg =
        [...app.chatHistory].reverse().find((m: any) => m.role === 'model')?.text ||
        'Welcome to Voxel Realms.';
      try {
        const res = await synthesizeGeminiSpeech({ text: lastMsg.slice(0, 240), voiceName: 'Kore' });
        const audio = new Audio(res.audioDataUrl);
        void audio.play();
      } catch (e: any) {
        showToast(`TTS error: ${e.message}`);
      }
    });

    document.getElementById('btn-gen-image')?.addEventListener('click', async () => {
      const prompt = (document.getElementById('gemini-media-prompt') as HTMLInputElement)?.value || 'Citadel';
      const model = (document.getElementById('gemini-img-model') as HTMLSelectElement)?.value as any;
      const aspectRatio = (document.getElementById('gemini-img-aspect') as HTMLSelectElement)?.value as any;
      const imageSize = (document.getElementById('gemini-img-size') as HTMLSelectElement)?.value as any;
      const outEl = document.getElementById('gemini-media-output');
      if (outEl) outEl.textContent = `Generating image with ${model}...`;
      try {
        const res = await generateOrEditGeminiImage({ prompt, model, aspectRatio, imageSize });
        if (outEl) {
          outEl.innerHTML = `<img src="${res.imageUrl}" alt="Generated Realm Art" referrerpolicy="no-referrer" style="max-height:150px;border-radius:8px;" />`;
        }
      } catch (e: any) {
        if (outEl) outEl.textContent = `Image error: ${e.message}`;
      }
    });

    document.getElementById('btn-gen-video')?.addEventListener('click', async () => {
      const prompt = (document.getElementById('gemini-media-prompt') as HTMLInputElement)?.value || 'Citadel';
      const outEl = document.getElementById('gemini-media-output');
      if (outEl) outEl.textContent = 'Generating video with gemini-omni-1.1-flash...';
      try {
        const res = await generateOmniFlashVideo({ prompt, aspectRatio: '16:9' });
        if (outEl) {
          outEl.innerHTML = `<video src="${res.videoDataUrl}" controls autoplay loop style="max-height:150px;border-radius:8px;"></video>`;
        }
      } catch (e: any) {
        if (outEl) outEl.textContent = `Video error: ${e.message}`;
      }
    });

    document.getElementById('btn-gen-music')?.addEventListener('click', async () => {
      const prompt = (document.getElementById('gemini-media-prompt') as HTMLInputElement)?.value || 'Epic orchestral citadel theme';
      const outEl = document.getElementById('gemini-media-output');
      if (outEl) outEl.textContent = 'Composing soundtrack with lyria-3-clip-preview...';
      try {
        const res = await generateLyriaMusic({ prompt, model: 'lyria-3-clip-preview' });
        if (outEl) {
          outEl.innerHTML = `<audio src="${res.audioDataUrl}" controls autoplay style="width:100%;"></audio>`;
        }
      } catch (e: any) {
        if (outEl) outEl.textContent = `Lyria error: ${e.message}`;
      }
    });

    document.getElementById('btn-analyze-upload')?.addEventListener('click', () => {
      const file = (document.getElementById('gemini-file-upload') as HTMLInputElement)?.files?.[0];
      const statusEl = document.getElementById('gemini-live-status');
      if (!file) {
        showToast('Choose an image or video file first.');
        return;
      }
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const res = await analyzeMediaWithArgon({
            prompt: 'Analyze this media for Voxel Realms tactical insights.',
            base64Data: String(reader.result),
            mimeType: file.type || 'image/png',
          });
          if (statusEl) statusEl.textContent = res.text;
        } catch (e: any) {
          if (statusEl) statusEl.textContent = `Analysis error: ${e.message}`;
        }
      };
      reader.readAsDataURL(file);
    });

    document.getElementById('btn-transcribe-upload')?.addEventListener('click', () => {
      const file = (document.getElementById('gemini-file-upload') as HTMLInputElement)?.files?.[0];
      const statusEl = document.getElementById('gemini-live-status');
      if (!file) {
        showToast('Choose an audio file first.');
        return;
      }
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const res = await transcribeAudioWithGemini({
            base64Audio: String(reader.result),
            mimeType: file.type || 'audio/webm',
          });
          if (statusEl) statusEl.textContent = `Transcript: ${res.transcript}`;
        } catch (e: any) {
          if (statusEl) statusEl.textContent = `Transcribe error: ${e.message}`;
        }
      };
      reader.readAsDataURL(file);
    });

    document.getElementById('btn-toggle-live')?.addEventListener('click', () => {
      const statusEl = document.getElementById('gemini-live-status');
      if (app.liveWs) {
        app.liveWs.close();
        app.liveWs = null;
        rerenderModal();
        return;
      }
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/live`);
      app.liveWs = ws;
      ws.onopen = () => {
        if (statusEl) statusEl.textContent = 'Connected to gemini-3.8-live! Sending greeting...';
        ws.send(JSON.stringify({ type: 'text', text: 'Greet the Sovereign Commander briefly.' }));
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'transcript' && statusEl) {
            statusEl.textContent = `${msg.speaker}: ${msg.text}`;
          } else if (msg.type === 'error' && statusEl) {
            statusEl.textContent = `Live error: ${msg.message}`;
          }
        } catch {
          // ignore
        }
      };
      ws.onclose = () => {
        app.liveWs = null;
      };
      rerenderModal();
    });
    return;
  }

  if (drawer === 'workspace') {
    titleEl.textContent = '☁️ FIREBASE CLOUD SAVE, GM / MODERATOR CONTACT & 1P WORKSPACE SUITE';
    const wsAccess = evaluateAdminModeratorAccess(app.currentUserEmail, app.gmSessionActive);
    bodyEl.innerHTML = `
      <div class="panel-card" style="border-color:rgba(251,191,36,0.5);">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
          <div>
            <div class="hud-stat-label" style="color:#fbbf24;">Sovereign Administration · GM · Admin · Moderator Control & Contact</div>
            <div style="font-size:0.84rem;color:#e2e8f0;margin-top:2px;">
              Lead Admin / GM / Moderator Contact: <strong class="font-mono-num" style="color:#fde68a;">${SUPER_ADMIN_EMAIL}</strong> ·
              Firestore <code style="color:#38bdf8;">isAdmin()</code> Clearance: <strong style="color:#4ade80;">${wsAccess.roleBadge}</strong>
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button id="btn-ws-open-gm-console" class="action-btn">⚡ Open GM / Moderator Console</button>
            <button id="btn-ws-admin-inspect-saves" class="action-btn-secondary">🔍 Inspect All Cloud Saves (Admin)</button>
            <a href="${ADMIN_MODERATOR_CONTACT_DIRECTORY.mailtoHref}" class="action-btn-secondary" style="text-decoration:none;">✉️ Contact ${SUPER_ADMIN_EMAIL}</a>
          </div>
        </div>
      </div>

      <div class="panel-grid">
        <div class="panel-card">
          <div class="hud-stat-label">Firebase Auth & Cloud Save (/realm_saves)</div>
          <div style="font-size:0.84rem;color:#cbd5e1;">
            Signed In Account: <strong style="color:#fde68a;">${app.currentUserName || `${SUPER_ADMIN_EMAIL} (Sovereign Admin Preview)`}</strong>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;">
            <button id="btn-google-signin" class="action-btn">Sign In & Authorize Google Workspace</button>
            <button id="btn-cloud-save" class="action-btn-secondary">Save Realm to Firestore</button>
            <button id="btn-cloud-load" class="action-btn-secondary">Load Cloud Save</button>
            ${app.currentUserName ? `<button id="btn-google-signout" class="action-btn-secondary">Sign Out</button>` : ''}
          </div>
        </div>

        <div class="panel-card">
          <div class="hud-stat-label">Read-Only Workspace Inspection (Drive, Gmail, Contacts, Keep)</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button id="btn-ws-drive-list" class="action-btn-secondary">List Drive Files</button>
            <button id="btn-ws-gmail-list" class="action-btn-secondary">List Gmail</button>
            <button id="btn-ws-contacts-list" class="action-btn-secondary">List Contacts</button>
            <button id="btn-ws-keep-list" class="action-btn-secondary">List Keep Notes</button>
          </div>
          <div id="ws-output-log" style="min-height:68px;max-height:120px;overflow-y:auto;background:rgba(7,11,20,0.85);padding:8px;border-radius:6px;font-size:0.75rem;color:#cbd5e1;margin-top:4px;">
            Workspace output and confirmation logs will appear here.
          </div>
        </div>
      </div>

      <div class="panel-card">
        <div class="hud-stat-label">1P Google Workspace Mutating Actions (Protected by Confirmation Dialog)</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;margin-top:4px;">
          <button id="btn-ws-sheets" class="action-btn-secondary">Export Ledger to Google Sheets</button>
          <button id="btn-ws-docs" class="action-btn-secondary">Create Lore Chronicle in Docs</button>
          <button id="btn-ws-slides" class="action-btn-secondary">Create War Deck in Slides</button>
          <button id="btn-ws-calendar" class="action-btn-secondary">Schedule Siege in Calendar</button>
          <button id="btn-ws-tasks" class="action-btn-secondary">Create Upgrade Task in Tasks</button>
          <button id="btn-ws-forms" class="action-btn-secondary">Create Recruitment Form</button>
          <button id="btn-ws-meet" class="action-btn-secondary">Create War Room in Google Meet</button>
        </div>
      </div>
    `;

    const logEl = document.getElementById('ws-output-log');
    const setLog = (html: string) => {
      if (logEl) logEl.innerHTML = html;
    };

    document.getElementById('btn-ws-open-gm-console')?.addEventListener('click', () => {
      app.activeDrawer = 'admin_console';
      rerenderModal();
    });

    document.getElementById('btn-ws-admin-inspect-saves')?.addEventListener('click', async () => {
      try {
        const saves = await listAllRealmSavesForAdmin();
        if (!saves.length) {
          setLog(`Verified Admin (${SUPER_ADMIN_EMAIL}): 0 remote cloud saves found or sign in with Google to query Firestore /realm_saves.`);
          return;
        }
        setLog(
          saves
            .map(
              (s) =>
                `• [${s.clanTag}] <strong>${s.lordName}</strong> — Castle Lv.${s.castleLevel} (${s.powerRatingStr} Might)`
            )
            .join('<br/>')
        );
      } catch (e: any) {
        setLog(`Admin Firestore inspection notice (${SUPER_ADMIN_EMAIL}): ${e.message}`);
      }
    });

    document.getElementById('btn-google-signin')?.addEventListener('click', async () => {
      try {
        const res = await googleSignIn();
        if (res) {
          app.currentUserName = res.user.displayName || res.user.email || 'Sovereign Lord';
          app.currentUserEmail = res.user.email || SUPER_ADMIN_EMAIL;
          showToast(`Signed in as ${app.currentUserName} (${app.currentUserEmail})!`);
          rerenderModal();
        }
      } catch (e: any) {
        setLog(`Sign-in error: ${e.message}`);
      }
    });

    document.getElementById('btn-google-signout')?.addEventListener('click', async () => {
      await logout();
      app.currentUserName = null;
      rerenderModal();
    });

    document.getElementById('btn-cloud-save')?.addEventListener('click', async () => {
      try {
        await saveRealmStateToFirestore({
          lordName: app.currentUserName || app.playerAppearance.name,
          clanTag: app.playerAppearance.clanTag,
          castleLevel: app.castleLevel,
          cultivationRealmIndex: app.getHighestRealmIndex(),
          cultivationLayer: app.cultivation.paths.qi.layer,
          karmaValue: app.cultivation.karma.karmaValue,
          powerRatingStr: formatBigInt(app.getTotalPower()),
          stateJson: JSON.stringify({
            castleLevel: app.castleLevel,
            weather: app.weather,
          }),
        });
        await appendBattleChronicleToFirestore(
          `Citadel Lv.${app.castleLevel} Saved`,
          `Saved with ${formatBigInt(app.getTotalPower())} power.`
        );
        setLog('Saved Realm state & Chronicle to Cloud Firestore!');
        showToast('Realm state saved to Firestore!');
      } catch (e: any) {
        setLog(`Firestore save error: ${e.message}`);
      }
    });

    document.getElementById('btn-cloud-load')?.addEventListener('click', async () => {
      try {
        const data = await loadRealmStateFromFirestore();
        if (!data) {
          setLog('No cloud save found for this user.');
          return;
        }
        app.castleLevel = data.castleLevel;
        app.cultivation.paths.qi.realmIndex = data.cultivationRealmIndex;
        app.cultivation.paths.qi.layer = data.cultivationLayer;
        app.cultivation.karma.karmaValue = data.karmaValue;
        app.rebuildCastleMesh();
        app.rebuildPlayerMesh();
        updateHUD();
        setLog('Restored Realm state from Cloud Firestore!');
      } catch (e: any) {
        setLog(`Firestore load error: ${e.message}`);
      }
    });

    document.getElementById('btn-ws-drive-list')?.addEventListener('click', async () => {
      try {
        const files = await listGoogleDriveFiles();
        setLog(files.length ? files.map((f) => `• ${f.name} (${f.mimeType})`).join('<br/>') : 'No files found.');
      } catch (e: any) {
        setLog(`Drive error: ${e.message}`);
      }
    });

    document.getElementById('btn-ws-gmail-list')?.addEventListener('click', async () => {
      try {
        const msgs = await listGmailDispatches();
        setLog(msgs.length ? msgs.map((m) => `• ${m.snippet}`).join('<br/>') : 'No messages found.');
      } catch (e: any) {
        setLog(`Gmail error: ${e.message}`);
      }
    });

    document.getElementById('btn-ws-contacts-list')?.addEventListener('click', async () => {
      try {
        const allies = await listGoogleContactsAllies();
        setLog(allies.length ? allies.map((a) => `• ${a.name} (${a.email})`).join('<br/>') : 'No contacts found.');
      } catch (e: any) {
        setLog(`Contacts error: ${e.message}`);
      }
    });

    document.getElementById('btn-ws-keep-list')?.addEventListener('click', async () => {
      try {
        const notes = await listGoogleKeepNotes();
        setLog(notes.length ? notes.map((n) => `• ${n.title || n.name}`).join('<br/>') : 'No Keep notes found.');
      } catch (e: any) {
        setLog(`Keep notice: ${e.message}`);
      }
    });

    document.getElementById('btn-ws-sheets')?.addEventListener('click', () => {
      askConfirm(
        'Export Ledger to Google Sheets?',
        'This will create a new spreadsheet in your Google Drive with your Citadel & Legion telemetry.',
        async () => {
          try {
            const res = await createGoogleSheetLedger(`Voxel Realms Ledger Lv.${app.castleLevel}`, [
              ['Metric', 'Value'],
              ['Citadel Level', app.castleLevel],
              ['Total Power', formatBigInt(app.getTotalPower())],
            ]);
            setLog(`Created Sheet: <a href="${res.spreadsheetUrl}" target="_blank">${res.spreadsheetUrl}</a>`);
          } catch (e: any) {
            setLog(`Sheets error: ${e.message}`);
          }
        }
      );
    });

    document.getElementById('btn-ws-docs')?.addEventListener('click', () => {
      askConfirm(
        'Create Google Doc Chronicle?',
        'This will create a new Google Document recording your Citadel Era and Cultivation Realm.',
        async () => {
          try {
            const res = await createGoogleDocChronicle(
              `Voxel Realms Chronicle Lv.${app.castleLevel}`,
              `Citadel Level: ${app.castleLevel}\nPower: ${formatBigInt(app.getTotalPower())}`
            );
            setLog(`Created Google Doc: ${res.title} (${res.documentId})`);
          } catch (e: any) {
            setLog(`Docs error: ${e.message}`);
          }
        }
      );
    });

    document.getElementById('btn-ws-slides')?.addEventListener('click', () => {
      askConfirm(
        'Create Google Slides War Deck?',
        'This will create a new presentation in Google Slides.',
        async () => {
          try {
            const res = await createGoogleSlidesDeck(`Voxel Realms War Deck Lv.${app.castleLevel}`);
            setLog(`Created Presentation ID: ${res.presentationId}`);
          } catch (e: any) {
            setLog(`Slides error: ${e.message}`);
          }
        }
      );
    });

    document.getElementById('btn-ws-calendar')?.addEventListener('click', () => {
      askConfirm(
        'Schedule Siege Rally in Google Calendar?',
        'This will create a 1-hour Citadel Siege Rally event on your primary Calendar.',
        async () => {
          try {
            const res = await scheduleCalendarSiegeRally(
              `Voxel Realms Siege Rally (Lv.${app.castleLevel})`,
              'Scheduled alliance siege defense.'
            );
            setLog(`Scheduled Event: <a href="${res.htmlLink}" target="_blank">${res.htmlLink}</a>`);
          } catch (e: any) {
            setLog(`Calendar error: ${e.message}`);
          }
        }
      );
    });

    document.getElementById('btn-ws-tasks')?.addEventListener('click', () => {
      askConfirm(
        'Create Upgrade Quest in Google Tasks?',
        'This will add a new task to your default Google Tasks list.',
        async () => {
          try {
            const res = await createGoogleTaskQuest(
              `Upgrade Citadel to Lv.${app.castleLevel + 1}`,
              'Gather Spirit Timber and Steel.'
            );
            setLog(`Created Task: ${res.title}`);
          } catch (e: any) {
            setLog(`Tasks error: ${e.message}`);
          }
        }
      );
    });

    document.getElementById('btn-ws-forms')?.addEventListener('click', () => {
      askConfirm(
        'Create Recruitment Form in Google Forms?',
        'This will create a new Alliance Recruitment form in Google Forms.',
        async () => {
          try {
            const res = await createGoogleFormRecruitment('Voxel Realms Alliance Recruitment');
            setLog(`Created Form ID: ${res.formId}`);
          } catch (e: any) {
            setLog(`Forms error: ${e.message}`);
          }
        }
      );
    });

    document.getElementById('btn-ws-meet')?.addEventListener('click', () => {
      askConfirm(
        'Create War Room in Google Meet?',
        'This will create a new Google Meet space for your Alliance Command.',
        async () => {
          try {
            const res = await createGoogleMeetWarRoom();
            setLog(`Created Meet Space: <a href="${res.meetingUri}" target="_blank">${res.meetingUri}</a>`);
          } catch (e: any) {
            setLog(`Meet error: ${e.message}`);
          }
        }
      );
    });
    return;
  }

  if (drawer === 'readme') {
    titleEl.textContent = `📖 README.MD — VOXEL REALMS XR ARCHITECTURE & ADMIN DOCUMENTATION`;
    bodyEl.innerHTML = `
      <div class="panel-card" data-testid="readme-modal-card" style="background:linear-gradient(135deg,rgba(15,23,42,0.96),rgba(30,27,75,0.88));border:1px solid rgba(56,189,248,0.45);margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <div>
            <div class="font-cinzel" style="font-size:1.05rem;font-weight:900;color:#fde68a;">
              Voxel Realms XR: Open World MMORPG & Castle Warfare
            </div>
            <div style="font-size:0.78rem;color:#cbd5e1;margin-top:2px;">
              Three.js · XR Blocks (<code>xrblocks@0.24.0</code>) · D3.js · Cloud Firestore · Express + Vite
            </div>
          </div>
          <span class="font-mono-num" style="padding:4px 10px;border-radius:999px;background:rgba(16,185,129,0.2);border:1px solid #34d399;color:#6ee7b7;font-size:0.72rem;font-weight:800;">
            System Build v${app.systemUpdateVersion || 1}.0 · File: /README.md
          </span>
        </div>
      </div>

      <div class="panel-grid" style="margin-bottom:12px;">
        <div class="panel-card" style="border-color:rgba(251,191,36,0.45);">
          <strong style="color:#fef08a;font-size:0.88rem;">⚡ Sovereign Administration, GM, Admin & Moderator Control</strong>
          <div style="font-size:0.76rem;color:#cbd5e1;line-height:1.5;margin-top:6px;">
            • <strong>Super Administrator / Grand GM / Lead Moderator</strong>: <code style="color:#6ee7b7;">${SUPER_ADMIN_EMAIL}</code><br/>
            • <strong>Official Contact & Support</strong>: <a href="mailto:${SUPER_ADMIN_EMAIL}" style="color:#38bdf8;font-weight:800;">${SUPER_ADMIN_EMAIL}</a><br/>
            • <strong>Global System Update (<code>Update All</code>)</strong>: Synchronizes Citadel Keep (+5 Lv), +5.0M Resources, +750K T20 Immortal Legions, 4-Path Cultivation, D3.js Growth Chronicle, Heroes, and Clan Tech.<br/>
            • <strong>Firestore Security (<code>firestore.rules</code>)</strong>: Hardware-enforced <code>isAdmin()</code> rule granting verified <code>${SUPER_ADMIN_EMAIL}</code> full governance across <code>/saves/{uid}</code> and <code>/support_tickets/{ticketId}</code>.
          </div>
        </div>

        <div class="panel-card" style="border-color:rgba(56,189,248,0.45);">
          <strong style="color:#38bdf8;font-size:0.88rem;">📈 Four-Path Cultivation & D3.js Growth Chronicle</strong>
          <div style="font-size:0.76rem;color:#cbd5e1;line-height:1.5;margin-top:6px;">
            • <strong>23 Immortal Realms × 9 Layers</strong>: Spans Mortal Foundation, Immortal Ascension, Primordial Chaos, and Ultimate Origin (Dao Creator).<br/>
            • <strong>Four Simultaneous Paths</strong>: 🌬️ Qi Essence, 🩸 Sacred Body, 👁️ Divine Soul, and 🧠 Dao Heart (Mind).<br/>
            • <strong>D3.js Multi-Line & Area Chart (<code>src/modals/cultivationChart.ts</code>)</strong>: Renders Stage Score (<code>RealmIndex × 9 + Layer</code>) across secluded meditation years with Era threshold bands and interactive tooltips.
          </div>
        </div>
      </div>

      <div class="panel-grid" style="margin-bottom:12px;">
        <div class="panel-card">
          <strong style="color:#f43f5e;font-size:0.88rem;">🏰 Citadel Keep (Lv. 1–100) & T1–T20 Combined-Arms Warfare</strong>
          <div style="font-size:0.76rem;color:#cbd5e1;line-height:1.5;margin-top:6px;">
            • <strong>6 Architectural Voxel Eras</strong>: Frontier Timber Fort → Omniversal Sovereign Citadel.<br/>
            • <strong>Combat Counter Triangle</strong>: 🛡️ Shieldbearers beat 🏹 Shooters · 🏹 Shooters beat 💣 Bombers · 💣 Bombers beat 🛡️ Shieldbearers.<br/>
            • <strong>Clan Territory & Live Rankings</strong>: Outpost sieges, 4-branch Alliance Tech Tree, and live power-sorted Global Leaderboard.
          </div>
        </div>

        <div class="panel-card">
          <strong style="color:#a78bfa;font-size:0.88rem;">🧬 Bioscience 3D PDB, Weather Rituals & World AI</strong>
          <div style="font-size:0.76rem;color:#cbd5e1;line-height:1.5;margin-top:6px;">
            • <strong>AlphaFold / RCSB PDB 3D Viewer</strong>: Inspect <code>TP53</code>, <code>BRCA1</code>, <code>EGFR</code>, and <code>CRISPR-Cas9</code> molecular structures.<br/>
            • <strong>Autonomous World AI Director (Lv. 1–1000)</strong>: Simulates faction diplomacy, monster migrations, and Radiant Quests.<br/>
            • <strong>Cloud & Workspace</strong>: Firebase Cloud Save + Google Docs/Sheets/Slides/Calendar/Tasks/Forms/Meet integration.
          </div>
        </div>
      </div>

      <div class="panel-card" style="background:#020617;border-color:#334155;">
        <strong style="color:#6ee7b7;font-size:0.84rem;">🚀 Quick Commands & Project Structure (<code>/README.md</code>)</strong>
        <pre class="font-mono-num" style="margin-top:6px;padding:10px;border-radius:10px;background:#0f172a;color:#e2e8f0;font-size:0.72rem;overflow-x:auto;line-height:1.45;">npm install
npm run dev                                  # Full-stack Express + Vite server on port 3000
npx tsx --test src/game/*.test.ts            # Run unit test suite (Cultivation, D3 History, Admin RBAC)
npm run build                                # Compile production bundle</pre>
      </div>
    `;
    return;
  }
}
