import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as xb from 'xrblocks';
import {
  BioscienceTargetProfile,
  CultivationPath,
  CultivationPathProgress,
  Disciple,
  GameResources,
  MonsterTarget,
  NPCEntity,
  PlayerKarmaState,
  TroopType,
  WeatherType,
} from './types';
import {
  CULTIVATION_REALMS,
  calculateCastleTroopCapacity,
  calculateFourPathSynergy,
  calculateMasterDiscipleEconomy,
  calculateMultiplicativePowerRating,
  calculateQiRequired,
  calculateRallyCapacity,
  calculateRealmSuppression,
  calculateWeatherGatherRate,
  computeAStarAvoidKeepPath,
  createScaledMonsterByLevel,
  evaluatePvPKillKarma,
  formatBigInt,
  getCastleEra,
  getCastleUpgradeCost,
  getCultivationAuraVisualSpec,
  getTroopTierInfo,
  tickRedNameStationaryLightning,
} from './game/rules';
import {
  BIOSCIENCE_TARGETS,
  getAlphaFoldPlddtColor,
  getBioscienceTarget,
} from './game/bioscience';
import {
  WorldResourceNode,
  createMonsterMesh,
  createNPCMesh,
  createPlayerMesh,
  createProteinStructureMesh,
  createResourceNodeMesh,
  createVoxelCastle,
  createVoxelTerrain,
} from './game/world3d';
import { sound } from './game/audio';
import {
  appendBattleChronicleToFirestore,
  createGoogleDocChronicle,
  createGoogleFormRecruitment,
  createGoogleMeetWarRoom,
  createGoogleSheetLedger,
  createGoogleSlidesDeck,
  createGoogleTaskQuest,
  googleSignIn,
  initAuth,
  listGoogleContactsAllies,
  listGoogleDriveFiles,
  listGoogleKeepNotes,
  listGmailDispatches,
  loadRealmStateFromFirestore,
  logout,
  saveRealmStateToFirestore,
  scheduleCalendarSiegeRally,
} from './services/firebaseAndWorkspace';
import {
  ChatTurnMessage,
  analyzeMediaWithArgon,
  generateLyriaMusic,
  generateOmniFlashVideo,
  generateOrEditGeminiImage,
  queryGeminiMapsGrounding,
  queryGeminiSearchGrounding,
  sendGeminiChatMessage,
  synthesizeGeminiSpeech,
  transcribeAudioWithGemini,
} from './services/geminiClient';

type GameLifecycleState = 'title' | 'playing' | 'paused' | 'victory' | 'gameover';

class VoxelRealmsXRApp extends xb.Script {
  public gameState: GameLifecycleState = 'title';
  public castleLevel = 1;
  public resources: GameResources = {
    wood: 25_000n,
    steel: 20_000n,
    copper: 18_000n,
    diamond: 2_500n,
    grain: 30_000n,
    oil: 15_000n,
  };
  public troops: Record<string, bigint> = {
    shieldbearer_t1: 500n,
    shooter_t1: 500n,
    bomber_t1: 250n,
    shieldbearer_t5: 100n,
  };
  public cultivation: Record<CultivationPath, CultivationPathProgress> = {
    qi: { realmIndex: 0, layer: 1, currentEnergy: 1000n },
    body: { realmIndex: 0, layer: 1, currentEnergy: 1000n },
    soul: { realmIndex: 0, layer: 1, currentEnergy: 1000n },
    mind: { realmIndex: 0, layer: 1, currentEnergy: 1000n },
  };
  public karma: PlayerKarmaState = {
    karmaValue: 120,
    alignment: 'green_innocent',
    unlawfulKills: 0,
    righteousKills: 2,
    stationarySeconds: 0,
    maxStationaryThresholdSec: 6,
    bountySpiritStones: 0n,
    isLocationRevealed: false,
    lastLightningStrikeMsg: null,
    droppedLootHistory: [],
  };
  public disciples: Disciple[] = [
    {
      id: 'd1',
      name: 'Lin Feng',
      chineseName: '林风',
      realmIndex: 0,
      layer: 6,
      loyalty: 96,
      distanceMeters: 18,
      baseSpiritStonesPerSec: 450n,
      baseQiPerSec: 600n,
      equippedSkills: ['Heaven Earth Sleeve (袖里乾坤)'],
    },
    {
      id: 'd2',
      name: 'Su Yao',
      chineseName: '苏瑶',
      realmIndex: 1,
      layer: 3,
      loyalty: 99,
      distanceMeters: 32,
      baseSpiritStonesPerSec: 820n,
      baseQiPerSec: 1100n,
      equippedSkills: ['Heaven Earth Sleeve (袖里乾坤)', 'Nine Heavens Sword Array'],
    },
  ];
  public masterTaxRatePct = 20;

  public monsters: MonsterTarget[] = [
    createScaledMonsterByLevel(5, -18, 14),
    createScaledMonsterByLevel(25, 19, 15),
    createScaledMonsterByLevel(85, -22, -18),
    createScaledMonsterByLevel(260, 24, -19),
    createScaledMonsterByLevel(920, 0, -28),
  ];

  public npcs: NPCEntity[] = [
    { id: 'n1', name: 'Grand Elder Xuan', role: 'elder', level: 80, x: -5, z: 9, statusText: 'Meditating on the Great Dao', stashWood: 500n, stashSteel: 500n, stashDiamond: 100n },
    { id: 'n2', name: 'Captain Valerius', role: 'guard', level: 55, x: 4, z: 11, statusText: 'Guarding the South Gatehouse', stashWood: 200n, stashSteel: 800n, stashDiamond: 20n },
    { id: 'n3', name: 'Master Forger Ignis', role: 'blacksmith', level: 62, x: -8, z: 4, statusText: 'Tempering Mythril Vanguard Plate', stashWood: 300n, stashSteel: 1200n, stashDiamond: 50n },
    { id: 'n4', name: 'Silk Merchant Lyra', role: 'merchant', level: 40, x: 8, z: 5, statusText: 'Trading Spirit Stones & Elixirs', stashWood: 900n, stashSteel: 400n, stashDiamond: 250n },
    { id: 'n5', name: 'Grand Marshal Kael', role: 'marshal', level: 90, x: -3, z: 12, statusText: 'Mustering T20 Celestial Aegis Rally', stashWood: 400n, stashSteel: 900n, stashDiamond: 150n },
    { id: 'n6', name: 'Starlight Mystic', role: 'mystic', level: 75, x: 6, z: 9, statusText: 'Divining AlphaFold Protein Folds', stashWood: 300n, stashSteel: 300n, stashDiamond: 400n },
  ];

  public resourceNodes: WorldResourceNode[] = [
    { id: 'r1', type: 'wood', x: -13, z: 16, amount: 500_000n },
    { id: 'r2', type: 'steel', x: 14, z: 15, amount: 500_000n },
    { id: 'r3', type: 'diamond', x: -12, z: -12, amount: 250_000n },
    { id: 'r4', type: 'grain', x: 12, z: -12, amount: 500_000n },
  ];

  public weather: WeatherType = 'clear';
  public activeDrawer: string | null = null;

  public playerPos = new THREE.Vector3(0, 0, 14);
  public playerHp = 2500;
  public playerMaxHp = 2500;
  public monstersSlain = 0;
  public hitstopTimer = 0;
  public cameraTrauma = 0;
  public keysPressed = new Set<string>();
  public tribulationAccumSec = 0;

  public activeProtein: BioscienceTargetProfile = getBioscienceTarget('TP53');

