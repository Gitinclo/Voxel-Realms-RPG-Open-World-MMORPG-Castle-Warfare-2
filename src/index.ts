import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Sky } from 'three/addons/objects/Sky.js';
import * as xb from 'xrblocks';
import {
  CharacterAppearance,
  Clan,
  ClanChatMessage,
  ClanLeaderboardEntry,
  ClanMember,
  GameResources,
  Hero,
  LeaderboardEntry,
  MonsterTarget,
  NPC,
  PlayerTroopRoster,
  ResourceNode,
  ResourceType,
  TroopType,
  WorldAIEventLog,
} from './types/game';
import {
  CultivationPath,
  PlayerCultivationState,
} from './types/cultivation';
import {
  INITIAL_APPEARANCE,
  INITIAL_CLAN,
  INITIAL_CLAN_CHAT,
  INITIAL_CLAN_LEADERBOARD,
  INITIAL_CLAN_MEMBERS,
  INITIAL_HEROES,
  INITIAL_LEADERBOARD,
  INITIAL_MONSTERS,
  INITIAL_NPCS,
  INITIAL_RESOURCE_NODES,
  INITIAL_RESOURCES,
  INITIAL_TROOPS,
} from './game/initialData';
import {
  MAX_CASTLE_LEVEL,
  calculateCastleTroopCapacity,
  calculateMultiplicativePowerRating,
  formatBigInt,
  getCastleEra,
  getCastleUpgradeCost,
  getTroopTierInfo,
} from './game/math';
import {
  CULTIVATION_REALMS,
  CULTIVATION_PATH_LIST,
  INITIAL_DISCIPLES,
  INITIAL_KARMA_STATE,
  calculateMasterDiscipleEconomy,
  calculateQiRequired,
  calculateRealmSuppression,
  tickRedNameStationaryLightning,
  buildDefaultCultivationHistory,
  appendCultivationHistorySnapshot,
} from './game/cultivationMath';
import {
  INITIAL_DAILY_LOGIN_STATE,
  PersistedDailyLoginState,
  claimDailyLoginReward,
  evaluateDailyLoginState,
  getCalendarDateKey,
} from './game/dailyLogin';
import {
  BillingCycle,
  INITIAL_VIP_SUBSCRIPTION_STATE,
  PersistedVipSubscriptionState,
  VIP_TIER_CONFIGS,
  VipTierId,
  activateVipSubscription,
  applyVipDiscountToCosts,
  claimVipDailyStipend,
  evaluateVipSubscription,
} from './game/vipSubscription';
import {
  HeroSkinId,
  applySkinToHero,
} from './game/heroSkins';
import {
  WEATHER_CONFIGS,
  WeatherType,
  calculateWeatherGatherRate,
  getNextWeather,
} from './game/weather';
import {
  TargetPlatform,
  computeAtmosphericSkyParams,
  computeLightingStrategy,
  computeLodChainPolicy,
  computeMasterTextureImportOverride,
  computeSurfaceWetnessParams,
  computeUberShaderKeywords,
  getPostProcessProfile,
} from './game/graphicsEngine';
import {
  GraphicsQualityPreset,
  applyCrossPlatformPipeline,
  createMonsterMesh,
  createNPCMesh,
  createPlayerMesh,
  createResourceNodeMesh,
  createVoxelCastle,
  createVoxelTerrain,
  updateWorldShaderUniforms,
} from './game/proceduralWorld';
import {
  generateRadiantQuestForNPC,
  tickWorldAI,
} from './game/worldAI';
import { calculateOutpostAssault } from './game/clanMath';
import {
  getBioscienceTarget,
} from './game/bioscience';
import {
  createProteinStructureMesh,
} from './game/world3d';
import { sound } from './game/audio';
import { initAuth } from './services/firebaseAndWorkspace';
import { ChatTurnMessage } from './services/geminiClient';
import { renderModalContent } from './modals/originalModals';
import { BioscienceTargetProfile } from './types';
import {
  AdminSupportTicket,
  INITIAL_MODERATED_PLAYERS,
  ModeratedPlayerRecord,
  ModerationAuditEntry,
  SUPER_ADMIN_EMAIL,
  createContactSupportTicket,
  summarizeGlobalSystemUpdate,
} from './game/adminModeration';

type GameLifecycleState = 'title' | 'playing' | 'paused' | 'victory' | 'gameover';