  private worldGroup = new THREE.Group();
  private castleGroup: THREE.Group | null = null;
  private playerGroup: THREE.Group | null = null;
  private proteinGroup: THREE.Group | null = null;
  private lightningBoltMesh: THREE.Mesh | null = null;
  private monsterMeshes = new Map<string, THREE.Group>();
  private npcMeshes = new Map<string, THREE.Group>();

  private castleSpatialText: xb.UIText | null = null;
  private daoSpatialText: xb.UIText | null = null;
  private bioSpatialText: xb.UIText | null = null;

  public currentUserName: string | null = null;
  public chatHistory: ChatTurnMessage[] = [
    {
      role: 'model',
      text: 'Greetings, Sovereign Lord! Ask me about T1-T20 Castle Warfare counters, the 23 Immortal Realms (100x suppression at Golden Core vs Qi Refinement), or AlphaFold Protein structures.',
    },
  ];
  public liveWs: WebSocket | null = null;

  init() {
    this.setupLightingAndEnvironment();
    this.add(this.worldGroup);

    this.worldGroup.add(createVoxelTerrain());
    this.rebuildCastleMesh();
    this.rebuildPlayerMesh();

    for (const m of this.monsters) {
      const mesh = createMonsterMesh(m);
      this.monsterMeshes.set(m.id, mesh);
      this.worldGroup.add(mesh);
    }
    for (const n of this.npcs) {
      const mesh = createNPCMesh(n);
      this.npcMeshes.set(n.id, mesh);
      this.worldGroup.add(mesh);
    }
    for (const r of this.resourceNodes) {
      this.worldGroup.add(createResourceNodeMesh(r));
    }

    const boltGeo = new THREE.CylinderGeometry(0.18, 0.45, 28, 8);
    const boltMat = new THREE.MeshBasicMaterial({
      color: 0xc084fc,
      transparent: true,
      opacity: 0,
    });
    this.lightningBoltMesh = new THREE.Mesh(boltGeo, boltMat);
    this.lightningBoltMesh.position.set(0, 14, 14);
    this.worldGroup.add(this.lightningBoltMesh);

    this.buildSpatialUICards();
    this.loadProtein('TP53');

    const cam = (xb.core as any)?.camera as THREE.PerspectiveCamera | undefined;
    if (cam) {
      cam.position.set(0, 11.5, 27);
      cam.lookAt(0, 2.5, 4);
    }
  }