class VoxelRealmsXRApp extends xb.Script {
  public gameState: GameLifecycleState = 'title';
  public playerAppearance: CharacterAppearance = { ...INITIAL_APPEARANCE };
  public castleLevel = 12;
  public resources: GameResources = { ...INITIAL_RESOURCES };
  public troops: PlayerTroopRoster = { ...INITIAL_TROOPS };
  public heroes: Hero[] = INITIAL_HEROES.map((h) => ({ ...h }));
  public selectedHeroId = INITIAL_HEROES[0].id;
  public playerExp = 48_500n;
  public clan: Clan = JSON.parse(
    JSON.stringify(INITIAL_CLAN, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)),
    (_k, v) => (typeof v === 'string' && /^\d+$/.test(v) && v.length > 4 ? BigInt(v) : v)
  );
  public clanMembers: ClanMember[] = [...INITIAL_CLAN_MEMBERS];
  public clanCoins = 3_400n;
  public clanChat: ClanChatMessage[] = [...INITIAL_CLAN_CHAT];
  public clanLeaderboard: ClanLeaderboardEntry[] = [...INITIAL_CLAN_LEADERBOARD];
  public monsters: MonsterTarget[] = INITIAL_MONSTERS.map((m) => ({ ...m }));
  public selectedMonster: MonsterTarget = this.monsters[this.monsters.length - 1];
  public resourceNodes: ResourceNode[] = INITIAL_RESOURCE_NODES.map((n) => ({ ...n }));
  public npcs: NPC[] = INITIAL_NPCS.map((n) => ({ ...n }));
  public leaderboard: LeaderboardEntry[] = [...INITIAL_LEADERBOARD];
  public aiLogs: WorldAIEventLog[] = [
    {
      id: 'ai_init_1',
      timestamp: Date.now() - 15000,
      actorName: 'Captain Thorne',
      actorType: 'npc',
      actorLevel: 220,
      category: 'combat',
      message: '[Citadel Vanguard Guard] Intercepting Forest Goblin Clan (Lv.12) along eastern road.',
    },
    {
      id: 'ai_init_2',
      timestamp: Date.now() - 10000,
      actorName: 'Gorim Forgehammer',
      actorType: 'npc',
      actorLevel: 320,
      category: 'gathering',
      message: '[Master Runic Blacksmith] Prospected Lv.6 Steel Outcrop (+60,800 Steel Ingots added to stash).',
    },
    {
      id: 'ai_init_3',
      timestamp: Date.now() - 5000,
      actorName: 'Celestial Ender Titan [World Boss]',
      actorType: 'monster',
      actorLevel: 1000,
      category: 'environment',
      message: 'Tier V Apex World Titan channeling Nine-Heavens Starfall Barrage [Sovereign Tempest Active].',
    },
  ];

  public cultivation: PlayerCultivationState = {
    currentRealmIndex: 3, // Nascent Soul (元婴境)
    currentLayer: 4,
    currentQi: 420_000n,
    passiveQiPerSec: 1_200n,
    paths: {
      qi: { realmIndex: 3, layer: 4, currentEnergy: 420_000n },
      body: { realmIndex: 2, layer: 6, currentEnergy: 1_850_000n },
      soul: { realmIndex: 3, layer: 2, currentEnergy: 12_500_000n },
      mind: { realmIndex: 3, layer: 5, currentEnergy: 19_000_000n },
    },
    ownedManuals: {
      manual_qi_jade_pure: { manualId: 'manual_qi_jade_pure', level: 2 },
      manual_body_vajra_marrow: { manualId: 'manual_body_vajra_marrow', level: 2 },
      manual_soul_astral_visualization: { manualId: 'manual_soul_astral_visualization', level: 2 },
      manual_mind_longevity_seclusion: { manualId: 'manual_mind_longevity_seclusion', level: 3 },
    },
    equippedManuals: {
      qi: 'manual_qi_jade_pure',
      body: 'manual_body_vajra_marrow',
      soul: 'manual_soul_astral_visualization',
      mind: 'manual_mind_longevity_seclusion',
    },
    scriptureFragments: 65,
    secludedYears: 1240,
    tribulationUnderway: false,
    tribulationStrikesLeft: 0,
    tribulationDamageRating: 0n,
    inventoryPills: {
      pill_qi_condensation: 3,
      pill_foundation: 2,
      pill_core_condense: 1,
      pill_nascent_soul: 2,
    },
    selectedRoot: 'lightning',
    rootPurityPct: 92,
    karma: { ...INITIAL_KARMA_STATE },
    disciples: INITIAL_DISCIPLES.map((d) => ({ ...d })),
    masterTaxRatePct: 20,
    learnedMysticalSkills: ['skill_heaven_earth_sleeve', 'skill_six_paths_seal'],
    skillScrollInventory: [],
    spiritStones: 48_000n,
    masteredGreatDaos: 4,
    auraOverrideRealmIndex: null,
    veteranScrolls: 2,
    growthHistory: buildDefaultCultivationHistory(
      {
        qi: { realmIndex: 3, layer: 4, currentEnergy: 420_000n },
        body: { realmIndex: 2, layer: 6, currentEnergy: 1_850_000n },
        soul: { realmIndex: 3, layer: 2, currentEnergy: 12_500_000n },
        mind: { realmIndex: 3, layer: 5, currentEnergy: 19_000_000n },
      },
      1240
    ),
    chartMode: 'stage_progression',
  };

  public dailyLoginState: PersistedDailyLoginState = { ...INITIAL_DAILY_LOGIN_STATE };
  public vipState: PersistedVipSubscriptionState = { ...INITIAL_VIP_SUBSCRIPTION_STATE };
  public selectedVipCycle: BillingCycle = 'monthly';
  public selectedBarracksType: TroopType = 'shieldbearer';
  public selectedBarracksTier = 5;
  public selectedBarracksBatch = 5000;

  public timeOfDayHours = 11.5;
  public timeSpeedMultiplier = 1;
  public weather: WeatherType = 'clear';
  public weatherRemainingSec = 60;
  public graphicsQuality: GraphicsQualityPreset = 'ultra';
  public targetPlatform: TargetPlatform = 'pc_console';
  public hdPackMounted = false;
  public godmode = false;

  public isInventoryDrawerOpen = false;
  public isEngineSettingsOpen = false;
  public isMoreHubOpen = false;
  public isDockCollapsed = false;
  public activeDrawer: string | null = null;

  public playerPos = new THREE.Vector3(0, 0, 18);
  public cameraOrbitAngle = 0;
  public playerHp = 25000;
  public playerMaxHp = 25000;
  public monstersSlain = 0;
  public hitstopTimer = 0;
  public cameraTrauma = 0;
  public keysPressed = new Set<string>();
  public tribulationAccumSec = 0;
  public aiTickAccumSec = 0;

  public activeProtein: BioscienceTargetProfile = getBioscienceTarget('TP53');
  public currentUserName: string | null = null;
  public currentUserEmail: string | null = SUPER_ADMIN_EMAIL;
  public gmSessionActive = true;
  public systemUpdateVersion = 1;
  public lastSystemUpdateIso = new Date().toISOString();
  public activeServerDecree = `⚡ Sovereign Administration · GM · Admin · Moderator Control & Contact: ${SUPER_ADMIN_EMAIL}`;
  public moderatedPlayers: ModeratedPlayerRecord[] = INITIAL_MODERATED_PLAYERS.map((p) => ({ ...p }));
  public moderationAuditLog: ModerationAuditEntry[] = [
    {
      id: 'mod_audit_init_1',
      timestamp: Date.now() - 180000,
      actorEmail: SUPER_ADMIN_EMAIL,
      targetPlayerId: 'plyr_void_spammer',
      targetLordName: 'Xylar Voidwhisper',
      action: 'mute',
      reason: `[MUTED by ${SUPER_ADMIN_EMAIL}] World chat spam filter triggered.`,
      resultingStatus: 'muted',
    },
    {
      id: 'mod_audit_init_2',
      timestamp: Date.now() - 90000,
      actorEmail: SUPER_ADMIN_EMAIL,
      targetPlayerId: 'plyr_shadow_fiend',
      targetLordName: 'Malakor Bloodbane',
      action: 'warn',
      reason: `[WARN #1 by ${SUPER_ADMIN_EMAIL}] Novice Zone Red-Name PK protection enforcement.`,
      resultingStatus: 'active',
    },
  ];
  public supportTickets: AdminSupportTicket[] = [
    createContactSupportTicket({
      senderName: 'Seraphina Dawnstar',
      senderEmail: 'seraphina@valor.org',
      category: 'gm_assistance',
      subject: 'Alliance Outpost #3 Siege Honor Verification',
      message: `Greetings ${SUPER_ADMIN_EMAIL}, requesting GM verification of our Valor Alliance Outpost #3 capture rewards.`,
      timestamp: Date.now() - 240000,
    }).ticket,
  ];
  public chatHistory: ChatTurnMessage[] = [
    {
      role: 'model',
      text: 'Greetings, Sovereign Lord! Ask me about T1-T20 Castle Warfare counters, the 23 Immortal Realms (100x suppression at Golden Core vs Qi Refinement), or AlphaFold Protein structures.',
    },
  ];
  public liveWs: WebSocket | null = null;

  private worldGroup = new THREE.Group();
  private terrainGroup: THREE.Group | null = null;
  private castleMesh: THREE.Group | null = null;
  private playerMesh: THREE.Group | null = null;
  private resourceGroup = new THREE.Group();
  private monsterGroup = new THREE.Group();
  private npcGroup = new THREE.Group();
  private proteinGroup: THREE.Group | null = null;
  private lightningBoltMesh: THREE.Mesh | null = null;

  private sky: Sky | null = null;
  private skySunVec = new THREE.Vector3();
  private hemiLight: THREE.HemisphereLight | null = null;
  private sunLight: THREE.DirectionalLight | null = null;
  private rimLight: THREE.DirectionalLight | null = null;
  private citadelHeartLight: THREE.PointLight | null = null;
  private sunGroup = new THREE.Group();
  private moonGroup = new THREE.Group();
  private cloudGroup = new THREE.Group();
  private starsMat: THREE.PointsMaterial | null = null;
  private fireflyGeo: THREE.BufferGeometry | null = null;
  private fireflyMat: THREE.PointsMaterial | null = null;
  private rainParticles: THREE.Points | null = null;
  private rainGeo: THREE.BufferGeometry | null = null;
  private snowParticles: THREE.Points | null = null;
  private snowGeo: THREE.BufferGeometry | null = null;
  private lightningLight: THREE.PointLight | null = null;
  private bgColor = new THREE.Color(0x38bdf8);
  private lastPipelineSignature = '';

  private spatialCardsGroup = new THREE.Group();
  private castleSpatialText: xb.UIText | null = null;
  private daoSpatialText: xb.UIText | null = null;
  private bioSpatialText: xb.UIText | null = null;

  public getEffectiveDateKey(): string {
    const offset =
      (this.dailyLoginState.simulatedDayOffset || 0) +
      (this.vipState.simulatedVipDayOffset || 0);
    return getCalendarDateKey(new Date(), offset);
  }

  init() {
    this.clan.vault = { ...INITIAL_CLAN.vault };
    this.setupOriginalAtmosphereAndLighting();
    this.add(this.worldGroup);

    this.terrainGroup = createVoxelTerrain();
    this.worldGroup.add(this.terrainGroup);

    this.rebuildCastleMesh();
    this.rebuildPlayerMesh();

    this.worldGroup.add(this.resourceGroup);
    this.resourceNodes.forEach((node) => {
      this.resourceGroup.add(createResourceNodeMesh(node));
    });

    this.worldGroup.add(this.monsterGroup);
    this.monsters.forEach((m) => {
      this.monsterGroup.add(createMonsterMesh(m));
    });

    this.worldGroup.add(this.npcGroup);
    this.npcs.forEach((n) => {
      this.npcGroup.add(createNPCMesh(n));
    });

    const boltGeo = new THREE.CylinderGeometry(0.18, 0.45, 28, 8);
    const boltMat = new THREE.MeshBasicMaterial({
      color: 0xc084fc,
      transparent: true,
      opacity: 0,
    });
    this.lightningBoltMesh = new THREE.Mesh(boltGeo, boltMat);
    this.lightningBoltMesh.position.set(0, 14, 18);
    this.worldGroup.add(this.lightningBoltMesh);

    this.buildSpatialUICards();
    this.loadProtein('TP53');
    this.setupViewportPointerAndOrbit();
  }

  private isSoftwareGl = false;

  private setupOriginalAtmosphereAndLighting() {
    const renderer = (xb.core as any)?.renderer as THREE.WebGLRenderer | undefined;
    const scene = (xb.core as any)?.scene as THREE.Scene | undefined;

    let isSoftwareGl = /HeadlessChrome/i.test(navigator.userAgent);
    if (renderer) {
      const gl = renderer.getContext();
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      const rendererStr = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '' : '';
      if (/SwiftShader|llvmpipe|softpipe|Software/i.test(String(rendererStr))) {
        isSoftwareGl = true;
      }
      this.isSoftwareGl = isSoftwareGl;

      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.96;
      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = !isSoftwareGl;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      if (scene) {
        scene.background = this.bgColor;
        scene.fog = new THREE.FogExp2(0x87ceeb, 0.011);
      }

      if (!isSoftwareGl) {
        try {
          const pmrem = new THREE.PMREMGenerator(renderer);
          const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
          if (scene) {
            scene.environment = envTex;
          }
          pmrem.dispose();
        } catch {
          // Fallback if PMREM fails
        }
      }
    }

    // Preetham Physical Atmospheric Sky Dome (GTA V / Genshin Impact Atmosphere)
    if (!isSoftwareGl) {
      this.sky = new Sky();
      this.sky.scale.setScalar(420);
      const skyUniforms = this.sky.material.uniforms;
      skyUniforms['turbidity'].value = 2.4;
      skyUniforms['rayleigh'].value = 1.65;
      skyUniforms['mieCoefficient'].value = 0.0045;
      skyUniforms['mieDirectionalG'].value = 0.86;
      this.add(this.sky);
    } else {
      const skyDomeGeo = new THREE.SphereGeometry(180, 16, 12);
      const skyDomeMat = new THREE.MeshBasicMaterial({
        color: this.bgColor,
        side: THREE.BackSide,
        fog: false,
      });
      this.add(new THREE.Mesh(skyDomeGeo, skyDomeMat));
    }

    this.hemiLight = new THREE.HemisphereLight(0x7dd3fc, 0x1e293b, 1.35);
    this.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff8e7, 3.1);
    this.sunLight.position.set(25, 45, 25);
    this.sunLight.castShadow = !isSoftwareGl;
    if (!isSoftwareGl) {
      this.sunLight.shadow.mapSize.set(1024, 1024);
      this.sunLight.shadow.camera.near = 0.5;
      this.sunLight.shadow.camera.far = 145;
      this.sunLight.shadow.camera.left = -46;
      this.sunLight.shadow.camera.right = 46;
      this.sunLight.shadow.camera.top = 46;
      this.sunLight.shadow.camera.bottom = -46;
      this.sunLight.shadow.bias = -0.0005;
    }
    this.add(this.sunLight);

    this.rimLight = new THREE.DirectionalLight(0x38bdf8, 0.85);
    this.rimLight.position.set(-28, 18, -24);
    this.add(this.rimLight);

    this.citadelHeartLight = new THREE.PointLight(0xffb300, 0.55, 28);
    this.citadelHeartLight.position.set(0, 8, 6);
    this.add(this.citadelHeartLight);

    // Sun Visual Sphere + Corona Halos
    const sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(3.2, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xfffbeb })
    );
    const sunCorona = new THREE.Mesh(
      new THREE.SphereGeometry(5.6, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.18, depthWrite: false })
    );
    const sunOuterGlare = new THREE.Mesh(
      new THREE.SphereGeometry(8.8, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.08, depthWrite: false })
    );
    this.sunGroup.add(sunMesh, sunCorona, sunOuterGlare);
    this.add(this.sunGroup);

    // Moon Visual Sphere + Halo
    const moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(2.8, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xe0e7ff })
    );
    const moonHalo = new THREE.Mesh(
      new THREE.SphereGeometry(4.6, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0x818cf8, transparent: true, opacity: 0.28, depthWrite: false })
    );
    this.moonGroup.add(moonMesh, moonHalo);
    this.add(this.moonGroup);

    // Drifting High-Altitude Voxel Cloud Layer
    this.cloudGroup.name = 'VolumetricVoxelClouds';
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.95,
      metalness: 0.0,
      transparent: true,
      opacity: 0.82,
    });
    for (let c = 0; c < 14; c++) {
      const cluster = new THREE.Group();
      const puffs = 3 + (c % 3);
      for (let p = 0; p < puffs; p++) {
        const puff = new THREE.Mesh(
          new THREE.BoxGeometry(5 + (p % 2) * 3, 1.8 + (p % 2) * 0.6, 4.2 + p * 1.2),
          cloudMat
        );
        puff.position.set((p - 1) * 2.6, (p % 2) * 0.5, ((p * 3) % 2) * 1.2);
        cluster.add(puff);
      }
      const angle = (c / 14) * Math.PI * 2;
      const dist = 34 + (c % 4) * 16;
      cluster.position.set(Math.cos(angle) * dist, 32 + (c % 3) * 4, Math.sin(angle) * dist);
      this.cloudGroup.add(cluster);
    }
    this.add(this.cloudGroup);

    // Starfield
    const starsGeo = new THREE.BufferGeometry();
    const starCount = 450;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 230;
      starPositions[i + 1] = Math.random() * 85 + 28;
      starPositions[i + 2] = (Math.random() - 0.5) * 230;
    }
    starsGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    this.starsMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.35,
      transparent: true,
      opacity: 0,
    });
    this.add(new THREE.Points(starsGeo, this.starsMat));

    // Ambient Spirit Qi Motes / Golden Fireflies
    const fireflyCount = 120;
    this.fireflyGeo = new THREE.BufferGeometry();
    const fireflyPositions = new Float32Array(fireflyCount * 3);
    for (let i = 0; i < fireflyCount * 3; i += 3) {
      fireflyPositions[i] = (Math.random() - 0.5) * 70;
      fireflyPositions[i + 1] = 1.0 + Math.random() * 7.5;
      fireflyPositions[i + 2] = (Math.random() - 0.5) * 70;
    }
    this.fireflyGeo.setAttribute('position', new THREE.BufferAttribute(fireflyPositions, 3));
    this.fireflyMat = new THREE.PointsMaterial({
      color: 0xfde047,
      size: 0.18,
      transparent: true,
      opacity: 0.7,
    });
    this.add(new THREE.Points(this.fireflyGeo, this.fireflyMat));

    // Weather Particle Systems (Rain & Snow)
    const rainCount = 900;
    this.rainGeo = new THREE.BufferGeometry();
    const rainPositions = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount * 3; i += 3) {
      rainPositions[i] = (Math.random() - 0.5) * 80;
      rainPositions[i + 1] = Math.random() * 45;
      rainPositions[i + 2] = (Math.random() - 0.5) * 80;
    }
    this.rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    const rainMat = new THREE.PointsMaterial({
      color: 0x93c5fd,
      size: 0.8,
      transparent: true,
      opacity: 0.75,
    });
    this.rainParticles = new THREE.Points(this.rainGeo, rainMat);
    this.rainParticles.visible = false;
    this.add(this.rainParticles);

    const snowCount = 700;
    this.snowGeo = new THREE.BufferGeometry();
    const snowPositions = new Float32Array(snowCount * 3);
    for (let i = 0; i < snowCount * 3; i += 3) {
      snowPositions[i] = (Math.random() - 0.5) * 80;
      snowPositions[i + 1] = Math.random() * 45;
      snowPositions[i + 2] = (Math.random() - 0.5) * 80;
    }
    this.snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));
    const snowMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.2,
      transparent: true,
      opacity: 0.85,
    });
    this.snowParticles = new THREE.Points(this.snowGeo, snowMat);
    this.snowParticles.visible = false;
    this.add(this.snowParticles);

    this.lightningLight = new THREE.PointLight(0xa5f3fc, 0, 150);
    this.lightningLight.position.set(0, 35, 0);
    this.add(this.lightningLight);
  }

  private setupViewportPointerAndOrbit() {
    let isDragging = false;
    let prevMouseX = 0;

    window.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'CANVAS') {
        isDragging = true;
        prevMouseX = e.clientX;
      }
    });
    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - prevMouseX;
      prevMouseX = e.clientX;
      this.cameraOrbitAngle -= dx * 0.006;
    });
    window.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }

  public rebuildCastleMesh() {
    if (this.castleMesh) {
      this.worldGroup.remove(this.castleMesh);
    }
    this.castleMesh = createVoxelCastle(this.castleLevel);
    this.castleMesh.position.set(0, 0, 0);
    this.worldGroup.add(this.castleMesh);
    this.refreshSpatialCards();
  }

  public rebuildPlayerMesh() {
    const prevRotY = this.playerMesh ? this.playerMesh.rotation.y : 0;
    if (this.playerMesh) {
      this.worldGroup.remove(this.playerMesh);
    }
    const highestRealm = this.getHighestRealmIndex();
    this.playerMesh = createPlayerMesh(
      this.playerAppearance,
      highestRealm,
      this.cultivation.masteredGreatDaos,
      this.cultivation.karma.alignment === 'red_fiend'
    );
    this.playerMesh.position.copy(this.playerPos);
    this.playerMesh.rotation.y = prevRotY;
    this.worldGroup.add(this.playerMesh);
    this.refreshSpatialCards();
  }

  public loadProtein(symbolOrAccession: string) {
    this.activeProtein = getBioscienceTarget(symbolOrAccession);
    if (this.proteinGroup) {
      this.worldGroup.remove(this.proteinGroup);
    }
    this.proteinGroup = createProteinStructureMesh(this.activeProtein.residues);
    this.proteinGroup.position.set(10.5, 3.8, 12.5);
    this.worldGroup.add(this.proteinGroup);
    this.refreshSpatialCards();
    if (this.activeDrawer === 'bioscience') {
      renderActiveDrawer();
    }
  }

  public getTotalPower(): bigint {
    if (this.godmode) {
      return 999_999_999_999_999n;
    }
    const basePower = calculateMultiplicativePowerRating({
      troops: this.troops,
      castleLevel: this.castleLevel,
      highestHeroRarityMultiplier: 5,
      researchLevel: Math.max(1, Math.floor(this.castleLevel / 2)),
    });
    return basePower;
  }

  public getHighestRealmIndex(): number {
    return Math.max(
      this.cultivation.paths.qi.realmIndex,
      this.cultivation.paths.body.realmIndex,
      this.cultivation.paths.soul.realmIndex,
      this.cultivation.paths.mind.realmIndex
    );
  }

  private buildSpatialUICards() {
    this.castleSpatialText = new xb.UIText({
      text: 'Citadel Lv 12 | Sovereign Keep',
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
              label: 'Train +5K T5',
              icon: 'groups',
              style: { flexGrow: 1 },
              onClick: () => this.trainTroops(5, 'shieldbearer', 5000n),
            }),
          ],
        }),
      ],
    });
    castleCard.position.set(-12, 5.2, 8.5);
    castleCard.add(new xb.FaceCamera({ mode: 'spherical', smoothing: 0.15 }));
    this.spatialCardsGroup.add(castleCard);

    this.daoSpatialText = new xb.UIText({
      text: 'Nascent Soul L4 | 100x Realm Suppression Active',
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
    daoCard.position.set(0, 8.5, -6.5);
    daoCard.add(new xb.FaceCamera({ mode: 'spherical', smoothing: 0.15 }));
    this.spatialCardsGroup.add(daoCard);

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
    bioCard.position.set(12.5, 5.4, 8.5);
    bioCard.add(new xb.FaceCamera({ mode: 'spherical', smoothing: 0.15 }));
    this.spatialCardsGroup.add(bioCard);

    // Only show floating 3D spatial cards when in immersive XR session so desktop vista stays clean like the Original App
    this.spatialCardsGroup.visible = false;
    this.add(this.spatialCardsGroup);
    this.refreshSpatialCards();
  }

  public refreshSpatialCards() {
    if (this.castleSpatialText) {
      const era = getCastleEra(this.castleLevel);
      const cap = calculateCastleTroopCapacity(this.castleLevel);
      this.castleSpatialText.text = `Keep Lv ${this.castleLevel} (${era.name})\nCap: ${formatBigInt(cap)} | Might: ${formatBigInt(this.getTotalPower())}`;
    }
    if (this.daoSpatialText) {
      const qi = this.cultivation.paths.qi;
      const realmName = CULTIVATION_REALMS[qi.realmIndex]?.name || 'Nascent Soul';
      this.daoSpatialText.text = `Qi Path: ${realmName} (Layer ${qi.layer}/9)\nKarma: ${this.cultivation.karma.karmaValue} (${this.cultivation.karma.alignment})`;
    }
    if (this.bioSpatialText && this.activeProtein) {
      const p = this.activeProtein;
      this.bioSpatialText.text = `${p.symbol} (${p.uniprotId} / ${p.pdbId})\nMean pLDDT: ${p.meanPlddt} ${p.provenance}`;
    }
  }

  public upgradeCastle() {
    if (this.castleLevel >= MAX_CASTLE_LEVEL) {
      showToast('🏰 Citadel has reached Maximum Immortal Sovereign Level 100!');
      return;
    }
    const vipEval = evaluateVipSubscription(this.vipState, this.getEffectiveDateKey());
    const baseCost = getCastleUpgradeCost(this.castleLevel);
    const cost = applyVipDiscountToCosts(
      baseCost,
      vipEval.tierConfig.perks.castleUpgradeDiscountPct
    );

    (['wood', 'steel', 'copper', 'grain', 'oil', 'diamond'] as ResourceType[]).forEach((k) => {
      this.resources[k] = this.resources[k] > cost[k] ? this.resources[k] - cost[k] : this.resources[k];
    });

    this.castleLevel = Math.min(MAX_CASTLE_LEVEL, this.castleLevel + 1);
    const era = getCastleEra(this.castleLevel);

    sound.playUpgradeFanfare();
    this.rebuildCastleMesh();
    updateHUD();
    if (this.activeDrawer === 'castle') renderActiveDrawer();
    showToast(`🏰 Imperial Citadel upgraded to Level ${this.castleLevel} (${era.name})!`);
  }

  public trainTroops(tier: number, type: TroopType, count: bigint) {
    const key = `${type}_t${tier}`;
    this.troops[key] = (this.troops[key] || 0n) + count;
    const info = getTroopTierInfo(type, tier);

    sound.playGather();
    this.refreshSpatialCards();
    updateHUD();
    if (this.activeDrawer === 'troops' || this.activeDrawer === 'castle') renderActiveDrawer();
    showToast(`⚔️ Enlisted +${formatBigInt(count)} ${info.name} into your grand army!`);
  }

  public cultivatePath(path: CultivationPath) {
    const st = this.cultivation.paths[path];
    const req = calculateQiRequired(st.realmIndex, st.layer, path);
    st.currentEnergy += req / 2n;
    this.cultivation.currentQi = this.cultivation.paths.qi.currentEnergy;
    this.cultivation.secludedYears += 15;
    const baseHistory =
      this.cultivation.growthHistory && this.cultivation.growthHistory.length > 0
        ? this.cultivation.growthHistory
        : buildDefaultCultivationHistory(this.cultivation.paths, this.cultivation.secludedYears);
    this.cultivation.growthHistory = appendCultivationHistorySnapshot(baseHistory, {
      paths: this.cultivation.paths,
      secludedYears: this.cultivation.secludedYears,
      eventLabel: `Refined ${path.toUpperCase()} (+50% Energy)`,
    });
    sound.playGather();
    updateHUD();
    this.refreshSpatialCards();
    if (this.activeDrawer === 'cultivation') renderActiveDrawer();
    showToast(`✨ Refined ${path.toUpperCase()} Dao essence (+50% Layer Energy · Year ${this.cultivation.secludedYears}).`);
  }

  public breakthroughPath(path: CultivationPath) {
    const st = this.cultivation.paths[path];
    st.currentEnergy = 0n;
    let eventLabel = `${path.toUpperCase()} Breakthrough`;
    if (st.layer < 9) {
      st.layer += 1;
      eventLabel = `${path.toUpperCase()} Advanced to L${st.layer}`;
      sound.playUpgradeFanfare();
      showToast(`⚡ ${path.toUpperCase()} Path advanced to Layer ${st.layer}!`);
    } else if (st.realmIndex < CULTIVATION_REALMS.length - 1) {
      st.realmIndex += 1;
      st.layer = 1;
      eventLabel = `${path.toUpperCase()} Ascended: ${CULTIVATION_REALMS[st.realmIndex].name}`;
      this.playerMaxHp += 5000 * (st.realmIndex + 1);
      this.playerHp = this.playerMaxHp;
      sound.playThunder();
      this.cultivation.currentRealmIndex = this.getHighestRealmIndex();
      this.rebuildPlayerMesh();
      showToast(`🌩️ HEAVENLY BREAKTHROUGH! Reached ${CULTIVATION_REALMS[st.realmIndex].name}!`);
    }
    this.cultivation.currentRealmIndex = this.getHighestRealmIndex();
    this.cultivation.currentLayer = this.cultivation.paths.qi.layer;
    this.cultivation.secludedYears += 45;

    const baseHistory =
      this.cultivation.growthHistory && this.cultivation.growthHistory.length > 0
        ? this.cultivation.growthHistory
        : buildDefaultCultivationHistory(this.cultivation.paths, this.cultivation.secludedYears);
    this.cultivation.growthHistory = appendCultivationHistorySnapshot(baseHistory, {
      paths: this.cultivation.paths,
      secludedYears: this.cultivation.secludedYears,
      eventLabel,
    });

    updateHUD();
    this.refreshSpatialCards();
    if (this.activeDrawer === 'cultivation') renderActiveDrawer();
  }

  public meditateSecludedYears(years: number = 50) {
    for (const p of CULTIVATION_PATH_LIST) {
      const st = this.cultivation.paths[p];
      const req = calculateQiRequired(st.realmIndex, st.layer, p);
      st.currentEnergy += (req * 45n) / 100n;
      if (st.currentEnergy >= req) {
        st.currentEnergy = 0n;
        if (st.layer < 9) {
          st.layer += 1;
        } else if (st.realmIndex < CULTIVATION_REALMS.length - 1) {
          st.realmIndex += 1;
          st.layer = 1;
        }
      }
    }
    this.cultivation.currentRealmIndex = this.getHighestRealmIndex();
    this.cultivation.currentLayer = this.cultivation.paths.qi.layer;
    this.cultivation.currentQi = this.cultivation.paths.qi.currentEnergy;
    this.cultivation.secludedYears += years;

    const baseHistory =
      this.cultivation.growthHistory && this.cultivation.growthHistory.length > 0
        ? this.cultivation.growthHistory
        : buildDefaultCultivationHistory(this.cultivation.paths, this.cultivation.secludedYears);
    this.cultivation.growthHistory = appendCultivationHistorySnapshot(baseHistory, {
      paths: this.cultivation.paths,
      secludedYears: this.cultivation.secludedYears,
      eventLabel: `+${years}y Secluded Meditation`,
    });

    sound.playUpgradeFanfare();
    this.rebuildPlayerMesh();
    updateHUD();
    this.refreshSpatialCards();
    if (this.activeDrawer === 'cultivation') renderActiveDrawer();
    showToast(`🧘 Meditated in seclusion for +${years} Realm Years (Year ${this.cultivation.secludedYears})!`);
  }

  public levelUpHero(heroId: string) {
    const h = this.heroes.find((x) => x.id === heroId);
    if (!h) return;
    h.level += 1;
    h.power += 15_000n;
    h.statBonus.attackBonusPct += 5;
    h.statBonus.defenseBonusPct += 5;
    sound.playLevelUp();
    updateHUD();
    if (this.activeDrawer === 'hero') renderActiveDrawer();
    showToast(`🎖️ ${h.name} ascended to Level ${h.level} (+${h.statBonus.attackBonusPct}% ATK Bonus)!`);
  }

  public selectHeroSkin(heroId: string, skinId: HeroSkinId) {
    this.heroes = this.heroes.map((h) => (h.id === heroId ? applySkinToHero(h, skinId) : h));
    sound.playUpgradeFanfare();
    updateHUD();
    if (this.activeDrawer === 'hero') renderActiveDrawer();
    const updated = this.heroes.find((h) => h.id === heroId);
    const skinCfg = updated ? resolveHeroActiveSkin(updated) : null;
    showToast(`✨ Equipped Mythic Skin [${skinCfg?.name || skinId}] on ${updated?.name}!`);
  }

  public donateToClan(type: ResourceType, amount: bigint, honor: bigint) {
    if (this.resources[type] > amount) {
      this.resources[type] -= amount;
    }
    this.clanCoins += honor;
    this.clan.vault[type] = (this.clan.vault[type] || 0n) + amount;
    this.clan.vault.clanHonor += honor;
    this.clan.totalPower += honor * 100n;
    sound.playGather();
    updateHUD();
    if (this.activeDrawer === 'clan') renderActiveDrawer();
    showToast(`🎁 Donated ${formatBigInt(amount)} ${type} to Alliance Vault (+${formatBigInt(honor)} Honor)!`);
  }

  public assaultClanOutpost(outpostId: string) {
    if (!this.clan.activeWar) return;
    const outpost = this.clan.activeWar.outposts.find((o) => o.id === outpostId);
    if (!outpost) return;
    const result = calculateOutpostAssault(this.getTotalPower(), outpost.defenseRating);
    outpost.controlledBy = 'player_clan';
    outpost.garrisonTroops += 50_000n;
    this.clan.activeWar.playerClanScore += result.pointsEarned;
    sound.playExplosion();
    updateHUD();
    if (this.activeDrawer === 'clan') renderActiveDrawer();
    showToast(`⚔️ Captured ${outpost.name}! Earned +${result.pointsEarned} War Score!`);
  }

  public updateAllRealmSystems() {
    const summary = summarizeGlobalSystemUpdate({
      previousUpdateVersion: this.systemUpdateVersion,
      currentCastleLevel: this.castleLevel,
      currentRealmIndex: this.getHighestRealmIndex(),
    });
    this.systemUpdateVersion = summary.newUpdateVersion;
    this.lastSystemUpdateIso = summary.timestampIso;
    this.castleLevel = summary.updatedCastleLevel;

    // 1. Grant +5,000,000n to all 6 Imperial resources
    (['wood', 'steel', 'copper', 'grain', 'oil', 'diamond'] as ResourceType[]).forEach((k) => {
      this.resources[k] = (this.resources[k] || 0n) + 5_000_000n;
    });

    // 2. Enlist +250,000n T20 Immortal Legions across all 3 arms
    this.troops.shieldbearer_t20 = (this.troops.shieldbearer_t20 || 0n) + 250_000n;
    this.troops.shooter_t20 = (this.troops.shooter_t20 || 0n) + 250_000n;
    this.troops.bomber_t20 = (this.troops.bomber_t20 || 0n) + 250_000n;

    // 3. Advance all 4 Cultivation Paths & record D3.js Growth Chronicle snapshot
    this.cultivation.secludedYears += 50;
    this.cultivation.spiritStones = (this.cultivation.spiritStones || 0n) + 250_000n;
    this.cultivation.scriptureFragments += 100;
    for (const p of CULTIVATION_PATH_LIST) {
      const st = this.cultivation.paths[p];
      if (st.realmIndex < CULTIVATION_REALMS.length - 1) {
        st.realmIndex = Math.min(CULTIVATION_REALMS.length - 1, st.realmIndex + 1);
      } else {
        st.layer = Math.min(9, st.layer + 1);
      }
      st.currentQi = calculateQiRequired(st.realmIndex, st.layer);
      st.ComprehensionPct = Math.min(100, st.ComprehensionPct + 15);
    }
    const baseHistory =
      this.cultivation.growthHistory && this.cultivation.growthHistory.length >= 2
        ? this.cultivation.growthHistory
        : buildDefaultCultivationHistory(this.cultivation.paths, Math.max(50, this.cultivation.secludedYears - 50));
    this.cultivation.growthHistory = appendCultivationHistorySnapshot(baseHistory, {
      paths: this.cultivation.paths,
      secludedYears: this.cultivation.secludedYears,
      eventLabel: `System Update v${summary.newUpdateVersion}.0`,
    });

    // 4. Upgrade all Heroes (+2 Levels, +50k Power, +6% ATK/DEF)
    this.heroes.forEach((h) => {
      h.level += 2;
      h.power += 50_000n;
      h.statBonus.attackBonusPct += 6;
      h.statBonus.defenseBonusPct += 6;
    });

    // 5. Upgrade Clan Alliance Tech & Vault
    this.clan.level += 1;
    this.clan.techLevel.marchSpeed += 1;
    this.clan.techLevel.troopAttack += 1;
    this.clan.techLevel.castleDefense += 1;
    this.clan.techLevel.resourceYield += 1;
    this.clan.totalPower += 500_000_000n;
    this.clan.vault.clanHonor += 250_000n;
    this.clan.leader = this.playerAppearance.lordName;
    if (this.clanMembers.length > 0) {
      this.clanMembers[0].name = this.playerAppearance.lordName;
    }

    // 6. Step World AI & Broadcast Global Update Audit Log
    this.stepWorldAI();
    this.activeServerDecree = `${summary.summaryBanner} · Authorized by ${SUPER_ADMIN_EMAIL}`;
    this.moderationAuditLog.unshift({
      id: `mod_audit_sys_update_${Date.now()}`,
      timestamp: Date.now(),
      actorEmail: SUPER_ADMIN_EMAIL,
      targetPlayerId: 'GLOBAL_REALM_SYSTEMS',
      targetLordName: 'All Realm Subsystems',
      action: 'broadcast_decree',
      reason: `[SYSTEM UPDATE v${summary.newUpdateVersion}.0 by ${SUPER_ADMIN_EMAIL}] ${summary.summaryBanner}`,
      resultingStatus: 'active',
    });

    sound.playUpgradeFanfare();
    this.rebuildCastleMesh();
    this.rebuildPlayerMesh();
    this.refreshSpatialCards();
    updateHUD();
    if (this.activeDrawer) renderActiveDrawer();
    showToast(summary.summaryBanner);
  }

  public claimDailyLogin() {
    const result = claimDailyLoginReward({
      currentState: this.dailyLoginState,
      effectiveDateKey: this.getEffectiveDateKey(),
      castleLevel: this.castleLevel,
      cultivationRealmIndex: this.getHighestRealmIndex(),
    });
    if (!result.claimed || !result.reward) return;
    const r = result.reward;
    this.dailyLoginState = result.updatedState;
    (['wood', 'steel', 'copper', 'grain', 'oil', 'diamond'] as ResourceType[]).forEach((k) => {
      this.resources[k] += r.resources[k];
    });
    this.cultivation.veteranScrolls = (this.cultivation.veteranScrolls || 0) + r.veteranScrolls;
    this.cultivation.scriptureFragments += r.scriptureFragments;
    this.cultivation.spiritStones = (this.cultivation.spiritStones || 0n) + r.spiritStones;
    sound.playUpgradeFanfare();
    updateHUD();
    if (this.activeDrawer === 'daily_login') renderActiveDrawer();
    showToast(`🎁 Claimed Day ${r.day} Login Decree: +${formatBigInt(r.resources.diamond)} 💎 & +${r.veteranScrolls}x Veteran Scroll!`);
  }

  public activateVip(tierId: VipTierId, cycle: BillingCycle, method: 'store_pass' | 'diamonds') {
    const cfg = VIP_TIER_CONFIGS[tierId];
    const diaCost = cycle === 'annual' ? cfg.annualDiamondCost : cfg.monthlyDiamondCost;
    if (method === 'diamonds' && this.resources.diamond < diaCost) {
      showToast('⚠️ Insufficient Diamonds in treasury for this VIP tier.');
      return;
    }
    const act = activateVipSubscription(this.vipState, tierId, cycle, this.getEffectiveDateKey());
    this.vipState = act.nextState;
    if (method === 'diamonds') {
      this.resources.diamond -= diaCost;
    }
    this.resources.diamond += act.instantBonusDiamonds;
    this.cultivation.veteranScrolls =
      (this.cultivation.veteranScrolls || 0) + cfg.dailyStipend.veteranScrolls;
    sound.playUpgradeFanfare();
    updateHUD();
    if (this.activeDrawer === 'vip_subscription') renderActiveDrawer();
    showToast(`👑 Activated ${cfg.badgeLabel} (${cfg.name})! Instant Bonus: +${formatBigInt(act.instantBonusDiamonds)} 💎!`);
  }

  public claimVipStipend() {
    const res = claimVipDailyStipend(this.vipState, this.getEffectiveDateKey());
    if (!res.claimed || !res.stipend) return;
    this.vipState = res.nextState;
    this.resources.diamond += res.stipend.diamonds;
    this.resources.wood += res.stipend.resources.wood;
    this.resources.steel += res.stipend.resources.steel;
    this.resources.copper += res.stipend.resources.copper;
    this.resources.grain += res.stipend.resources.grain;
    this.resources.oil += res.stipend.resources.oil;
    this.cultivation.spiritStones = (this.cultivation.spiritStones || 0n) + res.stipend.spiritStones;
    this.cultivation.veteranScrolls = (this.cultivation.veteranScrolls || 0) + res.stipend.veteranScrolls;
    sound.playUpgradeFanfare();
    updateHUD();
    if (this.activeDrawer === 'vip_subscription') renderActiveDrawer();
    showToast(`🎁 Claimed Daily VIP Stipend: +${formatBigInt(res.stipend.diamonds)} 💎 & +${res.stipend.veteranScrolls}x Scroll!`);
  }

  public setWeather(w: WeatherType) {
    this.weather = w;
    this.weatherRemainingSec = 60;
    sound.playWeatherChange();
    if (w === 'storm') sound.playThunder();
    updateHUD();
    const conf = WEATHER_CONFIGS[w];
    showToast(`${conf.icon} Weather ritual invoked: ${conf.name}! ${conf.combatFlavorText}`);
  }

  public stepWorldAI() {
    const res = tickWorldAI({
      npcs: this.npcs,
      monsters: this.monsters,
      resourceNodes: this.resourceNodes,
      playerPos: { x: this.playerPos.x, z: this.playerPos.z },
      weather: this.weather,
      timeOfDayHours: this.timeOfDayHours,
    });
    this.npcs = res.updatedNpcs;
    this.monsters = res.updatedMonsters;
    if (res.newLogs.length > 0) {
      this.aiLogs = [...res.newLogs, ...this.aiLogs].slice(0, 40);
    }
  }

  public spawnMonster(newMonster: MonsterTarget) {
    this.monsters.push(newMonster);
    this.selectedMonster = newMonster;
    this.monsterGroup.add(createMonsterMesh(newMonster));
    this.aiLogs.unshift({
      id: `ai_spawn_${Date.now()}`,
      timestamp: Date.now(),
      actorName: newMonster.name,
      actorType: 'monster',
      actorLevel: newMonster.level,
      category: 'combat',
      message: `Spawned Lv.${newMonster.level} ${newMonster.tier.toUpperCase()} [${newMonster.movementPolicy}] at [${newMonster.x}, ${newMonster.z}].`,
    });
    sound.playThunder();
    showToast(`🐉 Spawned Level ${newMonster.level} ${newMonster.name} into the Open World!`);
  }

  public claimNPCStash(npcId: string) {
    const targetNpc = this.npcs.find((n) => n.id === npcId);
    if (!targetNpc) return;
    const stash = targetNpc.gatheredStash || {};
    let totalAdded = 0n;
    Object.entries(stash).forEach(([k, v]) => {
      if (v && v > 0n) {
        this.resources[k as ResourceType] += v;
        totalAdded += v;
      }
    });
    if (totalAdded === 0n) {
      this.resources.wood += 25_000n;
      this.resources.steel += 25_000n;
    }
    targetNpc.gatheredStash = {};
    sound.playGather();
    updateHUD();
    if (this.activeDrawer === 'world_ai') renderActiveDrawer();
    showToast(`⛏️ Collected ${targetNpc.name}'s autonomous gathered stash into your Treasury!`);
  }

  public claimNPCQuest(npcId: string) {
    const targetNpc = this.npcs.find((n) => n.id === npcId);
    if (!targetNpc || !targetNpc.activeQuest) return;
    const q = targetNpc.activeQuest;
    this.playerExp += q.rewardExp;
    this.resources.diamond += q.rewardDiamonds;
    Object.entries(q.rewardResources).forEach(([k, v]) => {
      if (v) this.resources[k as ResourceType] += v;
    });
    targetNpc.activeQuest = generateRadiantQuestForNPC(targetNpc, this.castleLevel);
    sound.playUpgradeFanfare();
    updateHUD();
    if (this.activeDrawer === 'world_ai') renderActiveDrawer();
    showToast(`📜 Completed "${q.title}"! Gained +${formatBigInt(q.rewardExp)} EXP & +${formatBigInt(q.rewardDiamonds)} 💎!`);
  }

  public performStrikeOrHarvest() {
    if (this.gameState !== 'playing') return;
    sound.playSwing();

    for (const node of this.resourceNodes) {
      const dist = Math.hypot(node.x - this.playerPos.x, node.z - this.playerPos.z);
      if (dist <= 6.5) {
        const harvest = calculateWeatherGatherRate(node.gatherRatePerSec * 5n, node.type, this.weather);
        this.resources[node.type] += harvest;
        sound.playGather();
        showToast(`🌾 Harvested +${formatBigInt(harvest)} ${node.type.toUpperCase()} from ${node.name}!`);
        updateHUD();
        return;
      }
    }

    let targetMonster: MonsterTarget | null = null;
    let bestDist = 14.0;
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
      const dmg = BigInt(Math.max(2500, Math.floor(8500 * suppression.damageMultiplier)));

      targetMonster.hp = targetMonster.hp > dmg ? targetMonster.hp - dmg : 0n;
      this.hitstopTimer = 0.05;
      this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.35);

      if (targetMonster.hp <= 0n) {
        sound.playExplosion();
        this.monstersSlain += 1;
        const rewardDia = targetMonster.diamondReward || 5000n;
        this.resources.diamond += rewardDia;
        this.resources.wood += rewardDia * 2n;
        this.playerExp += targetMonster.expReward;
        targetMonster.hp = targetMonster.maxHp;
        showToast(`🏆 Slain ${targetMonster.name}! +${formatBigInt(rewardDia)} 💎 & +${formatBigInt(targetMonster.expReward)} EXP!`);
      } else {
        showToast(`⚔️ Struck ${targetMonster.name} for ${formatBigInt(dmg)} DMG (${suppression.suppressionLabel})!`);
      }
      updateHUD();
    } else {
      showToast('⚔️ Sovereign Sword Qi swept across the valley!');
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

    if (!this.godmode) {
      this.playerHp = Math.max(100, Math.floor(this.playerHp * 0.25));
    }
    showToast(
      this.cultivation.karma.lastLightningStrikeMsg ||
        '⚡ HEAVENLY TRIBULATION LIGHTNING! Stationary Red-Name Fiend struck!'
    );
    updateHUD();
  }

  update() {
    const now = performance.now();
    const dt = Math.min(0.05, xb.getDeltaTime?.() || 0.016);
    const scene = (xb.core as any)?.scene as THREE.Scene | undefined;
    const renderer = (xb.core as any)?.renderer as THREE.WebGLRenderer | undefined;
    const isPresenting = Boolean(renderer?.xr?.isPresenting);

    this.spatialCardsGroup.visible = isPresenting;
    if (this.proteinGroup) {
      this.proteinGroup.visible = isPresenting || this.activeDrawer === 'bioscience';
    }

    // Hide XRBlocks default simulator forest skybox & indoor room meshes in desktop open-world mode
    if (scene && !isPresenting) {
      scene.background = this.bgColor;
      scene.children.forEach((child) => {
        if (
          child !== (this as unknown as THREE.Object3D) &&
          !(child as THREE.Camera).isCamera
        ) {
          child.visible = false;
        }
      });
    }

    // Advance time of day & weather cycle
    this.timeOfDayHours = (this.timeOfDayHours + dt * 0.06 * this.timeSpeedMultiplier) % 24;

    // Cross-Platform Pipeline sync
    if (scene) {
      const pipelineSig = `${this.targetPlatform}_${this.graphicsQuality}_${this.hdPackMounted}`;
      if (pipelineSig !== this.lastPipelineSignature) {
        this.lastPipelineSignature = pipelineSig;
        const texOverride = computeMasterTextureImportOverride(
          this.targetPlatform,
          this.graphicsQuality,
          this.hdPackMounted
        );
        const lodPolicy = computeLodChainPolicy(
          this.targetPlatform,
          this.graphicsQuality,
          this.hdPackMounted
        );
        const lightingStrategy = computeLightingStrategy(this.targetPlatform, this.graphicsQuality);
        const uberKeywords = computeUberShaderKeywords(
          this.targetPlatform,
          this.graphicsQuality,
          this.hdPackMounted
        );

        applyCrossPlatformPipeline(scene, {
          anisotropySamples: texOverride.anisotropySamples,
          compressionFormat: texOverride.compressionFormat,
          lodBias: lodPolicy.lodBias,
          skipLod0InMemory: lodPolicy.skipLod0InMemory,
          smallPropCastShadows: lightingStrategy.smallPropCastShadows,
          bakedLightmapIntensity: lightingStrategy.bakedLightmapIntensity,
          useRimLight: uberKeywords.USE_RIM_LIGHT,
          useDetailNormals: uberKeywords.USE_DETAIL_NORMALS,
          useParallax: uberKeywords.USE_PARALLAX_OCCLUSION,
          useSubsurface: uberKeywords.USE_SUBSURFACE_SCATTERING,
        });
      }
    }

    // Update GLSL foliage wind, Gerstner water waves & wet-surface PBR reflections
    const postProfile = getPostProcessProfile(this.graphicsQuality);
    const wetness = computeSurfaceWetnessParams(this.weather);
    updateWorldShaderUniforms(
      now * 0.001,
      wetness.roadRoughness,
      wetness.roadClearcoat,
      wetness.stoneRoughness,
      wetness.stoneClearcoat,
      wetness.waterWaveHeight,
      wetness.windSwayStrength,
      postProfile.rimLightShaderStrength
    );

    // Physical Atmospheric Sky Scattering & Lighting
    const hour = this.timeOfDayHours % 24;
    const skyParams = computeAtmosphericSkyParams(hour, this.weather, this.graphicsQuality);
    const sunAngle = ((hour - 6) / 24) * Math.PI * 2;
    const sunRadius = 60;
    const sunX = Math.cos(sunAngle) * sunRadius;
    const sunY = Math.sin(sunAngle) * sunRadius;
    const sunZ = Math.sin(sunAngle * 0.5) * 20;

    if (this.sunLight) {
      this.sunLight.position.set(sunX, Math.max(sunY, -10), sunZ);
      this.sunLight.intensity = skyParams.sunLightIntensity;
      this.sunLight.color.setHex(skyParams.sunLightHex);
    }
    this.sunGroup.position.set(sunX, sunY, sunZ);
    this.moonGroup.position.set(-sunX, -sunY, -sunZ);

    if (this.sky) {
      const skyUniforms = this.sky.material.uniforms;
      skyUniforms['turbidity'].value = skyParams.turbidity;
      skyUniforms['rayleigh'].value = skyParams.rayleigh;
      skyUniforms['mieCoefficient'].value = skyParams.mieCoefficient;
      skyUniforms['mieDirectionalG'].value = skyParams.mieDirectionalG;
      this.skySunVec.set(sunX, sunY, sunZ).normalize();
      skyUniforms['sunPosition'].value.copy(this.skySunVec);
      this.sky.visible = sunY >= -6;
    }

    if (renderer) {
      renderer.toneMappingExposure = skyParams.exposure;
    }
    if (this.hemiLight) {
      this.hemiLight.color.setHex(skyParams.hemiSkyHex);
      this.hemiLight.groundColor.setHex(skyParams.hemiGroundHex);
      this.hemiLight.intensity = skyParams.hemiIntensity;
    }
    if (this.rimLight) {
      this.rimLight.color.setHex(skyParams.rimLightHex);
      this.rimLight.intensity = skyParams.rimLightIntensity;
    }
    if (this.citadelHeartLight) {
      this.citadelHeartLight.intensity = sunY < 0 ? 1.15 : 0.35;
    }
    if (this.starsMat) {
      this.starsMat.opacity = skyParams.starfieldOpacity;
    }
    if (this.fireflyMat) {
      this.fireflyMat.opacity = sunY < 0 ? 0.88 : 0.45;
    }

    const weatherCfg = WEATHER_CONFIGS[this.weather] || WEATHER_CONFIGS.clear;
    this.bgColor.setHex(sunY < 0 ? 0x090d16 : weatherCfg.skyColorHex);
    if (scene?.fog) {
      scene.fog.color.setHex(skyParams.fogHex);
      (scene.fog as THREE.FogExp2).density = skyParams.fogDensity;
    }

    // Animate Clouds, Fireflies, Water & Waypoints
    this.cloudGroup.rotation.y += dt * 0.012;
    if (this.fireflyGeo && !this.isSoftwareGl) {
      const ffArr = this.fireflyGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < ffArr.length; i += 3) {
        ffArr[i + 1] += Math.sin(now * 0.002 + i) * 0.008;
        ffArr[i] += Math.cos(now * 0.0015 + i) * 0.006;
      }
      this.fireflyGeo.attributes.position.needsUpdate = true;
    }
    if (this.terrainGroup) {
      const waterPlane = this.terrainGroup.getObjectByName('VoxelWaterPlane') as THREE.Mesh | undefined;
      if (waterPlane) {
        waterPlane.position.y = -2.05 + Math.sin(now * 0.002) * 0.06;
      }
      for (let wIdx = 0; wIdx < 4; wIdx++) {
        const wpCrystal = this.terrainGroup.getObjectByName(`WaypointCrystal_${wIdx}`);
        if (wpCrystal) {
          wpCrystal.rotation.y += dt * 1.6;
          wpCrystal.position.y = 3.15 + Math.sin(now * 0.003 + wIdx) * 0.16;
        }
      }
    }

    // Weather Particles
    const isRaining = this.weather === 'rain' || this.weather === 'storm';
    const isSnowing = this.weather === 'snow';
    if (this.rainParticles && this.rainGeo) {
      this.rainParticles.visible = isRaining;
      if (isRaining) {
        const arr = this.rainGeo.attributes.position.array as Float32Array;
        const speed = this.weather === 'storm' ? 36 : 24;
        for (let i = 0; i < arr.length; i += 3) {
          arr[i + 1] -= speed * dt;
          if (arr[i + 1] < 0) arr[i + 1] = 42;
        }
        this.rainGeo.attributes.position.needsUpdate = true;
      }
    }
    if (this.snowParticles && this.snowGeo) {
      this.snowParticles.visible = isSnowing;
      if (isSnowing) {
        const arr = this.snowGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < arr.length; i += 3) {
          arr[i + 1] -= 6.5 * dt;
          arr[i] += Math.sin(now * 0.002 + i) * 0.02;
          if (arr[i + 1] < 0) arr[i + 1] = 42;
        }
        this.snowGeo.attributes.position.needsUpdate = true;
      }
    }
    if (this.lightningLight) {
      if (this.weather === 'storm' && Math.random() < 0.015) {
        this.lightningLight.intensity = 18;
      } else {
        this.lightningLight.intensity *= 0.82;
      }
    }

    // Animate Castle Spire, Protein Structure & Resource Windmills/Pumpjacks
    if (this.castleMesh) {
      const spire = this.castleMesh.getObjectByName('CastleSpire');
      if (spire) {
        spire.rotation.y += dt * 1.2;
        const outerRing = spire.getObjectByName('CastleSpireRingOuter');
        if (outerRing) outerRing.rotation.z += dt * 1.8;
        const innerRing = spire.getObjectByName('CastleSpireRingInner');
        if (innerRing) innerRing.rotation.x -= dt * 2.4;
      }
    }
    if (this.proteinGroup) {
      this.proteinGroup.rotation.y += dt * 0.55;
    }
    this.resourceGroup.children.forEach((rNode, idx) => {
      const blades = rNode.getObjectByName('GrainWindmillBlades');
      if (blades) blades.rotation.z += dt * 1.8;
      const pump = rNode.getObjectByName('OilPumpHead');
      if (pump) pump.rotation.z = Math.sin(now * 0.004 + idx) * 0.28;
    });

    // Animate Cultivator Aura Visual Cues
    if (this.playerMesh) {
      const goldenCore = this.playerMesh.getObjectByName('CultivationGoldenCore');
      if (goldenCore) {
        goldenCore.rotation.y += dt * 3.2;
        goldenCore.rotation.z += dt * 1.8;
      }
      const chestCore = this.playerMesh.getObjectByName('CultivationChestCore');
      if (chestCore) {
        chestCore.rotation.y -= dt * 4.0;
      }
      const nascentBaby = this.playerMesh.getObjectByName('CultivationNascentBaby');
      if (nascentBaby) {
        nascentBaby.position.y = 3.15 + Math.sin(now * 0.004) * 0.14;
        nascentBaby.rotation.y = Math.sin(now * 0.002) * 0.35;
      }
      const divineHalos = this.playerMesh.getObjectByName('CultivationDivineHalos');
      if (divineHalos) {
        divineHalos.rotation.z += dt * 1.4;
      }
    }

    // Player Movement & Simulation when playing
    if (this.gameState === 'playing' && this.hitstopTimer <= 0) {
      const econ = calculateMasterDiscipleEconomy({
        masterRealmIndex: this.getHighestRealmIndex() + 2,
        disciples: this.cultivation.disciples,
        masterTaxRatePct: this.cultivation.masterTaxRatePct,
      });
      const moveSpeed = 14 * (1 + econ.proximitySpeedBuffPct / 300);

      let moveX = 0;
      let moveZ = 0;
      if (this.keysPressed.has('KeyW') || this.keysPressed.has('ArrowUp')) moveZ -= 1;
      if (this.keysPressed.has('KeyS') || this.keysPressed.has('ArrowDown')) moveZ += 1;
      if (this.keysPressed.has('KeyA') || this.keysPressed.has('ArrowLeft')) moveX -= 1;
      if (this.keysPressed.has('KeyD') || this.keysPressed.has('ArrowRight')) moveX += 1;

      const moveLen = Math.hypot(moveX, moveZ);
      const isMoving = moveLen > 0.05;
      if (isMoving) {
        const normX = moveX / moveLen;
        const normZ = moveZ / moveLen;
        const cosCam = Math.cos(this.cameraOrbitAngle);
        const sinCam = Math.sin(this.cameraOrbitAngle);
        const worldMoveX = normX * cosCam - normZ * sinCam;
        const worldMoveZ = normX * sinCam + normZ * cosCam;

        this.playerPos.x = Math.max(-36, Math.min(36, this.playerPos.x + worldMoveX * moveSpeed * dt));
        this.playerPos.z = Math.max(-36, Math.min(36, this.playerPos.z + worldMoveZ * moveSpeed * dt));
        if (this.playerMesh) {
          this.playerMesh.position.set(
            this.playerPos.x,
            Math.abs(Math.sin(now * 0.015)) * 0.15,
            this.playerPos.z
          );
          this.playerMesh.rotation.y = Math.atan2(worldMoveX, worldMoveZ);
        }
      } else if (this.playerMesh) {
        this.playerMesh.position.set(this.playerPos.x, 0, this.playerPos.z);
      }

      // Tick Red-Name Stationary Tribulation Lightning every 1s
      this.tribulationAccumSec += dt;
      if (this.tribulationAccumSec >= 1.0) {
        this.tribulationAccumSec = 0;
        const res = tickRedNameStationaryLightning({
          karma: this.cultivation.karma,
          isMoving,
          deltaSec: 1,
        });
        this.cultivation.karma = res.updatedKarma;
        if (res.struckByInstantKillLightning) {
          this.triggerTribulationLightningStrike();
        }
      }

      // Autonomous World AI tick every 3s
      this.aiTickAccumSec += dt;
      if (this.aiTickAccumSec >= 3.0) {
        this.aiTickAccumSec = 0;
        this.stepWorldAI();
      }
    } else if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
    }

    // Animate Monsters & NPCs smoothly
    this.monsterGroup.children.forEach((mGroup, idx) => {
      const monData = this.monsters[idx];
      if (monData) {
        const dx = monData.x - mGroup.position.x;
        const dz = monData.z - mGroup.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.05) {
          mGroup.position.x += dx * Math.min(1, dt * 3.5);
          mGroup.position.z += dz * Math.min(1, dt * 3.5);
          mGroup.rotation.y = Math.atan2(dx, dz);
          mGroup.position.y = Math.abs(Math.sin(now * 0.008 + idx)) * 0.18;
        } else {
          mGroup.rotation.y += Math.sin(now * 0.001 + idx) * 0.005;
          mGroup.position.y = 0;
        }
      }
    });

    this.npcGroup.children.forEach((nGroup, idx) => {
      const npcData = this.npcs[idx];
      if (npcData) {
        const dx = npcData.x - nGroup.position.x;
        const dz = npcData.z - nGroup.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.05) {
          nGroup.position.x += dx * Math.min(1, dt * 4.0);
          nGroup.position.z += dz * Math.min(1, dt * 4.0);
          nGroup.rotation.y = Math.atan2(dx, dz);
          nGroup.position.y = Math.abs(Math.sin(now * 0.01 + idx)) * 0.14;
        } else {
          nGroup.position.y = 0;
        }
      }
    });

    // Smooth Damped Third-Person Horizon-Framing Camera (runs in both 'title' and 'playing'!)
    const cam = (xb.core as any)?.camera as THREE.PerspectiveCamera | undefined;
    if (cam && !isPresenting) {
      if (this.gameState === 'title') {
        // Gentle orbital vista camera around the Citadel & Open World on Title Screen
        const tourAngle = Math.sin(now * 0.00025) * 0.28;
        const camDist = 17.5;
        const camHeight = 6.8;
        cam.position.set(
          this.playerPos.x + Math.sin(tourAngle) * camDist,
          this.playerPos.y + camHeight,
          this.playerPos.z + Math.cos(tourAngle) * camDist
        );
        cam.lookAt(0, 4.8, 2);
      } else {
        const camDist = 17.5;
        const camHeight = 6.8;
        const targetCamX = this.playerPos.x + Math.sin(this.cameraOrbitAngle) * camDist;
        const targetCamZ = this.playerPos.z + Math.cos(this.cameraOrbitAngle) * camDist;
        const targetCamY = this.playerPos.y + camHeight;

        const damp = 1 - Math.exp(-8 * dt);
        cam.position.x += (targetCamX - cam.position.x) * damp;
        cam.position.y += (targetCamY - cam.position.y) * damp;
        cam.position.z += (targetCamZ - cam.position.z) * damp;

        if (this.cameraTrauma > 0) {
          const shake = this.cameraTrauma * this.cameraTrauma * 0.35;
          cam.position.x += (Math.random() - 0.5) * shake;
          cam.position.y += (Math.random() - 0.5) * shake;
          this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 2.4);
        }

        const lookAheadX = this.playerPos.x - Math.sin(this.cameraOrbitAngle) * 8;
        const lookAheadZ = this.playerPos.z - Math.cos(this.cameraOrbitAngle) * 8;
        cam.lookAt(lookAheadX, this.playerPos.y + 4.8, lookAheadZ);
      }
    }
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
  }, 3400);
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
    <h2 class="font-cinzel" style="font-size:1.75rem;font-weight:900;color:#fde68a;margin-bottom:8px;">${heading}</h2>
    <p style="font-size:0.9rem;color:#cbd5e1;margin-bottom:18px;">Review your Sovereign Citadel telemetry or return to the open world.</p>
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
        <span class="hud-stat-label">Monsters Slain & Legion Might</span>
        <strong class="font-mono-num" style="font-size:1.05rem;color:#4ade80;">${app.monstersSlain} Slain | ${formatBigInt(app.getTotalPower())} Might</strong>
      </div>
    </div>
    <div style="display:flex;justify-content:center;gap:12px;flex-wrap:wrap;">
      <button id="btn-resume-play" class="action-btn" style="padding:10px 24px;font-size:0.95rem;">Resume Realm</button>
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
  const vipEval = evaluateVipSubscription(app.vipState, app.getEffectiveDateKey());
  const dailyEval = evaluateDailyLoginState(app.dailyLoginState, app.getEffectiveDateKey());
  const rIdx = app.getHighestRealmIndex();
  const realmName = CULTIVATION_REALMS[rIdx]?.name || 'Nascent Soul';
  const weatherCfg = WEATHER_CONFIGS[app.weather] || WEATHER_CONFIGS.clear;

  // Title Screen dynamic badges
  const titleVipLabel = document.getElementById('title-vip-label');
  if (titleVipLabel) titleVipLabel.textContent = `VIP Member Pass (${vipEval.tierConfig.badgeLabel})`;

  // Left Player Identity Card
  const avatarInitial = document.getElementById('hud-avatar-initial');
  const armorTierBadge = document.getElementById('hud-armor-tier');
  const clanTagEl = document.getElementById('hud-clan-tag');
  const playerNameEl = document.getElementById('hud-player-name');
  const realmBtnText = document.getElementById('hud-realm-text');
  const vipBadgeText = document.getElementById('hud-vip-badge-text');
  const mightEl = document.getElementById('hud-player-might');
  const castleLvlEl = document.getElementById('hud-castle-text');

  if (avatarInitial) avatarInitial.textContent = app.playerAppearance.name.charAt(0);
  if (armorTierBadge) armorTierBadge.textContent = `T${app.playerAppearance.armorTier}`;
  if (clanTagEl) clanTagEl.textContent = `[${app.playerAppearance.clanTag}]`;
  if (playerNameEl) playerNameEl.textContent = app.playerAppearance.name;
  if (realmBtnText) realmBtnText.textContent = `${realmName} L${app.cultivation.paths.qi.layer}`;
  if (vipBadgeText) vipBadgeText.textContent = vipEval.tierConfig.badgeLabel;
  if (mightEl) mightEl.textContent = `${formatBigInt(app.getTotalPower())} Might`;
  if (castleLvlEl) castleLvlEl.textContent = `Castle Lv.${app.castleLevel}`;

  // Primary Currencies Bar
  const copperEl = document.getElementById('hud-res-copper');
  const grainEl = document.getElementById('hud-res-grain');
  const diamondEl = document.getElementById('hud-diamond-count');
  if (copperEl) copperEl.textContent = formatBigInt(app.resources.copper);
  if (grainEl) grainEl.textContent = formatBigInt(app.resources.grain);
  if (diamondEl) diamondEl.textContent = formatBigInt(app.resources.diamond);

  // Secondary Inventory Bag Drawer values
  const bagWoodEl = document.getElementById('bag-res-wood');
  const bagSteelEl = document.getElementById('bag-res-steel');
  const bagOilEl = document.getElementById('bag-res-oil');
  const bagScrollsEl = document.getElementById('bag-res-scrolls');
  const bagStreakEl = document.getElementById('bag-daily-streak');
  if (bagWoodEl) bagWoodEl.textContent = formatBigInt(app.resources.wood);
  if (bagSteelEl) bagSteelEl.textContent = formatBigInt(app.resources.steel);
  if (bagOilEl) bagOilEl.textContent = formatBigInt(app.resources.oil);
  if (bagScrollsEl) bagScrollsEl.textContent = `${app.cultivation.veteranScrolls || 0} Scrolls`;
  if (bagStreakEl) bagStreakEl.textContent = `Daily Login (${dailyEval.currentStreak}d)`;

  // Top-Right Weather, Time & Engine Settings
  const weatherBtnText = document.getElementById('hud-weather-text');
  const timeBtnText = document.getElementById('hud-time-text');
  const qualBtnText = document.getElementById('hud-qual-text');
  const platBtnText = document.getElementById('hud-plat-text');
  const moreWeatherSub = document.getElementById('more-weather-sub');
  const moreScrollSub = document.getElementById('more-scroll-sub');
  const moreVipSub = document.getElementById('more-vip-sub');

  if (weatherBtnText) weatherBtnText.textContent = `${weatherCfg.icon} ${weatherCfg.name.split(' ')[0]}`;
  if (timeBtnText) {
    const h = Math.floor(app.timeOfDayHours);
    const m = Math.floor((app.timeOfDayHours % 1) * 60);
    const isDay = h >= 6 && h < 19;
    timeBtnText.textContent = `${isDay ? '☀️' : '🌙'} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} (${app.timeSpeedMultiplier}x)`;
  }
  if (qualBtnText) qualBtnText.textContent = app.graphicsQuality.toUpperCase();
  if (platBtnText) platBtnText.textContent = app.targetPlatform === 'pc_console' ? 'PC / CONSOLE (BC7 4K)' : 'MOBILE (ASTC 1024px)';
  if (moreWeatherSub) moreWeatherSub.textContent = weatherCfg.name.split(' ')[0];
  if (moreScrollSub) moreScrollSub.textContent = `${app.cultivation.veteranScrolls || 0} Scrolls`;
  if (moreVipSub) moreVipSub.textContent = vipEval.tierConfig.badgeLabel;
}

function openDrawer(drawerId: string) {
  app.isInventoryDrawerOpen = false;
  app.isEngineSettingsOpen = false;
  app.isMoreHubOpen = false;
  syncPopovers();

  if (app.activeDrawer === drawerId) {
    closeDrawer();
    return;
  }
  app.activeDrawer = drawerId;
  document.getElementById('modal-overlay')?.classList.remove('hidden-overlay');
  renderActiveDrawer();
}

function closeDrawer() {
  app.activeDrawer = null;
  document.getElementById('modal-overlay')?.classList.add('hidden-overlay');
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
  renderModalContent(app, showToast, updateHUD, renderActiveDrawer, askConfirmationModal);
}

function syncPopovers() {
  const invDrawer = document.getElementById('hud-inventory-drawer');
  const engDrawer = document.getElementById('hud-engine-settings-drawer');
  const moreDrawer = document.getElementById('dock-more-hub-drawer');
  const tabBar = document.getElementById('hud-bottom-tab-bar');
  const dockCollapseBtn = document.getElementById('btn-toggle-dock-collapse');

  invDrawer?.classList.toggle('hidden-overlay', !app.isInventoryDrawerOpen);
  engDrawer?.classList.toggle('hidden-overlay', !app.isEngineSettingsOpen);
  moreDrawer?.classList.toggle('hidden-overlay', !app.isMoreHubOpen);

  if (tabBar) {
    tabBar.style.display = app.isDockCollapsed ? 'none' : 'grid';
  }
  if (dockCollapseBtn) {
    dockCollapseBtn.textContent = app.isDockCollapsed ? '▲ Show Command Dock' : '▼ Zen Mode';
  }
}