  private setupLightingAndEnvironment() {
    const renderer = (xb.core as any)?.renderer as THREE.WebGLRenderer | undefined;
    const scene = (xb.core as any)?.scene as THREE.Scene | undefined;

    if (renderer) {
      const gl = renderer.getContext();
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      const rendererStr = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '' : '';
      const isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software/i.test(String(rendererStr));

      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = !isSoftwareGl;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      try {
        const pmrem = new THREE.PMREMGenerator(renderer);
        const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        if (scene) {
          scene.environment = envTex;
          scene.background = new THREE.Color(0x132342);
          scene.fog = new THREE.FogExp2(0x132342, 0.008);
        }
        pmrem.dispose();
      } catch {
        // Fallback if PMREM fails
      }
    }

    const hemiLight = new THREE.HemisphereLight(0xf0f9ff, 0x334155, 2.8);
    this.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 3.2);
    sunLight.position.set(18, 32, 22);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    this.add(sunLight);
  }

  public rebuildCastleMesh() {
    if (this.castleGroup) {
      this.worldGroup.remove(this.castleGroup);
    }
    this.castleGroup = createVoxelCastle(this.castleLevel);
    this.worldGroup.add(this.castleGroup);
    this.refreshSpatialCards();
  }

  public rebuildPlayerMesh() {
    if (this.playerGroup) {
      this.worldGroup.remove(this.playerGroup);
    }
    const highestRealm = this.getHighestRealmIndex();
    this.playerGroup = createPlayerMesh(highestRealm, this.karma.alignment === 'red_fiend');
    this.playerGroup.position.copy(this.playerPos);
    this.worldGroup.add(this.playerGroup);
    this.refreshSpatialCards();
  }

  public loadProtein(symbolOrAccession: string) {
    this.activeProtein = getBioscienceTarget(symbolOrAccession);
    if (this.proteinGroup) {
      this.worldGroup.remove(this.proteinGroup);
    }
    this.proteinGroup = createProteinStructureMesh(this.activeProtein.residues);
    this.proteinGroup.position.set(8.5, 3.2, 8.5);
    this.worldGroup.add(this.proteinGroup);
    this.refreshSpatialCards();
    if (this.activeDrawer === 'bioscience') {
      renderActiveDrawer();
    }
  }

  public getTotalPower(): bigint {
    return calculateMultiplicativePowerRating({
      troops: this.troops,
      castleLevel: this.castleLevel,
      highestHeroRarityMultiplier: 4,
      researchLevel: 12,
    });
  }

  public getHighestRealmIndex(): number {
    return Math.max(
      this.cultivation.qi.realmIndex,
      this.cultivation.body.realmIndex,
      this.cultivation.soul.realmIndex,
      this.cultivation.mind.realmIndex
    );
  }

  private buildSpatialUICards() {
    this.castleSpatialText = new xb.UIText({
      text: 'Citadel Lv 1 | Era I: Timber Encampment',
      style: { fontSize: 18, lineHeight: 1.35, textAlign: 'center' },
    });
    const castleCard = new xb.UICard({
      size: { width: 0.62, height: 'auto' },
      manipulation: true,
      edge: true,
      style: { flexDirection: 'column', gap: 12, padding: 18 },
      children: [
        new xb.UIText({
          text: 'CITADEL & BARRACKS',
          style: { fontSize: 24, fontWeight: 'bold', textAlign: 'center' },
        }),
        this.castleSpatialText,
        new xb.UIPanel({
          style: { width: '100%', flexDirection: 'row', gap: 10 },
          children: [
            new xb.UIButton({
              label: 'Upgrade Keep',
              icon: 'upgrade',
              style: { flexGrow: 1 },
              onClick: () => this.upgradeCastle(),
            }),
            new xb.UIButton({
              label: 'Train +1K T5',
              icon: 'groups',
              style: { flexGrow: 1 },
              onClick: () => this.trainTroops(5, 'shieldbearer', 1000n),
            }),
          ],
        }),
      ],
    });
    castleCard.position.set(-7.5, 4.2, 8.5);
    castleCard.add(new xb.FaceCamera({ mode: 'spherical', smoothing: 0.15 }));
    this.add(castleCard);

    this.daoSpatialText = new xb.UIText({
      text: 'Qi: Qi Refinement L1 | 100x Realm Suppression Active',
      style: { fontSize: 18, lineHeight: 1.35, textAlign: 'center' },
    });
    const daoCard = new xb.UICard({
      size: { width: 0.64, height: 'auto' },
      manipulation: true,
      edge: true,
      style: { flexDirection: 'column', gap: 12, padding: 18 },
      children: [
        new xb.UIText({
          text: 'IMMORTAL CULTIVATION',
          style: { fontSize: 24, fontWeight: 'bold', textAlign: 'center' },
        }),
        this.daoSpatialText,
        new xb.UIPanel({
          style: { width: '100%', flexDirection: 'row', gap: 10 },
          children: [
            new xb.UIButton({
              label: 'Cultivate Qi',
              icon: 'bolt',
              style: { flexGrow: 1 },
              onClick: () => this.cultivatePath('qi'),
            }),
            new xb.UIButton({
              label: 'Breakthrough',
              icon: 'star',
              style: { flexGrow: 1 },
              onClick: () => this.breakthroughPath('qi'),
            }),
          ],
        }),
      ],
    });
    daoCard.position.set(0, 5.2, 10.5);
    daoCard.add(new xb.FaceCamera({ mode: 'spherical', smoothing: 0.15 }));
    this.add(daoCard);

    this.bioSpatialText = new xb.UIText({
      text: 'Loading AlphaFold pLDDT Structure...',
      style: { fontSize: 17, lineHeight: 1.35, textAlign: 'center' },
    });
    const bioCard = new xb.UICard({
      size: { width: 0.62, height: 'auto' },
      manipulation: true,
      edge: true,
      style: { flexDirection: 'column', gap: 12, padding: 18 },
      children: [
        new xb.UIText({
          text: 'ALPHAFOLD BIOSCIENCE',
          style: { fontSize: 24, fontWeight: 'bold', textAlign: 'center' },
        }),
        this.bioSpatialText,
        new xb.UIPanel({
          style: { width: '100%', flexDirection: 'row', gap: 8 },
          children: [
            new xb.UIButton({
              label: 'TP53',
              style: { flexGrow: 1 },
              onClick: () => this.loadProtein('TP53'),
            }),
            new xb.UIButton({
              label: 'BRCA1',
              style: { flexGrow: 1 },
              onClick: () => this.loadProtein('BRCA1'),
            }),
            new xb.UIButton({
              label: 'HBB',
              style: { flexGrow: 1 },
              onClick: () => this.loadProtein('HBB'),
            }),
          ],
        }),
      ],
    });
    bioCard.position.set(8.5, 5.4, 8.5);
    bioCard.add(new xb.FaceCamera({ mode: 'spherical', smoothing: 0.15 }));
    this.add(bioCard);

    this.refreshSpatialCards();
  }

  public refreshSpatialCards() {
    if (this.castleSpatialText) {
      const era = getCastleEra(this.castleLevel);
      const cap = calculateCastleTroopCapacity(this.castleLevel);
      this.castleSpatialText.text = `Keep Lv ${this.castleLevel} (${era.name})\nCap: ${formatBigInt(cap)} | Power: ${formatBigInt(this.getTotalPower())}`;
    }
    if (this.daoSpatialText) {
      const qi = this.cultivation.qi;
      const realmName = CULTIVATION_REALMS[qi.realmIndex]?.name || 'Qi Refinement';
      this.daoSpatialText.text = `Qi Path: ${realmName} (Layer ${qi.layer}/9)\nKarma: ${this.karma.karmaValue} (${this.karma.alignment})`;
    }
    if (this.bioSpatialText && this.activeProtein) {
      const p = this.activeProtein;
      this.bioSpatialText.text = `${p.symbol} (${p.uniprotId} / ${p.pdbId})\nMean pLDDT: ${p.meanPlddt} ${p.provenance}`;
    }
  }

  public upgradeCastle() {
    if (this.castleLevel >= 100) {
      showToast('Citadel has reached Maximum Immortal Sovereign Level 100!');
      return;
    }
    const cost = getCastleUpgradeCost(this.castleLevel);
    if (this.resources.wood < cost.wood || this.resources.steel < cost.steel) {
      // Grant a subsidized upgrade in demo or deduct available
      this.resources.wood = this.resources.wood > cost.wood ? this.resources.wood - cost.wood : 5000n;
      this.resources.steel = this.resources.steel > cost.steel ? this.resources.steel - cost.steel : 5000n;
    } else {
      this.resources.wood -= cost.wood;
      this.resources.steel -= cost.steel;
    }

    this.castleLevel = Math.min(100, this.castleLevel + 1);
    const era = getCastleEra(this.castleLevel);

    sound.playUpgradeFanfare();
    this.rebuildCastleMesh();
    updateHUD();
    if (this.activeDrawer === 'castle') renderActiveDrawer();
    showToast(`Citadel upgraded to Lv ${this.castleLevel} (${era.name})!`);
  }

  public trainTroops(tier: number, type: TroopType, count: bigint) {
    const key = `${type}_t${tier}`;
    this.troops[key] = (this.troops[key] || 0n) + count;
    const info = getTroopTierInfo(type, tier);

    sound.playGather();
    this.refreshSpatialCards();
    updateHUD();
    if (this.activeDrawer === 'castle') renderActiveDrawer();
    showToast(`Trained +${formatBigInt(count)} ${info.name}!`);
  }

  public cultivatePath(path: CultivationPath) {
    const st = this.cultivation[path];
    const req = calculateQiRequired(st.realmIndex, st.layer);
    st.currentEnergy += req / 2n;
    sound.playGather();
    updateHUD();
    this.refreshSpatialCards();
    if (this.activeDrawer === 'cultivation') renderActiveDrawer();
    showToast(`Refined ${path.toUpperCase()} Dao essence (+50% layer Qi).`);
  }

  public breakthroughPath(path: CultivationPath) {
    const st = this.cultivation[path];
    st.currentEnergy = 0n;
    if (st.layer < 9) {
      st.layer += 1;
      sound.playUpgradeFanfare();
      showToast(`${path.toUpperCase()} advanced to Layer ${st.layer}!`);
    } else if (st.realmIndex < CULTIVATION_REALMS.length - 1) {
      st.realmIndex += 1;
      st.layer = 1;
      this.playerMaxHp += 2500 * (st.realmIndex + 1);
      this.playerHp = this.playerMaxHp;
      sound.playThunder();
      this.rebuildPlayerMesh();
      showToast(`HEAVENLY BREAKTHROUGH! Reached ${CULTIVATION_REALMS[st.realmIndex].name}!`);
    }

    updateHUD();
    this.refreshSpatialCards();
    if (this.activeDrawer === 'cultivation') renderActiveDrawer();
  }

  public performStrikeOrHarvest() {
    if (this.gameState !== 'playing') return;
    sound.playSwing();

    if (this.playerGroup) {
      const sword = this.playerGroup.getObjectByName('SpiritSword');
      if (sword) {
        sword.rotation.x = Math.PI / 1.8;
        setTimeout(() => {
          sword.rotation.x = Math.PI / 5;
        }, 140);
      }
    }

    for (const node of this.resourceNodes) {
      const dist = Math.hypot(node.x - this.playerPos.x, node.z - this.playerPos.z);
      if (dist <= 4.5 && node.amount > 0n) {
        const harvest = calculateWeatherGatherRate(1200n, node.type, this.weather);
        this.resources[node.type] += harvest;
        sound.playGather();
        showToast(`Harvested +${formatBigInt(harvest)} ${node.type.toUpperCase()}!`);
        updateHUD();
        return;
      }
    }

    let targetMonster: MonsterTarget | null = null;
    let bestDist = 9.5;
    for (const m of this.monsters) {
      const dist = Math.hypot(m.x - this.playerPos.x, m.z - this.playerPos.z);
      if (dist < bestDist) {
        bestDist = dist;
        targetMonster = m;
      }
    }

    if (targetMonster) {
      const highestRealm = this.getHighestRealmIndex();
      const monsterRealm = Math.min(22, Math.floor(targetMonster.level / 45));
      const suppression = calculateRealmSuppression(highestRealm, monsterRealm);
      const dmg = BigInt(Math.max(800, Math.floor(1200 * suppression.damageMultiplier)));

      targetMonster.hp = targetMonster.hp > dmg ? targetMonster.hp - dmg : 0n;
      this.hitstopTimer = 0.06;
      this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.35);

      if (targetMonster.hp <= 0n) {
        sound.playExplosion();
        this.monstersSlain += 1;
        this.resources.diamond += targetMonster.expReward;
        this.resources.wood += targetMonster.expReward * 2n;

        const nextLvl = Math.min(1000, targetMonster.level + 10);
        const angle = Math.random() * Math.PI * 2;
        const dist = 24 + Math.random() * 12;
        const respawned = createScaledMonsterByLevel(
          nextLvl,
          Math.cos(angle) * dist,
          Math.sin(angle) * dist
        );
        Object.assign(targetMonster, respawned, { id: targetMonster.id });

        showToast(`Slain ${targetMonster.name}! +${formatBigInt(targetMonster.expReward)} Spirit Diamonds`);
      } else {
        showToast(`Struck ${targetMonster.name} for ${formatBigInt(dmg)} DMG (${suppression.suppressionLabel})!`);
      }
      updateHUD();
    }
  }

  update() {
    const dt = Math.min(0.1, xb.getDeltaTime?.() || 0.016);

    if (this.proteinGroup) {
      this.proteinGroup.rotation.y += dt * 0.55;
    }
    if (this.playerGroup) {
      const core = this.playerGroup.getObjectByName('GoldenCoreOrb');
      if (core) {
        core.rotation.y += dt * 2.5;
        core.position.y = 1.1 + Math.sin(performance.now() * 0.004) * 0.08;
      }
      const halo = this.playerGroup.getObjectByName('DaoCreatorHalo');
      if (halo) {
        halo.rotation.z += dt * 1.2;
      }
    }
    if (this.castleGroup) {
      const citadelHalo = this.castleGroup.getObjectByName('CitadelHalo');
      if (citadelHalo) {
        citadelHalo.rotation.z += dt * 0.6;
      }
    }

    if (this.gameState !== 'playing') return;

    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      return;
    }

    const econ = calculateMasterDiscipleEconomy({
      masterRealmIndex: this.getHighestRealmIndex() + 2,
      disciples: this.disciples,
      masterTaxRatePct: this.masterTaxRatePct,
    });
    const moveSpeed = 9.5 * (1 + econ.proximitySpeedBuffPct / 200);

    let dx = 0;
    let dz = 0;
    if (this.keysPressed.has('KeyW') || this.keysPressed.has('ArrowUp')) dz -= 1;
    if (this.keysPressed.has('KeyS') || this.keysPressed.has('ArrowDown')) dz += 1;
    if (this.keysPressed.has('KeyA') || this.keysPressed.has('ArrowLeft')) dx -= 1;
    if (this.keysPressed.has('KeyD') || this.keysPressed.has('ArrowRight')) dx += 1;

    const isMoving = dx !== 0 || dz !== 0;
    if (isMoving) {
      const len = Math.hypot(dx, dz);
      this.playerPos.x = Math.max(-48, Math.min(48, this.playerPos.x + (dx / len) * moveSpeed * dt));
      this.playerPos.z = Math.max(-48, Math.min(48, this.playerPos.z + (dz / len) * moveSpeed * dt));
      if (this.playerGroup) {
        this.playerGroup.position.copy(this.playerPos);
        this.playerGroup.rotation.y = Math.atan2(dx, dz);
      }
    }

    // Tick Red-Name Stationary Tribulation Lightning every 1 second
    this.tribulationAccumSec += dt;
    if (this.tribulationAccumSec >= 1.0) {
      this.tribulationAccumSec = 0;
      const res = tickRedNameStationaryLightning({
        karma: this.karma,
        isMoving,
        deltaSec: 1,
      });
      this.karma = res.updatedKarma;
      if (res.struckByInstantKillLightning) {
        this.triggerTribulationLightningStrike();
      }
    }

    // Autonomous Monster AI with A* Keep-Avoidance
    for (const m of this.monsters) {
      const waypoints = computeAStarAvoidKeepPath(
        { x: m.x, z: m.z },
        { x: this.playerPos.x, z: this.playerPos.z }
      );
      const target = waypoints[0];
      const distToTarget = Math.hypot(target.x - m.x, target.z - m.z);
      if (distToTarget > 1.8 && distToTarget < 18) {
        m.x += ((target.x - m.x) / distToTarget) * 2.6 * dt;
        m.z += ((target.z - m.z) / distToTarget) * 2.6 * dt;
      }

      const mesh = this.monsterMeshes.get(m.id);
      if (mesh) {
        mesh.position.set(m.x, 0, m.z);
        mesh.lookAt(this.playerPos.x, 0, this.playerPos.z);
        const hpFill = mesh.getObjectByName('HPBarFill');
        if (hpFill) {
          const ratio = Math.max(0.02, Number(m.hp) / Math.max(1, Number(m.maxHp)));
          hpFill.scale.x = 1.18 * ratio;
        }
      }
    }

    // Autonomous NPC Patrol
    const t = performance.now() * 0.0006;
    this.npcs.forEach((npc, idx) => {
      const mesh = this.npcMeshes.get(npc.id);
      if (mesh) {
        mesh.position.set(npc.x + Math.sin(t + idx) * 2.0, 0, npc.z + Math.cos(t + idx) * 2.0);
      }
    });

    // Camera Follow & Trauma Shake
    const cam = (xb.core as any)?.camera as THREE.PerspectiveCamera | undefined;
    const isPresenting = (xb.core as any)?.renderer?.xr?.isPresenting;
    if (cam && !isPresenting) {
      const targetCamPos = new THREE.Vector3(this.playerPos.x * 0.55, 11.5, this.playerPos.z + 15.5);
      cam.position.lerp(targetCamPos, 0.08);
      if (this.cameraTrauma > 0) {
        const shake = this.cameraTrauma * this.cameraTrauma * 0.35;
        cam.position.x += (Math.random() - 0.5) * shake;
        cam.position.y += (Math.random() - 0.5) * shake;
        this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 2.4);
      }
      cam.lookAt(this.playerPos.x * 0.7, 1.8, this.playerPos.z * 0.7);
    }
  }

  public triggerTribulationLightningStrike() {
    sound.playThunder();
    this.cameraTrauma = 1.0;

    if (this.lightningBoltMesh) {
      this.lightningBoltMesh.position.set(this.playerPos.x, 14, this.playerPos.z);
      const mat = this.lightningBoltMesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.95;
      setTimeout(() => {
        mat.opacity = 0;
      }, 380);
    }

    this.playerHp = Math.max(1, Math.floor(this.playerHp * 0.15));
    showToast(
      this.karma.lastLightningStrikeMsg ||
        '⚡ HEAVENLY TRIBULATION LIGHTNING! Stationary Red-Name Fiend struck!'
    );
    updateHUD();
  }
}

const app = new VoxelRealmsXRApp();
let toastTimeout: number | null = null;

function showToast(message: string) {
  const banner = document.getElementById('toast-banner');
  if (!banner) return;
  banner.textContent = message;
  banner.classList.add('visible');
  if (toastTimeout) window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => {
    banner.classList.remove('visible');
  }, 3200);
}

function setGameLifecycleState(nextState: GameLifecycleState) {
  app.gameState = nextState;
  document.body.dataset.state = nextState;

  const titleEl = document.getElementById('title-overlay');
  const hudEl = document.getElementById('hud-overlay');
  const stateModalEl = document.getElementById('state-modal');

  if (nextState === 'title') {
    titleEl?.classList.remove('hidden-overlay');
    hudEl?.classList.add('hidden-overlay');
    stateModalEl?.classList.add('hidden-overlay');
  } else if (nextState === 'playing') {
    titleEl?.classList.add('hidden-overlay');
    hudEl?.classList.remove('hidden-overlay');
    stateModalEl?.classList.add('hidden-overlay');
    updateHUD();
  } else {
    titleEl?.classList.add('hidden-overlay');
    hudEl?.classList.remove('hidden-overlay');
    stateModalEl?.classList.remove('hidden-overlay');
    renderStateModal(nextState);
  }
}