function buildDOMGameShell() {
  const root = document.getElementById('root');
  if (!root) return;

  root.innerHTML = `
    <!-- ORIGINAL TITLE SCREEN OVERLAY -->
    <div id="title-overlay">
      <!-- Top Banner & Quick Modals -->
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
        <div class="font-mono-num" style="display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;background:rgba(15,23,42,0.88);border:1px solid rgba(245,158,11,0.38);color:#fcd34d;font-size:0.74rem;font-weight:700;">
          <span>✨</span>
          <span>NEXT-GEN 3D · 245K HIGH-POLY MESHES · 1024PX PBR NORMAL MAPS · GTA V + GENSHIN SHADERS</span>
        </div>

        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <button type="button" id="title-vip-btn" data-testid="title-vip-pass-btn" style="padding:8px 14px;border-radius:12px;background:rgba(15,23,42,0.92);border:1px solid rgba(251,191,36,0.6);color:#fcd34d;font-size:0.76rem;font-weight:700;display:inline-flex;align-items:center;gap:7px;cursor:pointer;">
            <span>👑</span>
            <span id="title-vip-label">VIP Member Pass (VIP 0)</span>
          </button>

          <button type="button" id="title-daily-btn" style="padding:8px 14px;border-radius:12px;background:rgba(69,26,3,0.88);border:1px solid rgba(245,158,11,0.55);color:#fde68a;font-size:0.76rem;font-weight:700;display:inline-flex;align-items:center;gap:7px;cursor:pointer;">
            <span>🎁</span>
            <span>Daily Login Decree</span>
            <span style="padding:1px 6px;border-radius:4px;background:#fbbf24;color:#090d16;font-size:0.64rem;font-weight:900;">NEW</span>
          </button>

          <button type="button" id="title-char-btn" style="padding:8px 14px;border-radius:12px;background:rgba(30,41,59,0.88);border:1px solid rgba(100,116,139,0.5);color:#e2e8f0;font-size:0.76rem;font-weight:700;display:inline-flex;align-items:center;gap:7px;cursor:pointer;">
            <span>🛡️</span>
            <span>Character Creation Centre</span>
          </button>

          <button type="button" id="title-gm-admin-btn" data-testid="title-gm-admin-btn" style="padding:8px 14px;border-radius:12px;background:rgba(30,27,75,0.92);border:1px solid rgba(251,191,36,0.65);color:#fef08a;font-size:0.76rem;font-weight:800;display:inline-flex;align-items:center;gap:7px;cursor:pointer;">
            <span>⚡</span>
            <span>GM / Admin & Contact (${SUPER_ADMIN_EMAIL})</span>
          </button>
        </div>
      </div>

      <!-- Center Hero Lockup -->
      <div style="max-width:680px;margin:auto;text-align:center;display:flex;flex-direction:column;align-items:center;gap:18px;">
        <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">
          <div class="font-mono-num" style="display:inline-flex;align-items:center;gap:6px;font-size:0.74rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#fbbf24;background:rgba(245,158,11,0.14);padding:5px 14px;border-radius:999px;border:1px solid rgba(245,158,11,0.35);">
            Open World Voxel MMORPG
          </div>
          <h1 class="font-cinzel" style="font-size:clamp(2.6rem,6vw,4.5rem);font-weight:900;letter-spacing:-0.02em;color:#fcd34d;margin:0;text-shadow:0 8px 28px rgba(0,0,0,0.85);">
            VOXEL REALMS
          </h1>
          <div class="font-cinzel" style="font-size:0.95rem;color:#e2e8f0;letter-spacing:0.08em;font-weight:600;text-shadow:0 2px 10px rgba(0,0,0,0.85);">
            CASTLE SIEGE · 1,000 TRILLION CAPACITY · TITAN RALLIES
          </div>
        </div>

        <!-- Feature Highlights -->
        <div class="font-mono-num" style="display:flex;flex-wrap:wrap;justify-content:center;gap:8px;font-size:0.74rem;color:#cbd5e1;">
          <span style="padding:5px 10px;border-radius:7px;background:rgba(15,23,42,0.86);border:1px solid rgba(51,65,85,0.8);">🏰 Castle Lv 0 - 100</span>
          <span style="padding:5px 10px;border-radius:7px;background:rgba(15,23,42,0.86);border:1px solid rgba(51,65,85,0.8);">⚔️ T1 - T20 Troops (Shield, Shooter, Bomber)</span>
          <span style="padding:5px 10px;border-radius:7px;background:rgba(15,23,42,0.86);border:1px solid rgba(51,65,85,0.8);">📯 1 Trillion Rally Cap</span>
          <span style="padding:5px 10px;border-radius:7px;background:rgba(15,23,42,0.86);border:1px solid rgba(51,65,85,0.8);">🐲 Lv 1 - 1000 Monsters</span>
          <span style="padding:5px 10px;border-radius:7px;background:rgba(15,23,42,0.86);border:1px solid rgba(51,65,85,0.8);">📜 Daily Veteran Scrolls</span>
        </div>

        <!-- Primary Start CTA -->
        <div style="padding-top:6px;">
          <button type="button" id="btn-start-game" data-start="true" class="font-cinzel" style="padding:16px 42px;border-radius:16px;background:#f59e0b;color:#020617;font-weight:900;font-size:1.12rem;border:1px solid #fde68a;box-shadow:0 12px 32px rgba(245,158,11,0.38);display:inline-flex;align-items:center;gap:12px;cursor:pointer;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            <span>ENTER THE REALM</span>
          </button>
        </div>
      </div>

      <!-- Flat Control Hint Line -->
      <div class="font-mono-num" style="text-align:center;font-size:0.75rem;color:#94a3b8;letter-spacing:0.03em;">
        WASD / Arrow Keys Move · Mouse Drag Look · Space / Click Interact · Touch D-Pad on Android
      </div>
    </div>

    <!-- ORIGINAL GAME HUD OVERLAY -->
    <div id="hud-overlay" class="hidden-overlay">
      <!-- Top Bar -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;width:100%;">
        <!-- Left: Player Identity Card + Primary Currencies Bar -->
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <!-- Player Identity Card -->
          <div style="pointer-events:auto;padding:8px 10px;border-radius:16px;background:rgba(2,6,23,0.92);border:1px solid rgba(30,41,59,0.95);box-shadow:0 10px 25px rgba(0,0,0,0.65);display:flex;align-items:center;gap:10px;">
            <button type="button" id="hud-open-char-btn" title="Open Character Creation Centre" style="position:relative;padding:2px;border-radius:12px;background:#1e293b;border:none;cursor:pointer;">
              <div id="hud-avatar-initial" style="width:38px;height:38px;border-radius:9px;background:linear-gradient(135deg,#f59e0b,#b45309);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:1.05rem;">
                A
              </div>
              <span id="hud-armor-tier" class="font-mono-num" style="position:absolute;bottom:-4px;right:-4px;font-size:0.6rem;padding:1px 4px;border-radius:4px;background:#06b6d4;color:#020617;font-weight:800;">
                T3
              </span>
            </button>

            <div>
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                <span id="hud-clan-tag" class="font-mono-num" style="font-size:0.72rem;font-weight:800;color:#fbbf24;">[VALOR]</span>
                <span id="hud-player-name" class="font-cinzel" style="font-size:0.86rem;font-weight:800;color:#fff;">Aiden Skyrender</span>
                <button type="button" id="hud-cultivation-badge-btn" title="Open Cultivation Cave Abode & Dantian" class="font-mono-num" style="font-size:0.66rem;padding:2px 7px;border-radius:6px;background:#0f172a;color:#fcd34d;border:1px solid rgba(251,191,36,0.45);font-weight:700;display:inline-flex;align-items:center;gap:4px;cursor:pointer;">
                  <span>✨</span>
                  <span id="hud-realm-text">Nascent Soul L4</span>
                </button>
                <button type="button" id="hud-vip-badge-btn" data-testid="hud-vip-badge-btn" title="Open Imperial VIP Member Subscription & Daily Stipend Chest" class="font-mono-num" style="font-size:0.66rem;padding:2px 7px;border-radius:6px;background:#0f172a;color:#fcd34d;border:1px solid rgba(251,191,36,0.6);font-weight:700;display:inline-flex;align-items:center;gap:4px;cursor:pointer;">
                  <span>👑</span>
                  <span id="hud-vip-badge-text">VIP 0</span>
                </button>
                <button type="button" id="hud-gm-badge-btn" data-testid="hud-gm-badge-btn" title="Open Sovereign Administration, GM, Admin & Moderator Control + Contact (${SUPER_ADMIN_EMAIL})" class="font-mono-num" style="font-size:0.66rem;padding:2px 7px;border-radius:6px;background:rgba(30,27,75,0.95);color:#fef08a;border:1px solid rgba(251,191,36,0.65);font-weight:800;display:inline-flex;align-items:center;gap:4px;cursor:pointer;">
                  <span>⚡</span>
                  <span>GM / Admin (${SUPER_ADMIN_EMAIL})</span>
                </button>
                <button type="button" id="hud-update-all-btn" data-testid="hud-update-all-btn" title="Synchronize & Update All Realm Systems (Citadel, Cultivation, Legions, Heroes, Clan, Leaderboard)" class="font-mono-num" style="font-size:0.66rem;padding:2px 7px;border-radius:6px;background:rgba(6,78,59,0.95);color:#6ee7b7;border:1px solid rgba(16,185,129,0.65);font-weight:800;display:inline-flex;align-items:center;gap:4px;cursor:pointer;">
                  <span>🔄</span>
                  <span>Update All</span>
                </button>
                <button type="button" id="hud-readme-btn" data-testid="hud-readme-btn" title="Open README.md Architecture, Features & Admin Documentation" class="font-mono-num" style="font-size:0.66rem;padding:2px 7px;border-radius:6px;background:rgba(15,23,42,0.95);color:#bae6fd;border:1px solid rgba(56,189,248,0.65);font-weight:800;display:inline-flex;align-items:center;gap:4px;cursor:pointer;">
                  <span>📖</span>
                  <span>Readme.md</span>
                </button>
              </div>
              <div class="font-mono-num" style="display:flex;align-items:center;gap:6px;margin-top:2px;font-size:0.72rem;color:#94a3b8;">
                <span id="hud-player-might" data-testid="hud-player-might" style="color:#34d399;font-weight:800;">1.8M Might</span>
                <span>·</span>
                <span id="hud-castle-text" style="color:#38bdf8;font-weight:800;">Castle Lv.12</span>
              </div>
            </div>
          </div>

          <!-- Primary Currencies Bar (Copper, Grain, Diamond + Bag Drawer) -->
          <div data-testid="hud-primary-resources" style="pointer-events:auto;position:relative;display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:16px;background:rgba(2,6,23,0.92);border:1px solid rgba(30,41,59,0.95);box-shadow:0 10px 25px rgba(0,0,0,0.65);">
            <button type="button" class="hud-res-pill" data-open="resources" title="Copper Coins (Primary Currency)" style="display:inline-flex;align-items:center;gap:4px;padding:4px 7px;border-radius:8px;background:transparent;border:none;cursor:pointer;">
              <span style="font-size:0.86rem;">🪙</span>
              <span id="hud-res-copper" class="font-mono-num" style="font-size:0.76rem;font-weight:800;color:#fde68a;">450.0K</span>
            </button>
            <button type="button" class="hud-res-pill" data-open="resources" title="Grain Provisions (Primary Currency)" style="display:inline-flex;align-items:center;gap:4px;padding:4px 7px;border-radius:8px;background:transparent;border:none;cursor:pointer;">
              <span style="font-size:0.86rem;">🌾</span>
              <span id="hud-res-grain" class="font-mono-num" style="font-size:0.76rem;font-weight:800;color:#a7f3d0;">380.0K</span>
            </button>
            <button type="button" class="hud-res-pill" data-open="resources" title="Diamond Gems (Primary Currency)" style="display:inline-flex;align-items:center;gap:4px;padding:4px 7px;border-radius:8px;background:transparent;border:none;cursor:pointer;">
              <span style="font-size:0.86rem;">💎</span>
              <span id="hud-diamond-count" data-testid="hud-diamond-count" class="font-mono-num" style="font-size:0.76rem;font-weight:800;color:#67e8f9;">28.5K</span>
            </button>

            <button type="button" id="hud-inventory-drawer-toggle" data-testid="hud-inventory-drawer-toggle" class="font-mono-num" style="display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:10px;background:#0f172a;border:1px solid #334155;color:#e2e8f0;font-size:0.74rem;font-weight:800;cursor:pointer;">
              <span>📦</span>
              <span>Bag</span>
              <span style="padding:0 4px;border-radius:4px;background:#fbbf24;color:#020617;font-size:0.62rem;font-weight:900;">!</span>
            </button>

            <!-- Expandable Inventory Drawer Popover -->
            <div id="hud-inventory-drawer" data-testid="hud-inventory-drawer" class="hidden-overlay" style="position:absolute;right:0;top:calc(100% + 8px);width:265px;padding:12px;border-radius:16px;background:rgba(2,6,23,0.97);border:1px solid #334155;box-shadow:0 20px 45px rgba(0,0,0,0.85);z-index:50;">
              <div class="font-mono-num" style="display:flex;justify-content:space-between;font-size:0.68rem;font-weight:800;color:#94a3b8;border-bottom:1px solid #1e293b;padding-bottom:6px;margin-bottom:8px;">
                <span>SECONDARY MATERIALS & SCROLLS</span>
                <button type="button" id="bag-harvest-link" style="background:none;border:none;color:#38bdf8;font-weight:800;cursor:pointer;">Harvest →</button>
              </div>
              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;">
                <div style="background:#0f172a;padding:7px;border-radius:10px;text-align:center;border:1px solid #1e293b;">
                  <div>🪵</div>
                  <div style="font-size:0.62rem;color:#94a3b8;">Wood</div>
                  <div id="bag-res-wood" class="font-mono-num" style="font-size:0.72rem;font-weight:800;color:#fde68a;">250K</div>
                </div>
                <div style="background:#0f172a;padding:7px;border-radius:10px;text-align:center;border:1px solid #1e293b;">
                  <div>⚙️</div>
                  <div style="font-size:0.62rem;color:#94a3b8;">Steel</div>
                  <div id="bag-res-steel" class="font-mono-num" style="font-size:0.72rem;font-weight:800;color:#e2e8f0;">180K</div>
                </div>
                <div style="background:#0f172a;padding:7px;border-radius:10px;text-align:center;border:1px solid #1e293b;">
                  <div>🛢️</div>
                  <div style="font-size:0.62rem;color:#94a3b8;">Crude Oil</div>
                  <div id="bag-res-oil" class="font-mono-num" style="font-size:0.72rem;font-weight:800;color:#c084fc;">95K</div>
                </div>
              </div>
              <div style="display:flex;gap:6px;margin-top:8px;">
                <button type="button" id="hud-daily-login-btn" data-testid="hud-daily-login-btn" style="flex:1;padding:7px;border-radius:10px;background:rgba(120,53,15,0.45);border:1px solid rgba(245,158,11,0.5);color:#fde68a;font-size:0.68rem;font-weight:800;cursor:pointer;">
                  🎁 <span id="bag-daily-streak">Daily Login (3d)</span>
                </button>
                <button type="button" id="bag-scrolls-btn" style="flex:1;padding:7px;border-radius:10px;background:#0f172a;border:1px solid #334155;color:#fde68a;font-size:0.68rem;font-weight:800;cursor:pointer;">
                  📜 <span id="bag-res-scrolls">2 Scrolls</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Merged Status & Engine Bar -->
        <div data-testid="hud-merged-status-bar" style="pointer-events:auto;position:relative;display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:16px;background:rgba(2,6,23,0.92);border:1px solid rgba(30,41,59,0.95);box-shadow:0 10px 25px rgba(0,0,0,0.65);">
          <button type="button" id="hud-weather-btn" class="hud-icon-btn" title="Open Weather Ritual">
            <span id="hud-weather-text">☀️ Clear</span>
          </button>
          <button type="button" id="hud-time-btn" class="hud-icon-btn" title="Cycle Time Speed">
            <span id="hud-time-text" class="font-mono-num">☀️ 11:30 (1x)</span>
          </button>
          <button type="button" id="btn-mute-audio" class="hud-icon-btn" title="Toggle Audio">🔊</button>
          <button type="button" id="hud-engine-settings-toggle" data-testid="hud-engine-settings-toggle" class="hud-icon-btn" title="Engine & Graphics Settings">⚙️</button>

          <!-- Engine Settings Popover -->
          <div id="hud-engine-settings-drawer" data-testid="hud-engine-settings-drawer" class="hidden-overlay" style="position:absolute;right:0;top:calc(100% + 8px);width:260px;padding:12px;border-radius:16px;background:rgba(2,6,23,0.97);border:1px solid #334155;box-shadow:0 20px 45px rgba(0,0,0,0.85);z-index:50;display:flex;flex-direction:column;gap:8px;">
            <div class="font-mono-num" style="font-size:0.68rem;font-weight:800;color:#94a3b8;border-bottom:1px solid #1e293b;padding-bottom:4px;">
              ENGINE & GRAPHICS PIPELINE
            </div>
            <button type="button" id="hud-graphics-quality-btn" data-testid="hud-graphics-quality-btn" class="action-btn-secondary" style="display:flex;justify-content:space-between;width:100%;">
              <span>Graphics Preset:</span>
              <strong id="hud-qual-text" style="color:#fde68a;">ULTRA</strong>
            </button>
            <button type="button" id="hud-platform-override-btn" data-testid="hud-platform-override-btn" class="action-btn-secondary" style="display:flex;justify-content:space-between;width:100%;">
              <span>Platform:</span>
              <strong id="hud-plat-text" style="color:#38bdf8;">PC / CONSOLE</strong>
            </button>
            <div style="display:flex;gap:6px;">
              <button type="button" id="hud-cpp-btn" class="action-btn-secondary" style="flex:1;">💻 C++20 Core</button>
              <button type="button" id="hud-gm-btn" class="action-btn-secondary" style="flex:1;">⚡ GM Console</button>
            </div>
            <button type="button" id="btn-pause-game" class="action-btn-secondary" style="width:100%;">⏸ Pause / Telemetry</button>
          </div>
        </div>
      </div>

      <!-- Right-Side Action Cluster (Attack, Gather, Jump) -->
      <div style="pointer-events:auto;position:fixed;right:16px;bottom:96px;display:flex;flex-direction:column;gap:8px;z-index:26;">
        <button type="button" id="hud-action-attack-btn" data-testid="hud-action-attack-btn" style="width:52px;height:52px;border-radius:16px;background:linear-gradient(135deg,#e11d48,#9f1239);border:1px solid #fda4af;color:#fff;font-weight:800;font-size:0.68rem;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 8px 20px rgba(0,0,0,0.6);cursor:pointer;">
          <span style="font-size:1.1rem;">⚔️</span>
          <span>Strike</span>
        </button>
        <button type="button" id="hud-action-gather-btn" data-testid="hud-action-gather-btn" style="width:52px;height:52px;border-radius:16px;background:linear-gradient(135deg,#059669,#065f46);border:1px solid #6ee7b7;color:#fff;font-weight:800;font-size:0.68rem;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 8px 20px rgba(0,0,0,0.6);cursor:pointer;">
          <span style="font-size:1.1rem;">⛏️</span>
          <span>Gather</span>
        </button>
      </div>

      <!-- Bottom 5-Tab Command Dock + Expandable More Hub -->
      <div style="pointer-events:auto;max-width:560px;width:100%;margin:0 auto;display:flex;flex-direction:column;align-items:center;">
        <!-- Expandable More Hub Drawer -->
        <div id="dock-more-hub-drawer" data-testid="dock-more-hub-drawer" class="hidden-overlay" style="width:100%;margin-bottom:8px;padding:12px;border-radius:18px;background:rgba(2,6,23,0.96);border:1px solid #334155;box-shadow:0 20px 50px rgba(0,0,0,0.88);display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
          <button type="button" data-testid="dock-vip-pass-btn" class="more-hub-item" data-drawer="vip_subscription" style="padding:8px;border-radius:12px;background:#0f172a;border:1px solid rgba(251,191,36,0.5);color:#fde68a;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;">
            <span style="font-size:1.15rem;">👑</span>
            <span class="font-cinzel" style="font-size:0.68rem;font-weight:800;">VIP Pass</span>
            <span id="more-vip-sub" class="font-mono-num" style="font-size:0.6rem;color:#fcd34d;">VIP 0</span>
          </button>

          <button type="button" data-testid="dock-daily-login-btn" class="more-hub-item" data-drawer="daily_login" style="padding:8px;border-radius:12px;background:#0f172a;border:1px solid rgba(245,158,11,0.45);color:#fde68a;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;">
            <span style="font-size:1.15rem;">🎁</span>
            <span class="font-cinzel" style="font-size:0.68rem;font-weight:800;">Daily Login</span>
            <span id="more-scroll-sub" class="font-mono-num" style="font-size:0.6rem;color:#fcd34d;">2 Scrolls</span>
          </button>

          <button type="button" class="more-hub-item" data-drawer="world_boss" style="padding:8px;border-radius:12px;background:#0f172a;border:1px solid rgba(244,63,94,0.45);color:#fecdd3;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;">
            <span style="font-size:1.15rem;">🐲</span>
            <span class="font-cinzel" style="font-size:0.68rem;font-weight:800;">World Boss</span>
            <span class="font-mono-num" style="font-size:0.6rem;color:#fda4af;">1T Rally</span>
          </button>

          <button type="button" class="more-hub-item" data-drawer="world_ai" style="padding:8px;border-radius:12px;background:#0f172a;border:1px solid rgba(168,85,247,0.45);color:#e9d5ff;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;">
            <span style="font-size:1.15rem;">🧠</span>
            <span class="font-cinzel" style="font-size:0.68rem;font-weight:800;">AI Director</span>
            <span class="font-mono-num" style="font-size:0.6rem;color:#d8b4fe;">Lv 1-1000</span>
          </button>

          <button type="button" class="more-hub-item" data-drawer="clan" style="padding:8px;border-radius:12px;background:#0f172a;border:1px solid rgba(59,130,246,0.45);color:#bfdbfe;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;">
            <span style="font-size:1.15rem;">🛡️</span>
            <span class="font-cinzel" style="font-size:0.68rem;font-weight:800;">Clan</span>
            <span class="font-mono-num" style="font-size:0.6rem;color:#93c5fd;">Territory</span>
          </button>

          <button type="button" class="more-hub-item" data-drawer="resources" style="padding:8px;border-radius:12px;background:#0f172a;border:1px solid rgba(16,185,129,0.45);color:#a7f3d0;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;">
            <span style="font-size:1.15rem;">⛏️</span>
            <span class="font-cinzel" style="font-size:0.68rem;font-weight:800;">Harvest</span>
            <span class="font-mono-num" style="font-size:0.6rem;color:#6ee7b7;">Lv 1-10</span>
          </button>

          <button type="button" class="more-hub-item" data-drawer="weather" style="padding:8px;border-radius:12px;background:#0f172a;border:1px solid rgba(6,182,212,0.45);color:#a5f3fc;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;">
            <span style="font-size:1.15rem;">🌧️</span>
            <span class="font-cinzel" style="font-size:0.68rem;font-weight:800;">Weather</span>
            <span id="more-weather-sub" class="font-mono-num" style="font-size:0.6rem;color:#67e8f9;">Clear</span>
          </button>

          <button type="button" class="more-hub-item" data-drawer="leaderboard" style="padding:8px;border-radius:12px;background:#0f172a;border:1px solid #334155;color:#e2e8f0;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;">
            <span style="font-size:1.15rem;">🏆</span>
            <span class="font-cinzel" style="font-size:0.68rem;font-weight:800;">Rankings</span>
            <span class="font-mono-num" style="font-size:0.6rem;color:#94a3b8;">Top 10</span>
          </button>

          <button type="button" class="more-hub-item" data-drawer="cpp_core" style="padding:8px;border-radius:12px;background:#0f172a;border:1px solid rgba(16,185,129,0.45);color:#a7f3d0;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;">
            <span style="font-size:1.15rem;">💻</span>
            <span class="font-mono-num" style="font-size:0.68rem;font-weight:800;">C++ 20+</span>
            <span class="font-mono-num" style="font-size:0.6rem;color:#34d399;">Engine</span>
          </button>

          <button type="button" class="more-hub-item" data-drawer="bioscience" style="padding:8px;border-radius:12px;background:#0f172a;border:1px solid rgba(56,189,248,0.45);color:#bae6fd;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;">
            <span style="font-size:1.15rem;">🧬</span>
            <span class="font-cinzel" style="font-size:0.68rem;font-weight:800;">Bioscience</span>
            <span class="font-mono-num" style="font-size:0.6rem;color:#38bdf8;">AlphaFold</span>
          </button>

          <button type="button" class="more-hub-item" data-drawer="gemini" style="padding:8px;border-radius:12px;background:#0f172a;border:1px solid rgba(251,191,36,0.45);color:#fde68a;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;">
            <span style="font-size:1.15rem;">✨</span>
            <span class="font-cinzel" style="font-size:0.68rem;font-weight:800;">Gemini AI</span>
            <span class="font-mono-num" style="font-size:0.6rem;color:#fbbf24;">Oracle</span>
          </button>

          <button type="button" class="more-hub-item" data-drawer="workspace" style="padding:8px;border-radius:12px;background:#0f172a;border:1px solid rgba(99,102,241,0.45);color:#c7d2fe;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;">
            <span style="font-size:1.15rem;">☁️</span>
            <span class="font-cinzel" style="font-size:0.68rem;font-weight:800;">Workspace</span>
            <span class="font-mono-num" style="font-size:0.6rem;color:#818cf8;">Cloud Sync</span>
          </button>

          <button type="button" data-testid="dock-readme-btn" class="more-hub-item" data-drawer="readme" style="padding:8px;border-radius:12px;background:#0f172a;border:1px solid rgba(56,189,248,0.55);color:#bae6fd;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;">
            <span style="font-size:1.15rem;">📖</span>
            <span class="font-cinzel" style="font-size:0.68rem;font-weight:800;">Readme.md</span>
            <span class="font-mono-num" style="font-size:0.6rem;color:#38bdf8;">Docs & Guide</span>
          </button>
        </div>

        <!-- Zen Mode Collapse Toggle -->
        <button type="button" id="btn-toggle-dock-collapse" class="font-mono-num" style="padding:4px 12px;border-radius:10px 10px 0 0;background:rgba(2,6,23,0.92);border-top:1px solid #334155;border-left:1px solid #334155;border-right:1px solid #334155;border-bottom:none;color:#cbd5e1;font-size:0.65rem;font-weight:800;cursor:pointer;">
          ▼ Zen Mode
        </button>

        <!-- 5 Square Icon Tabs -->
        <div id="hud-bottom-tab-bar" data-testid="hud-bottom-tab-bar" style="width:100%;padding:6px 8px;border-radius:18px;background:rgba(2,6,23,0.95);border:1px solid #1e293b;box-shadow:0 16px 40px rgba(0,0,0,0.8);display:grid;grid-template-columns:repeat(5,1fr);gap:6px;">
          <button type="button" data-testid="dock-castle-btn" class="dock-primary-btn" data-drawer="castle" style="min-height:52px;padding:6px 4px;border-radius:12px;background:rgba(245,158,11,0.16);border:1px solid rgba(245,158,11,0.42);color:#fde68a;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer;">
            <span style="font-size:1.15rem;">🏰</span>
            <span class="font-cinzel" style="font-size:0.7rem;font-weight:800;">Castle</span>
          </button>

          <button type="button" data-testid="dock-barracks-btn" class="dock-primary-btn" data-drawer="troops" style="min-height:52px;padding:6px 4px;border-radius:12px;background:rgba(244,63,94,0.16);border:1px solid rgba(244,63,94,0.42);color:#fecdd3;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer;">
            <span style="font-size:1.15rem;">⚔️</span>
            <span class="font-cinzel" style="font-size:0.7rem;font-weight:800;">Barracks</span>
          </button>

          <button type="button" data-testid="dock-cultivate-btn" class="dock-primary-btn" data-drawer="cultivation" style="min-height:52px;padding:6px 4px;border-radius:12px;background:rgba(245,158,11,0.22);border:1px solid rgba(251,191,36,0.6);color:#fef3c7;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer;">
            <span style="font-size:1.15rem;">✨</span>
            <span class="font-cinzel" style="font-size:0.7rem;font-weight:800;">Cultivate</span>
          </button>

          <button type="button" data-testid="dock-heroes-btn" class="dock-primary-btn" data-drawer="hero" style="min-height:52px;padding:6px 4px;border-radius:12px;background:rgba(99,102,241,0.16);border:1px solid rgba(99,102,241,0.42);color:#c7d2fe;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer;">
            <span style="font-size:1.15rem;">🎖️</span>
            <span class="font-cinzel" style="font-size:0.7rem;font-weight:800;">Heroes</span>
          </button>

          <button type="button" id="dock-more-hub-btn" data-testid="dock-more-hub-btn" style="position:relative;min-height:52px;padding:6px 4px;border-radius:12px;background:#0f172a;border:1px solid #334155;color:#e2e8f0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer;">
            <span style="font-size:1.15rem;color:#38bdf8;">⊞</span>
            <span class="font-cinzel" style="font-size:0.7rem;font-weight:800;">More</span>
            <span class="font-mono-num" style="position:absolute;top:4px;right:6px;padding:0 4px;border-radius:4px;background:#fbbf24;color:#020617;font-size:0.55rem;font-weight:900;">!</span>
          </button>
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

  // Title Screen handlers
  document.getElementById('btn-start-game')?.addEventListener('click', (e) => {
    (e.currentTarget as HTMLElement).blur();
    sound.playUpgradeFanfare();
    setGameLifecycleState('playing');
  });
  document.getElementById('title-vip-btn')?.addEventListener('click', () => {
    sound.playSwing();
    openDrawer('vip_subscription');
  });
  document.getElementById('title-daily-btn')?.addEventListener('click', () => {
    sound.playSwing();
    openDrawer('daily_login');
  });
  document.getElementById('title-char-btn')?.addEventListener('click', () => {
    sound.playSwing();
    openDrawer('character');
  });
  document.getElementById('title-gm-admin-btn')?.addEventListener('click', () => {
    sound.playSwing();
    openDrawer('admin_console');
  });

  // Top HUD Identity & Currency handlers
  document.getElementById('hud-open-char-btn')?.addEventListener('click', () => {
    sound.playSwing();
    openDrawer('character');
  });
  document.getElementById('hud-cultivation-badge-btn')?.addEventListener('click', () => {
    sound.playSwing();
    openDrawer('cultivation');
  });
  document.getElementById('hud-vip-badge-btn')?.addEventListener('click', () => {
    sound.playSwing();
    openDrawer('vip_subscription');
  });
  document.getElementById('hud-gm-badge-btn')?.addEventListener('click', () => {
    sound.playSwing();
    openDrawer('admin_console');
  });
  document.getElementById('hud-update-all-btn')?.addEventListener('click', () => {
    app.updateAllRealmSystems();
  });
  document.getElementById('hud-readme-btn')?.addEventListener('click', () => {
    sound.playSwing();
    openDrawer('readme');
  });
  document.querySelectorAll('.hud-res-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      sound.playSwing();
      openDrawer('resources');
    });
  });

  document.getElementById('hud-inventory-drawer-toggle')?.addEventListener('click', () => {
    sound.playSwing();
    app.isInventoryDrawerOpen = !app.isInventoryDrawerOpen;
    app.isEngineSettingsOpen = false;
    app.isMoreHubOpen = false;
    syncPopovers();
    updateHUD();
  });
  document.getElementById('bag-harvest-link')?.addEventListener('click', () => {
    openDrawer('resources');
  });
  document.getElementById('hud-daily-login-btn')?.addEventListener('click', () => {
    openDrawer('daily_login');
  });
  document.getElementById('bag-scrolls-btn')?.addEventListener('click', () => {
    openDrawer('daily_login');
  });

  // Top-right Weather, Time, Audio, Engine Settings handlers
  document.getElementById('hud-weather-btn')?.addEventListener('click', () => {
    sound.playWeatherChange();
    openDrawer('weather');
  });
  document.getElementById('hud-time-btn')?.addEventListener('click', () => {
    const speeds = [1, 4, 12];
    app.timeSpeedMultiplier = speeds[(speeds.indexOf(app.timeSpeedMultiplier) + 1) % speeds.length];
    sound.playButton();
    updateHUD();
  });
  document.getElementById('btn-mute-audio')?.addEventListener('click', (e) => {
    const muted = sound.toggleMute();
    (e.currentTarget as HTMLElement).textContent = muted ? '🔇' : '🔊';
  });
  document.getElementById('hud-engine-settings-toggle')?.addEventListener('click', () => {
    sound.playSwing();
    app.isEngineSettingsOpen = !app.isEngineSettingsOpen;
    app.isInventoryDrawerOpen = false;
    app.isMoreHubOpen = false;
    syncPopovers();
    updateHUD();
  });
  document.getElementById('hud-graphics-quality-btn')?.addEventListener('click', () => {
    const presets: GraphicsQualityPreset[] = ['ultra', 'high', 'balanced'];
    app.graphicsQuality = presets[(presets.indexOf(app.graphicsQuality) + 1) % presets.length];
    updateHUD();
    showToast(`✨ Graphics Preset: ${app.graphicsQuality.toUpperCase()}`);
  });
  document.getElementById('hud-platform-override-btn')?.addEventListener('click', () => {
    app.targetPlatform = app.targetPlatform === 'pc_console' ? 'mobile' : 'pc_console';
    updateHUD();
    showToast(
      app.targetPlatform === 'mobile'
        ? '📱 Platform Override: MOBILE (ASTC 1024px · LOD Bias +1)'
        : '🖥️ Platform Override: PC / PS5 / Xbox (BC7 4K Master · LOD 0 Hero Meshes)'
    );
  });
  document.getElementById('hud-cpp-btn')?.addEventListener('click', () => openDrawer('cpp_core'));
  document.getElementById('hud-gm-btn')?.addEventListener('click', () => openDrawer('admin_console'));
  document.getElementById('btn-pause-game')?.addEventListener('click', () => {
    app.isEngineSettingsOpen = false;
    syncPopovers();
    setGameLifecycleState(app.gameState === 'paused' ? 'playing' : 'paused');
  });

  // Right-Side Action Cluster handlers
  document.getElementById('hud-action-attack-btn')?.addEventListener('click', () => {
    app.performStrikeOrHarvest();
  });
  document.getElementById('hud-action-gather-btn')?.addEventListener('click', () => {
    openDrawer('resources');
  });

  // Bottom Command Dock & More Hub handlers
  document.getElementById('btn-toggle-dock-collapse')?.addEventListener('click', () => {
    sound.playSwing();
    app.isDockCollapsed = !app.isDockCollapsed;
    app.isMoreHubOpen = false;
    syncPopovers();
  });
  document.querySelectorAll('.dock-primary-btn, .more-hub-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      sound.playSwing();
      const drawer = btn.getAttribute('data-drawer');
      if (drawer) openDrawer(drawer);
    });
  });
  document.getElementById('dock-more-hub-btn')?.addEventListener('click', () => {
    sound.playSwing();
    if (app.activeDrawer) {
      closeDrawer();
    }
    app.isInventoryDrawerOpen = false;
    app.isEngineSettingsOpen = false;
    app.isMoreHubOpen = !app.isMoreHubOpen;
    syncPopovers();
  });

  document.getElementById('modal-close-btn')?.addEventListener('click', () => {
    closeDrawer();
  });

  window.addEventListener('keydown', (e) => {
    const activeTag = document.activeElement?.tagName;
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') {
      return;
    }

    if (e.key === '`' || e.key === '~') {
      openDrawer('admin_console');
      return;
    }

    if (app.gameState === 'title' && (e.code === 'Enter' || e.code === 'Space') && !app.activeDrawer) {
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

  window.addEventListener('blur', () => {
    app.keysPressed.clear();
  });

  initAuth(
    (user) => {
      app.currentUserName = user.displayName || user.email || 'Sovereign Lord';
      app.currentUserEmail = user.email || SUPER_ADMIN_EMAIL;
      if (app.activeDrawer === 'workspace' || app.activeDrawer === 'admin_console') renderActiveDrawer();
    },
    () => {
      app.currentUserName = null;
      app.currentUserEmail = app.gmSessionActive ? SUPER_ADMIN_EMAIL : null;
      if (app.activeDrawer === 'workspace' || app.activeDrawer === 'admin_console') renderActiveDrawer();
    }
  );

  const params = new URLSearchParams(window.location.search);
  if (params.get('autostart') === '1') {
    setGameLifecycleState('playing');
  } else {
    setGameLifecycleState('title');
  }
  updateHUD();
}

document.addEventListener('DOMContentLoaded', async () => {
  buildDOMGameShell();

  const options = new xb.Options();
  options.setAppTitle('Voxel Realms');
  options.setAppDescription(
    'Open-World Voxel MMORPG & Castle Warfare with Four-Path Cultivation, 1,000 Trillion Capacity, and Titan Rallies.'
  );
  options.reticles.enabled = false;
  options.simulator.instructions.enabled = false;
  options.simulator.simulatorSettingsPanel.enabled = false;

  xb.add(app);
  await xb.init(options);

  if (/HeadlessChrome/i.test(navigator.userAgent)) {
    const core = xb.core as any;
    if (core?.renderer && typeof core?.update === 'function') {
      core.renderer.setAnimationLoop(null);
      const tickSoftwareGl = () => {
        try {
          core.update(performance.now());
        } catch {
          // ignore
        }
        window.setTimeout(tickSoftwareGl, 180);
      };
      tickSoftwareGl();
    }
  }
});