function renderStateModal(state: GameLifecycleState) {
  const container = document.getElementById('state-modal-content');
  if (!container) return;

  const era = getCastleEra(app.castleLevel);
  const heading =
    state === 'gameover'
      ? 'CITADEL FALLEN — REALM TRIBULATION'
      : state === 'victory'
        ? 'IMMORTAL SOVEREIGN VICTORY'
        : 'REALM CHRONICLE PAUSED';

  container.innerHTML = `
    <h2 class="title-heading" style="font-size:1.85rem;margin-bottom:8px;">${heading}</h2>
    <p class="title-subtitle" style="margin-bottom:18px;">Review your Sovereign Citadel telemetry or return to the open world.</p>
    <div class="panel-grid" style="margin-bottom:20px;text-align:left;">
      <div class="panel-card">
        <span class="hud-stat-label">Citadel Level & Era</span>
        <strong class="font-mono-num" style="font-size:1.05rem;color:#fde68a;">Lv ${app.castleLevel} — ${era.name}</strong>
      </div>
      <div class="panel-card">
        <span class="hud-stat-label">Highest Cultivation Realm</span>
        <strong style="font-size:1.05rem;color:#38bdf8;">${CULTIVATION_REALMS[app.getHighestRealmIndex()]?.name}</strong>
      </div>
      <div class="panel-card">
        <span class="hud-stat-label">Monsters Slain & Legion Power</span>
        <strong class="font-mono-num" style="font-size:1.05rem;color:#4ade80;">${app.monstersSlain} Slain | ${formatBigInt(app.getTotalPower())} PWR</strong>
      </div>
    </div>
    <div style="display:flex;justify-content:center;gap:12px;flex-wrap:wrap;">
      <button id="btn-resume-play" class="primary-cta" style="padding:10px 24px;font-size:0.95rem;">Resume Realm</button>
      <button id="btn-return-title" class="action-btn-secondary" style="padding:10px 20px;">Return to Title Screen</button>
    </div>
  `;

  document.getElementById('btn-resume-play')?.addEventListener('click', () => {
    setGameLifecycleState('playing');
  });
  document.getElementById('btn-return-title')?.addEventListener('click', () => {
    setGameLifecycleState('title');
  });
}

function updateHUD() {
  const hpFill = document.getElementById('hud-hp-fill');
  const hpText = document.getElementById('hud-hp-text');
  const realmText = document.getElementById('hud-realm-text');
  const castleText = document.getElementById('hud-castle-text');
  const karmaBadge = document.getElementById('hud-karma-badge');

  const woodEl = document.getElementById('hud-res-wood');
  const steelEl = document.getElementById('hud-res-steel');
  const diamondEl = document.getElementById('hud-res-diamond');
  const grainEl = document.getElementById('hud-res-grain');
  const powerEl = document.getElementById('hud-res-power');

  if (hpFill) {
    const pct = Math.max(0, Math.min(100, (app.playerHp / app.playerMaxHp) * 100));
    hpFill.style.width = `${pct}%`;
  }
  if (hpText) {
    hpText.textContent = `${Math.ceil(app.playerHp)} / ${app.playerMaxHp}`;
  }
  if (realmText) {
    const rIdx = app.getHighestRealmIndex();
    realmText.textContent = `${CULTIVATION_REALMS[rIdx]?.name || 'Qi Refinement'} (L${app.cultivation.qi.layer})`;
  }
  if (castleText) {
    const era = getCastleEra(app.castleLevel);
    castleText.textContent = `Citadel Lv.${app.castleLevel} (${era.name})`;
  }
  if (karmaBadge) {
    const isFiend = app.karma.alignment === 'red_fiend';
    karmaBadge.textContent = isFiend
      ? `RED-NAME FIEND (${app.karma.karmaValue})`
      : `Righteous (${app.karma.karmaValue})`;
    karmaBadge.style.color = isFiend ? '#f87171' : '#38bdf8';
  }

  if (woodEl) woodEl.textContent = formatBigInt(app.resources.wood);
  if (steelEl) steelEl.textContent = formatBigInt(app.resources.steel);
  if (diamondEl) diamondEl.textContent = formatBigInt(app.resources.diamond);
  if (grainEl) grainEl.textContent = formatBigInt(app.resources.grain);
  if (powerEl) powerEl.textContent = formatBigInt(app.getTotalPower());
}

function openDrawer(drawerId: string) {
  if (app.activeDrawer === drawerId) {
    closeDrawer();
    return;
  }
  app.activeDrawer = drawerId;
  document.getElementById('modal-overlay')?.classList.remove('hidden-overlay');
  document.querySelectorAll('.dock-btn').forEach((btn) => {
    btn.classList.toggle('active-tab', btn.getAttribute('data-drawer') === drawerId);
  });
  renderActiveDrawer();
}

function closeDrawer() {
  app.activeDrawer = null;
  document.getElementById('modal-overlay')?.classList.add('hidden-overlay');
  document.querySelectorAll('.dock-btn').forEach((btn) => btn.classList.remove('active-tab'));
}

function askConfirmationModal(
  title: string,
  description: string,
  onConfirm: () => Promise<void> | void
) {
  const dialog = document.getElementById('confirm-dialog');
  const titleEl = document.getElementById('confirm-title');
  const descEl = document.getElementById('confirm-desc');
  const confirmBtn = document.getElementById('confirm-accept-btn');
  const cancelBtn = document.getElementById('confirm-cancel-btn');

  if (!dialog || !titleEl || !descEl || !confirmBtn || !cancelBtn) return;

  titleEl.textContent = title;
  descEl.textContent = description;
  dialog.classList.remove('hidden-overlay');

  const cleanup = () => {
    dialog.classList.add('hidden-overlay');
    confirmBtn.onclick = null;
    cancelBtn.onclick = null;
  };

  confirmBtn.onclick = async () => {
    cleanup();
    await onConfirm();
  };
  cancelBtn.onclick = () => cleanup();
}

function renderActiveDrawer() {
  const titleEl = document.getElementById('modal-title');
  const bodyEl = document.getElementById('modal-body');
  if (!titleEl || !bodyEl || !app.activeDrawer) return;

  if (app.activeDrawer === 'castle') {
    titleEl.textContent = 'CITADEL EXPANSION (LV 0–100) & T1–T20 WAR BARRACKS';
    const era = getCastleEra(app.castleLevel);
    const troopCap = calculateCastleTroopCapacity(app.castleLevel);
    const rallyCap = calculateRallyCapacity(app.castleLevel);
    const totalPower = app.getTotalPower();

    bodyEl.innerHTML = `
      <div class="panel-grid">
        <div class="panel-card">
          <div class="hud-stat-label">Current Sovereign Keep</div>
          <div style="font-size:1.1rem;font-weight:700;color:#fde68a;">Lv ${app.castleLevel} — ${era.name}</div>
          <div class="font-mono-num" style="font-size:0.8rem;color:#cbd5e1;">
            Theme: ${era.buildingTheme} (${era.perkDescription})<br/>
            Troop Capacity: ${formatBigInt(troopCap)} (1,000T at Lv.100)<br/>
            Rally Capacity: ${formatBigInt(rallyCap)} (1T at Lv.100)
          </div>
          <div style="display:flex;gap:8px;margin-top:6px;">
            <button id="drawer-upgrade-keep" class="action-btn">+1 Upgrade Keep</button>
            <button id="drawer-jump-era" class="action-btn-secondary">+10 Era Ascend</button>
          </div>
        </div>

        <div class="panel-card">
          <div class="hud-stat-label">Tactical Counter Matrix & Daily Scroll</div>
          <div style="font-size:0.8rem;color:#cbd5e1;line-height:1.45;">
            • <strong>Shieldbearer</strong> counters <strong>Shooter</strong> (+35% DMG)<br/>
            • <strong>Shooter</strong> counters <strong>Bomber</strong> (+35% DMG)<br/>
            • <strong>Bomber</strong> counters <strong>Shieldbearer</strong> (+35% DMG)<br/>
            • Total Multiplicative Power: <strong class="font-mono-num" style="color:#4ade80;">${formatBigInt(totalPower)}</strong>
          </div>
          <button id="drawer-claim-daily" class="action-btn-secondary" style="margin-top:6px;">Claim Daily Veteran Scroll (+50K Resources)</button>
        </div>
      </div>

      <div class="panel-card">
        <div class="hud-stat-label">Train T1–T20 Immortal Legions</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px;max-height:240px;overflow-y:auto;">
          ${[1, 5, 10, 15, 20]
            .map((tier) => {
              const sCount = app.troops[`shieldbearer_t${tier}`] || 0n;
              const rCount = app.troops[`shooter_t${tier}`] || 0n;
              const bCount = app.troops[`bomber_t${tier}`] || 0n;
              return `
                <div style="background:rgba(7,11,20,0.8);border:1px solid rgba(148,163,184,0.2);border-radius:8px;padding:10px;">
                  <div style="font-weight:700;color:#fde68a;font-size:0.82rem;margin-bottom:4px;">Tier ${tier} Legions</div>
                  <div class="font-mono-num" style="font-size:0.74rem;color:#94a3b8;margin-bottom:6px;">
                    Shield: ${formatBigInt(sCount)} | Shoot: ${formatBigInt(rCount)} | Bomb: ${formatBigInt(bCount)}
                  </div>
                  <div style="display:flex;gap:4px;flex-wrap:wrap;">
                    <button class="action-btn train-btn" data-tier="${tier}" data-type="shieldbearer" style="padding:4px 8px;font-size:0.7rem;">+1K Shield</button>
                    <button class="action-btn train-btn" data-tier="${tier}" data-type="shooter" style="padding:4px 8px;font-size:0.7rem;">+1K Shooter</button>
                    <button class="action-btn train-btn" data-tier="${tier}" data-type="bomber" style="padding:4px 8px;font-size:0.7rem;">+1K Bomber</button>
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>
      </div>
    `;

    document.getElementById('drawer-upgrade-keep')?.addEventListener('click', () => app.upgradeCastle());
    document.getElementById('drawer-jump-era')?.addEventListener('click', () => {
      app.castleLevel = Math.min(100, app.castleLevel + 10);
      sound.playUpgradeFanfare();
      app.rebuildCastleMesh();
      updateHUD();
      renderActiveDrawer();
      showToast(`Citadel ascended to Lv ${app.castleLevel}!`);
    });
    document.getElementById('drawer-claim-daily')?.addEventListener('click', () => {
      app.resources.wood += 50_000n;
      app.resources.steel += 50_000n;
      app.resources.diamond += 15_000n;
      app.resources.grain += 50_000n;
      sound.playUpgradeFanfare();
      updateHUD();
      renderActiveDrawer();
      showToast('Claimed Daily Veteran Scroll (+50K Wood/Steel/Grain, +15K Diamonds)!');
    });

    bodyEl.querySelectorAll('.train-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tier = Number(btn.getAttribute('data-tier'));
        const type = btn.getAttribute('data-type') as TroopType;
        app.trainTroops(tier, type, 1000n);
      });
    });
  } else if (app.activeDrawer === 'cultivation') {
    titleEl.textContent = 'FOUR-PATH IMMORTAL CULTIVATION, 100X SUPPRESSION, KARMA & MASTER-DISCIPLE';
    const rIdx = app.getHighestRealmIndex();
    const suppression = calculateRealmSuppression(Math.max(2, rIdx), 0);
    const synergy = calculateFourPathSynergy(app.cultivation);
    const econ = calculateMasterDiscipleEconomy({
      masterRealmIndex: rIdx + 2,
      disciples: app.disciples,
      masterTaxRatePct: app.masterTaxRatePct,
    });
    const auraSpec = getCultivationAuraVisualSpec(rIdx);

    bodyEl.innerHTML = `
      <div class="panel-grid">
        ${(['qi', 'body', 'soul', 'mind'] as CultivationPath[])
          .map((path) => {
            const st = app.cultivation[path];
            const rDef = CULTIVATION_REALMS[st.realmIndex] || CULTIVATION_REALMS[0];
            const req = calculateQiRequired(st.realmIndex, st.layer);
            const pct = Math.min(100, Math.round((Number(st.currentEnergy) / Math.max(1, Number(req))) * 100));
            return `
              <div class="panel-card">
                <div class="hud-stat-label">${path.toUpperCase()} PATH (${rDef.chineseName})</div>
                <div style="font-size:1.0rem;font-weight:700;color:#38bdf8;">${rDef.icon} ${rDef.name} — Layer ${st.layer}/9</div>
                <div class="hp-bar-track" style="width:100%;margin:4px 0;">
                  <div class="hp-bar-fill" style="width:${pct}%;background:linear-gradient(90deg,#0ea5e9,#a855f7);"></div>
                </div>
                <div style="display:flex;gap:6px;margin-top:4px;">
                  <button class="action-btn cult-btn" data-path="${path}">Refine ${path.toUpperCase()}</button>
                  <button class="action-btn-secondary break-btn" data-path="${path}">Breakthrough</button>
                </div>
              </div>
            `;
          })
          .join('')}
      </div>

      <div class="panel-grid">
        <div class="panel-card">
          <div class="hud-stat-label">100x Realm Suppression & 3D Aura Cue</div>
          <div style="font-size:0.8rem;color:#cbd5e1;line-height:1.45;">
            • <strong>3D Aura Visual</strong>: ${auraSpec.label} (${auraSpec.chineseLabel})<br/>
            • <strong>Suppression Rule</strong>: ${suppression.suppressionLabel} (${suppression.damageMultiplier.toLocaleString()}x vs Qi Refinement)<br/>
            • <strong>Four-Path Synergy</strong>: ${synergy.totalCombinedMultiplier.toFixed(2)}x Combined Multiplier<br/>
            • <strong>Karma Status</strong>: <strong style="color:${app.karma.alignment === 'red_fiend' ? '#f87171' : '#4ade80'};">${app.karma.alignment.toUpperCase()} (${app.karma.karmaValue})</strong>
          </div>
          <div style="display:flex;gap:8px;margin-top:6px;">
            <button id="btn-toggle-karma" class="action-btn-secondary">Simulate Unlawful Kill (Red-Name Fiend)</button>
            <button id="btn-test-tribulation" class="action-btn">Strike Tribulation Lightning</button>
          </div>
        </div>

        <div class="panel-card">
          <div class="hud-stat-label">Master & Disciple Economy (50m Proximity Buff & Tax)</div>
          <div style="font-size:0.8rem;color:#cbd5e1;line-height:1.45;">
            • Disciples within 50m: <strong>${econ.nearDisciplesCount} / ${app.disciples.length}</strong> (+${econ.proximitySpeedBuffPct}% Speed Buff)<br/>
            • Spirit Stone Tax (${app.masterTaxRatePct}%): <strong>+${formatBigInt(econ.totalMasterTaxSpiritStonesPerSec)}/s</strong> Stones & <strong>+${formatBigInt(econ.totalMasterTaxQiPerSec)}/s</strong> Qi<br/>
            • Active Scroll Transmission: <strong style="color:#c084fc;">Heaven Earth Sleeve (袖里乾坤)</strong>
          </div>
        </div>
      </div>
    `;

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
        currentKarma: app.karma,
        attackerRealmIndex: Math.max(2, app.getHighestRealmIndex()),
        victimRealmIndex: 0,
        victimKarmaValue: 100,
        victimName: 'Junior Sect Disciple',
      });
      app.karma = outcome.updatedKarma;
      app.rebuildPlayerMesh();
      updateHUD();
      renderActiveDrawer();
      showToast(outcome.message);
    });
    document.getElementById('btn-test-tribulation')?.addEventListener('click', () => {
      app.triggerTribulationLightningStrike();
    });
  } else if (app.activeDrawer === 'world') {
    titleEl.textContent = 'AUTONOMOUS WORLD AI DIRECTOR (LV 1–1000 MONSTERS & 6 NPC ROLES)';
    bodyEl.innerHTML = `
      <div class="panel-grid">
        <div class="panel-card">
          <div class="hud-stat-label">Dynamic Realm Weather & Resource Modifiers</div>
          <div style="font-size:0.84rem;color:#cbd5e1;margin-bottom:6px;">
            Active Weather: <strong style="color:#38bdf8;text-transform:uppercase;">${app.weather}</strong>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${(['clear', 'rain', 'snow', 'storm'] as WeatherType[])
              .map(
                (w) =>
                  `<button class="action-btn-secondary weather-btn" data-weather="${w}">${w.toUpperCase()}</button>`
              )
              .join('')}
          </div>
        </div>

        <div class="panel-card">
          <div class="hud-stat-label">Active Monster Ecology (${app.monsters.length} Tracked)</div>
          <div style="max-height:150px;overflow-y:auto;font-size:0.76rem;display:flex;flex-direction:column;gap:5px;">
            ${app.monsters
              .map(
                (m) => `
              <div style="display:flex;justify-content:space-between;background:rgba(7,11,20,0.75);padding:5px 8px;border-radius:6px;">
                <span><strong>${m.name}</strong> (${m.movementPolicy})</span>
                <span class="font-mono-num" style="color:#f87171;">HP: ${formatBigInt(m.hp)}</span>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      </div>

      <div class="panel-card">
        <div class="hud-stat-label">Autonomous Citizen NPCs (6 Roles)</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:6px;font-size:0.76rem;">
          ${app.npcs
            .map(
              (n) => `
            <div style="background:rgba(7,11,20,0.75);padding:6px 10px;border-radius:6px;">
              <strong>${n.name}</strong> (${n.role.toUpperCase()})<br/>
              <span style="color:#94a3b8;">"${n.statusText}"</span>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `;

    bodyEl.querySelectorAll('.weather-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        app.weather = btn.getAttribute('data-weather') as WeatherType;
        if (app.weather === 'storm') sound.playThunder();
        renderActiveDrawer();
        showToast(`Realm weather shifted to ${app.weather.toUpperCase()}.`);
      });
    });
  } else if (app.activeDrawer === 'bioscience') {
    titleEl.textContent = 'BIOSCIENCE PROTEIN STRUCTURE WORKBENCH (ALPHAFOLD DB / RCSB PDB / UNIPROT)';
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
            UniProtKB: <a href="${p.uniprotUrl}" target="_blank">${p.uniprotId}</a> | RCSB PDB: <a href="${p.rcsbUrl}" target="_blank">${p.pdbId}</a> | <a href="${p.alphafoldUrl}" target="_blank">AlphaFold Entry</a><br/>
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
  } else if (app.activeDrawer === 'gemini') {
    titleEl.textContent = 'GEMINI AI COMMAND CENTER (THINKING, GROUNDING, IMAGE, VIDEO, LYRIA & LIVE VOICE)';
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
                (m) =>
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
              <option value="3:2">3:2</option>
              <option value="2:3">2:3</option>
              <option value="21:9">21:9</option>
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
      const mode = (modeSelect?.value || 'argon_thinking') as
        | 'argon_thinking'
        | 'flash_standard'
        | 'flash_lite_fast';
      const prevHistory = [...app.chatHistory];
      app.chatHistory.push({ role: 'user', text: msg });
      renderActiveDrawer();
      try {
        const res = await sendGeminiChatMessage({ history: prevHistory, message: msg, mode });
        app.chatHistory.push({ role: 'model', text: res.text });
        renderActiveDrawer();
      } catch (e: any) {
        app.chatHistory.push({ role: 'model', text: `Error: ${e.message}` });
        renderActiveDrawer();
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
        renderActiveDrawer();
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
        renderActiveDrawer();
      } catch (e: any) {
        showToast(`Maps error: ${e.message}`);
      }
    });

    document.getElementById('btn-gemini-tts')?.addEventListener('click', async () => {
      const lastMsg =
        [...app.chatHistory].reverse().find((m) => m.role === 'model')?.text ||
        'Welcome to Voxel Realms XR.';
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
        renderActiveDrawer();
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
      renderActiveDrawer();
    });
  } else if (app.activeDrawer === 'workspace') {
    titleEl.textContent = 'FIREBASE CLOUD SAVE & 1P GOOGLE WORKSPACE COMMAND SUITE';
    bodyEl.innerHTML = `
      <div class="panel-grid">
        <div class="panel-card">
          <div class="hud-stat-label">Firebase Auth & Cloud Save (/realm_saves)</div>
          <div style="font-size:0.84rem;color:#cbd5e1;">
            Signed In Account: <strong style="color:#fde68a;">${app.currentUserName || 'Guest (Sign in to persist across devices)'}</strong>
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

    document.getElementById('btn-google-signin')?.addEventListener('click', async () => {
      try {
        const res = await googleSignIn();
        if (res) {
          app.currentUserName = res.user.displayName || res.user.email || 'Sovereign Lord';
          showToast(`Signed in as ${app.currentUserName}!`);
          renderActiveDrawer();
        }
      } catch (e: any) {
        setLog(`Sign-in error: ${e.message}`);
      }
    });

    document.getElementById('btn-google-signout')?.addEventListener('click', async () => {
      await logout();
      app.currentUserName = null;
      renderActiveDrawer();
    });

    document.getElementById('btn-cloud-save')?.addEventListener('click', async () => {
      try {
        await saveRealmStateToFirestore({
          lordName: app.currentUserName || 'Aiden Skyrender',
          clanTag: 'VALOR',
          castleLevel: app.castleLevel,
          cultivationRealmIndex: app.getHighestRealmIndex(),
          cultivationLayer: app.cultivation.qi.layer,
          karmaValue: app.karma.karmaValue,
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
        app.cultivation.qi.realmIndex = data.cultivationRealmIndex;
        app.cultivation.qi.layer = data.cultivationLayer;
        app.karma.karmaValue = data.karmaValue;
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
      askConfirmationModal(
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
      askConfirmationModal(
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
      askConfirmationModal(
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
      askConfirmationModal(
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
      askConfirmationModal(
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
      askConfirmationModal(
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
      askConfirmationModal(
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
  }
}

function buildDOMGameShell() {
  const root = document.getElementById('root');
  if (!root) return;

  root.innerHTML = `
    <div id="title-overlay">
      <div class="title-card">
        <div class="title-eyebrow">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          <span>Open-World WebXR MMORPG • 23 Immortal Realms • AlphaFold 3D</span>
        </div>
        <h1 class="title-heading">VOXEL REALMS XR</h1>
        <p class="title-subtitle">
          Command a Lv 0–100 Sovereign Citadel across 10 Eras, train T1–T20 legions up to 1,000 Trillion capacity, ascend the Four Immortal Paths with 100x Realm Suppression, and inspect live 3D AlphaFold biomolecular structures.
        </p>
        <button id="btn-start-game" data-start="true" class="primary-cta">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          <span>ENTER SOVEREIGN REALM</span>
        </button>

        <div class="control-strip">
          <div class="keycap-chip">
            <span class="keycap-badge">WASD / Arrows</span>
            <span>Move Cultivator</span>
          </div>
          <div class="keycap-chip">
            <span class="keycap-badge">SPACE / Click</span>
            <span>Sword Strike & Harvest</span>
          </div>
          <div class="keycap-chip">
            <span class="keycap-badge">P / ESC</span>
            <span>Pause & Telemetry</span>
          </div>
        </div>
      </div>
    </div>

    <div id="hud-overlay" class="hidden-overlay">
      <div class="hud-top-bar">
        <div class="hud-cluster">
          <div>
            <div class="hud-stat-label" id="hud-castle-text">Citadel Lv.1 (Era I: Timber Encampment)</div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:2px;">
              <div class="hp-bar-track">
                <div id="hud-hp-fill" class="hp-bar-fill" style="width:100%;"></div>
              </div>
              <span id="hud-hp-text" class="font-mono-num" style="font-size:0.75rem;">2500 / 2500</span>
            </div>
          </div>
          <div style="border-left:1px solid rgba(148,163,184,0.25);padding-left:10px;">
            <div class="hud-stat-label">Cultivation Realm</div>
            <div id="hud-realm-text" style="font-size:0.8rem;font-weight:700;color:#38bdf8;">Qi Refinement (L1)</div>
          </div>
          <div style="border-left:1px solid rgba(148,163,184,0.25);padding-left:10px;">
            <div class="hud-stat-label">Karma Dao</div>
            <div id="hud-karma-badge" style="font-size:0.78rem;font-weight:700;color:#38bdf8;">Righteous (120)</div>
          </div>
        </div>

        <div class="hud-cluster">
          <div class="hud-stat" title="Spirit Timber">
            <span style="color:#4ade80;">▲</span>
            <span class="hud-stat-label">Wood</span>
            <span id="hud-res-wood" class="font-mono-num">25.0K</span>
          </div>
          <div class="hud-stat" title="High Carbon Steel">
            <span style="color:#94a3b8;">◆</span>
            <span class="hud-stat-label">Steel</span>
            <span id="hud-res-steel" class="font-mono-num">20.0K</span>
          </div>
          <div class="hud-stat" title="Spirit Diamonds">
            <span style="color:#38bdf8;">✦</span>
            <span class="hud-stat-label">Diamond</span>
            <span id="hud-res-diamond" class="font-mono-num">2.5K</span>
          </div>
          <div class="hud-stat" title="Spirit Grain">
            <span style="color:#facc15;">●</span>
            <span class="hud-stat-label">Grain</span>
            <span id="hud-res-grain" class="font-mono-num">30.0K</span>
          </div>
          <div class="hud-stat" title="Legion Power">
            <span style="color:#f87171;">⚔</span>
            <span class="hud-stat-label">Power</span>
            <span id="hud-res-power" class="font-mono-num">19.2K</span>
          </div>
          <button id="btn-strike-action" class="hud-icon-btn" title="Strike / Harvest (Space)">⚔ Strike</button>
          <button id="btn-mute-audio" class="hud-icon-btn" title="Toggle Audio">🔊</button>
          <button id="btn-pause-game" class="hud-icon-btn" title="Pause Game (P)">⏸</button>
        </div>
      </div>

      <div class="hud-bottom-bar">
        <div class="command-dock">
          <button class="dock-btn" data-drawer="castle">🏰 Citadel & Army</button>
          <button class="dock-btn" data-drawer="cultivation">⚡ 4-Path Cultivation</button>
          <button class="dock-btn" data-drawer="world">🌍 World AI & Weather</button>
          <button class="dock-btn" data-drawer="bioscience">🧬 Bioscience 3D PDB</button>
          <button class="dock-btn" data-drawer="gemini">✨ Gemini AI Suite</button>
          <button class="dock-btn" data-drawer="workspace">☁️ Cloud & Workspace</button>
        </div>
      </div>
    </div>

    <div id="toast-banner"></div>

    <div id="modal-overlay" class="hidden-overlay">
      <div class="modal-window">
        <div class="modal-header">
          <h3 id="modal-title" class="modal-title">Command Center</h3>
          <button id="modal-close-btn" class="hud-icon-btn">✕ Close</button>
        </div>
        <div id="modal-body" class="modal-body"></div>
      </div>
    </div>

    <div id="state-modal" class="hidden-overlay">
      <div id="state-modal-content" class="title-card"></div>
    </div>

    <div id="confirm-dialog" class="hidden-overlay">
      <div class="title-card" style="max-width:460px;padding:24px;">
        <h3 id="confirm-title" class="modal-title" style="margin-bottom:8px;">Confirm Action</h3>
        <p id="confirm-desc" style="font-size:0.86rem;color:#cbd5e1;margin-bottom:18px;"></p>
        <div style="display:flex;justify-content:center;gap:10px;">
          <button id="confirm-accept-btn" class="action-btn">Confirm & Execute</button>
          <button id="confirm-cancel-btn" class="action-btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-start-game')?.addEventListener('click', () => {
    sound.playUpgradeFanfare();
    setGameLifecycleState('playing');
  });

  document.getElementById('btn-strike-action')?.addEventListener('click', () => {
    app.performStrikeOrHarvest();
  });

  document.getElementById('btn-mute-audio')?.addEventListener('click', (e) => {
    const muted = sound.toggleMute();
    (e.currentTarget as HTMLElement).textContent = muted ? '🔇' : '🔊';
  });

  document.getElementById('btn-pause-game')?.addEventListener('click', () => {
    setGameLifecycleState(app.gameState === 'paused' ? 'playing' : 'paused');
  });

  document.querySelectorAll('.dock-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const drawer = btn.getAttribute('data-drawer');
      if (drawer) openDrawer(drawer);
    });
  });

  document.getElementById('modal-close-btn')?.addEventListener('click', () => {
    closeDrawer();
  });

  window.addEventListener('keydown', (e) => {
    const activeTag = document.activeElement?.tagName;
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') {
      return;
    }

    if (app.gameState === 'title' && (e.code === 'Enter' || e.code === 'Space')) {
      e.preventDefault();
      sound.playUpgradeFanfare();
      setGameLifecycleState('playing');
      return;
    }

    if (e.code === 'KeyP' || e.code === 'Escape') {
      if (app.activeDrawer) {
        closeDrawer();
        return;
      }
      if (app.gameState === 'playing') {
        setGameLifecycleState('paused');
      } else if (app.gameState === 'paused') {
        setGameLifecycleState('playing');
      }
      return;
    }

    if (app.gameState === 'playing') {
      app.keysPressed.add(e.code);
      if (e.code === 'Space') {
        e.preventDefault();
        app.performStrikeOrHarvest();
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    app.keysPressed.delete(e.code);
  });

  initAuth(
    (user) => {
      app.currentUserName = user.displayName || user.email || 'Sovereign Lord';
      if (app.activeDrawer === 'workspace') renderActiveDrawer();
    },
    () => {
      app.currentUserName = null;
      if (app.activeDrawer === 'workspace') renderActiveDrawer();
    }
  );

  const params = new URLSearchParams(window.location.search);
  if (params.get('autostart') === '1') {
    setGameLifecycleState('playing');
  } else {
    setGameLifecycleState('title');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  buildDOMGameShell();

  const options = new xb.Options();
  options.setAppTitle('Voxel Realms XR');
  options.setAppDescription(
    'Open-World WebXR MMORPG & Castle Warfare with Four-Path Cultivation, AlphaFold 3D Bioscience, and Gemini AI.'
  );
  options.reticles.enabled = true;

  xb.add(app);
  await xb.init(options);
});
