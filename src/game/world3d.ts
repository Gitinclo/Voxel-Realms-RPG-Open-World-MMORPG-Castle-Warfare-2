import * as THREE from 'three';
import { MonsterTarget, NPCEntity, ProteinResiduePoint, ResourceType } from '../types';
import { getAlphaFoldPlddtColor } from './bioscience';
import { getCultivationAuraVisualSpec } from './rules';

export interface WorldResourceNode {
  id: string;
  type: ResourceType;
  x: number;
  z: number;
  amount: bigint;
}

const sharedBoxGeo = new THREE.BoxGeometry(1, 1, 1);
const sharedCylinderGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
const sharedConeGeo = new THREE.ConeGeometry(0.65, 1, 8);
const sharedSphereGeo = new THREE.SphereGeometry(0.5, 16, 16);
const sharedTorusGeo = new THREE.TorusGeometry(0.6, 0.05, 12, 32);

export function createVoxelTerrain(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'VoxelTerrain';

  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x2e4c2f,
    roughness: 0.85,
    metalness: 0.05,
  });
  const ground = new THREE.Mesh(new THREE.BoxGeometry(120, 2, 120), groundMat);
  ground.position.set(0, -1, 0);
  ground.receiveShadow = true;
  group.add(ground);

  const courtyardMat = new THREE.MeshStandardMaterial({
    color: 0x525866,
    roughness: 0.7,
    metalness: 0.15,
  });
  const courtyard = new THREE.Mesh(new THREE.BoxGeometry(26, 0.25, 26), courtyardMat);
  courtyard.position.set(0, 0.12, 0);
  courtyard.receiveShadow = true;
  group.add(courtyard);

  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x0ea5e9,
    roughness: 0.2,
    metalness: 0.4,
    transparent: true,
    opacity: 0.82,
  });
  const moat = new THREE.Mesh(new THREE.RingGeometry(15, 18.5, 32), waterMat);
  moat.rotation.x = -Math.PI / 2;
  moat.position.y = 0.06;
  group.add(moat);

  const bridgeMat = new THREE.MeshStandardMaterial({
    color: 0x78553a,
    roughness: 0.75,
  });
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.35, 6), bridgeMat);
  bridge.position.set(0, 0.18, 16.5);
  bridge.castShadow = true;
  bridge.receiveShadow = true;
  group.add(bridge);

  const hillMat = new THREE.MeshStandardMaterial({ color: 0x3b5e3c, roughness: 0.85 });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.65, metalness: 0.2 });

  const hillCoords = [
    [-34, -28, 12, 4, 12],
    [34, -30, 14, 5, 10],
    [-38, 24, 10, 3.5, 14],
    [36, 28, 12, 4.5, 12],
    [0, -42, 22, 6, 10],
  ];
  for (const [x, z, w, h, d] of hillCoords) {
    const hill = new THREE.Mesh(sharedBoxGeo, hillMat);
    hill.scale.set(w, h, d);
    hill.position.set(x, h / 2, z);
    hill.castShadow = true;
    hill.receiveShadow = true;
    group.add(hill);

    const monolith = new THREE.Mesh(sharedBoxGeo, rockMat);
    monolith.scale.set(w * 0.3, h * 1.4, d * 0.3);
    monolith.position.set(x, h + h * 0.7, z);
    monolith.castShadow = true;
    group.add(monolith);
  }

  return group;
}

export function createVoxelCastle(castleLevel: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'VoxelCastle';

  const eraIndex = Math.min(9, Math.floor(castleLevel / 10));
  const eraWallColors = [
    0x8b5a2b, 0x7c858e, 0x4a5568, 0x1e293b, 0x2563eb,
    0x0284c7, 0xd97706, 0x991b1b, 0x6d28d9, 0xf59e0b,
  ];
  const roofColors = [
    0x654321, 0x334155, 0xb45309, 0x7c3aed, 0x0ea5e9,
    0x38bdf8, 0xfbbf24, 0xef4444, 0xa855f7, 0xffe4e6,
  ];

  const wallMat = new THREE.MeshStandardMaterial({
    color: eraWallColors[eraIndex],
    roughness: Math.max(0.25, 0.75 - eraIndex * 0.05),
    metalness: Math.min(0.75, 0.1 + eraIndex * 0.07),
  });

  const roofMat = new THREE.MeshStandardMaterial({
    color: roofColors[eraIndex],
    roughness: 0.35,
    metalness: 0.45,
    emissive: eraIndex >= 5 ? roofColors[eraIndex] : 0x000000,
    emissiveIntensity: eraIndex >= 5 ? 0.28 : 0,
  });

  const baseScale = 1 + castleLevel * 0.025;
  const keepHeight = 3.6 + eraIndex * 0.75;

  const keep = new THREE.Mesh(sharedBoxGeo, wallMat);
  keep.scale.set(
    5.5 * Math.min(1.6, baseScale * 0.65),
    keepHeight,
    5.5 * Math.min(1.6, baseScale * 0.65)
  );
  keep.position.set(0, keepHeight / 2, 0);
  keep.castShadow = true;
  keep.receiveShadow = true;
  group.add(keep);

  const keepRoof = new THREE.Mesh(sharedConeGeo, roofMat);
  keepRoof.scale.set(
    5.2 * Math.min(1.6, baseScale * 0.65),
    2.8 + eraIndex * 0.3,
    5.2 * Math.min(1.6, baseScale * 0.65)
  );
  keepRoof.position.set(0, keepHeight + (2.8 + eraIndex * 0.3) / 2, 0);
  keepRoof.castShadow = true;
  group.add(keepRoof);

  const towerOffset = 5.5;
  const towerHeight = keepHeight * 0.82;
  const corners = [
    [-towerOffset, -towerOffset],
    [towerOffset, -towerOffset],
    [-towerOffset, towerOffset],
    [towerOffset, towerOffset],
  ];

  for (const [tx, tz] of corners) {
    const tower = new THREE.Mesh(sharedCylinderGeo, wallMat);
    tower.scale.set(2.2, towerHeight, 2.2);
    tower.position.set(tx, towerHeight / 2, tz);
    tower.castShadow = true;
    tower.receiveShadow = true;
    group.add(tower);

    const turretRoof = new THREE.Mesh(sharedConeGeo, roofMat);
    turretRoof.scale.set(2.4, 1.8, 2.4);
    turretRoof.position.set(tx, towerHeight + 0.9, tz);
    turretRoof.castShadow = true;
    group.add(turretRoof);
  }

  const wallHeight = towerHeight * 0.62;
  const wallConfigs = [
    { x: 0, z: -towerOffset, sx: towerOffset * 2, sz: 0.9 },
    { x: -towerOffset, z: 0, sx: 0.9, sz: towerOffset * 2 },
    { x: towerOffset, z: 0, sx: 0.9, sz: towerOffset * 2 },
    { x: -towerOffset * 0.6, z: towerOffset, sx: towerOffset * 0.8, sz: 0.9 },
    { x: towerOffset * 0.6, z: towerOffset, sx: towerOffset * 0.8, sz: 0.9 },
  ];
  for (const wc of wallConfigs) {
    const wall = new THREE.Mesh(sharedBoxGeo, wallMat);
    wall.scale.set(wc.sx, wallHeight, wc.sz);
    wall.position.set(wc.x, wallHeight / 2, wc.z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);
  }

  if (eraIndex >= 4) {
    const halo = new THREE.Mesh(sharedTorusGeo, roofMat);
    halo.scale.setScalar(4.8);
    halo.rotation.x = Math.PI / 2;
    halo.position.set(0, keepHeight + 3.2, 0);
    halo.name = 'CitadelHalo';
    group.add(halo);
  }

  return group;
}

export function createPlayerMesh(highestRealmIndex: number, isRedName: boolean): THREE.Group {
  const group = new THREE.Group();
  group.name = 'PlayerCultivator';

  const auraSpec = getCultivationAuraVisualSpec(highestRealmIndex);

  const robeMat = new THREE.MeshStandardMaterial({
    color: isRedName ? 0x991b1b : 0x1d4ed8,
    roughness: 0.4,
    metalness: 0.3,
  });
  const torso = new THREE.Mesh(sharedBoxGeo, robeMat);
  torso.scale.set(0.75, 1.15, 0.45);
  torso.position.y = 0.95;
  torso.castShadow = true;
  group.add(torso);

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    roughness: 0.25,
    metalness: 0.8,
  });
  const leftPauldron = new THREE.Mesh(sharedBoxGeo, goldMat);
  leftPauldron.scale.set(0.32, 0.26, 0.52);
  leftPauldron.position.set(-0.52, 1.42, 0);
  group.add(leftPauldron);

  const rightPauldron = new THREE.Mesh(sharedBoxGeo, goldMat);
  rightPauldron.scale.set(0.32, 0.26, 0.52);
  rightPauldron.position.set(0.52, 1.42, 0);
  group.add(rightPauldron);

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.55 });
  const head = new THREE.Mesh(sharedBoxGeo, skinMat);
  head.scale.set(0.52, 0.52, 0.52);
  head.position.set(0, 1.82, 0);
  head.castShadow = true;
  group.add(head);

  const crown = new THREE.Mesh(sharedCylinderGeo, goldMat);
  crown.scale.set(0.28, 0.25, 0.28);
  crown.position.set(0, 2.18, 0);
  group.add(crown);

  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.5,
    roughness: 0.2,
    metalness: 0.85,
  });
  const sword = new THREE.Mesh(sharedBoxGeo, bladeMat);
  sword.scale.set(0.1, 1.25, 0.18);
  sword.position.set(0.62, 1.15, 0.35);
  sword.rotation.x = Math.PI / 5;
  sword.name = 'SpiritSword';
  group.add(sword);

  if (highestRealmIndex >= 1 || isRedName) {
    const auraColor = isRedName ? 0xef4444 : new THREE.Color(auraSpec.primaryColorHex).getHex();
    const auraRingMat = new THREE.MeshStandardMaterial({
      color: auraColor,
      emissive: auraColor,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.75,
    });
    const auraRing = new THREE.Mesh(sharedTorusGeo, auraRingMat);
    auraRing.rotation.x = Math.PI / 2;
    auraRing.position.y = 0.08;
    auraRing.scale.setScalar(1.4);
    auraRing.name = 'AuraRing';
    group.add(auraRing);
  }

  if (auraSpec.hasTranslucentChestCore || highestRealmIndex >= 2) {
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.9,
      roughness: 0.1,
      metalness: 0.9,
    });
    const goldenCore = new THREE.Mesh(sharedSphereGeo, coreMat);
    goldenCore.scale.setScalar(0.32);
    goldenCore.position.set(0, 1.1, 0.45);
    goldenCore.name = 'GoldenCoreOrb';
    group.add(goldenCore);
  }

  if (auraSpec.hasFloatingBabyAvatar || highestRealmIndex >= 3) {
    const nascentMat = new THREE.MeshStandardMaterial({
      color: 0xc084fc,
      emissive: 0x9333ea,
      emissiveIntensity: 0.75,
      transparent: true,
      opacity: 0.82,
    });
    const nascentBaby = new THREE.Mesh(sharedSphereGeo, nascentMat);
    nascentBaby.scale.set(0.35, 0.48, 0.35);
    nascentBaby.position.set(-0.75, 2.25, -0.25);
    nascentBaby.name = 'NascentSoulAvatar';
    group.add(nascentBaby);
  }

  if (auraSpec.haloCount > 0 || highestRealmIndex >= 8) {
    const daoMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfbbf24,
      emissiveIntensity: 1.0,
    });
    const daoHalo = new THREE.Mesh(sharedTorusGeo, daoMat);
    daoHalo.scale.setScalar(1.65);
    daoHalo.position.set(0, 2.1, -0.35);
    daoHalo.name = 'DaoCreatorHalo';
    group.add(daoHalo);
  }

  return group;
}

export function createMonsterMesh(monster: MonsterTarget): THREE.Group {
  const group = new THREE.Group();
  group.name = `Monster_${monster.id}`;

  const tierColors: Record<MonsterTarget['tier'], number> = {
    minion: 0x16a34a,
    elite: 0x2563eb,
    boss: 0xd97706,
    world_titan: 0x9333ea,
  };
  const scale =
    monster.tier === 'world_titan'
      ? 1.9
      : monster.tier === 'boss'
        ? 1.45
        : monster.tier === 'elite'
          ? 1.18
          : 0.95;

  const bodyMat = new THREE.MeshStandardMaterial({
    color: tierColors[monster.tier],
    roughness: 0.5,
    metalness: 0.25,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xff2222,
    emissive: 0xff0000,
    emissiveIntensity: 0.9,
  });
  const hornMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.3,
    metalness: 0.5,
  });

  const body = new THREE.Mesh(sharedBoxGeo, bodyMat);
  body.scale.set(0.95 * scale, 0.9 * scale, 1.2 * scale);
  body.position.y = 0.65 * scale;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(sharedBoxGeo, bodyMat);
  head.scale.set(0.75 * scale, 0.68 * scale, 0.75 * scale);
  head.position.set(0, 1.15 * scale, 0.55 * scale);
  head.castShadow = true;
  group.add(head);

  const leftEye = new THREE.Mesh(sharedBoxGeo, eyeMat);
  leftEye.scale.set(0.14 * scale, 0.1 * scale, 0.1 * scale);
  leftEye.position.set(-0.2 * scale, 1.22 * scale, 0.93 * scale);
  group.add(leftEye);

  const rightEye = new THREE.Mesh(sharedBoxGeo, eyeMat);
  rightEye.scale.set(0.14 * scale, 0.1 * scale, 0.1 * scale);
  rightEye.position.set(0.2 * scale, 1.22 * scale, 0.93 * scale);
  group.add(rightEye);

  const leftHorn = new THREE.Mesh(sharedConeGeo, hornMat);
  leftHorn.scale.set(0.2 * scale, 0.55 * scale, 0.2 * scale);
  leftHorn.position.set(-0.28 * scale, 1.65 * scale, 0.5 * scale);
  group.add(leftHorn);

  const rightHorn = new THREE.Mesh(sharedConeGeo, hornMat);
  rightHorn.scale.set(0.2 * scale, 0.55 * scale, 0.2 * scale);
  rightHorn.position.set(0.28 * scale, 1.65 * scale, 0.5 * scale);
  group.add(rightHorn);

  const hpBg = new THREE.Mesh(sharedBoxGeo, new THREE.MeshBasicMaterial({ color: 0x1e293b }));
  hpBg.scale.set(1.2 * scale, 0.12, 0.08);
  hpBg.position.set(0, 2.05 * scale, 0);
  group.add(hpBg);

  const hpFill = new THREE.Mesh(sharedBoxGeo, new THREE.MeshBasicMaterial({ color: 0xef4444 }));
  hpFill.scale.set(1.18 * scale, 0.1, 0.1);
  hpFill.position.set(0, 2.05 * scale, 0.01);
  hpFill.name = 'HPBarFill';
  group.add(hpFill);

  group.position.set(monster.x, 0, monster.z);
  return group;
}

export function createNPCMesh(npc: NPCEntity): THREE.Group {
  const group = new THREE.Group();
  group.name = `NPC_${npc.id}`;

  const roleColors: Record<NPCEntity['role'], number> = {
    elder: 0xfacc15,
    guard: 0x3b82f6,
    blacksmith: 0xea580c,
    merchant: 0x10b981,
    marshal: 0xef4444,
    mystic: 0xa855f7,
  };

  const tunicMat = new THREE.MeshStandardMaterial({
    color: roleColors[npc.role] || 0x38bdf8,
    roughness: 0.55,
    metalness: 0.2,
  });
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xfde68a,
    roughness: 0.6,
  });

  const body = new THREE.Mesh(sharedBoxGeo, tunicMat);
  body.scale.set(0.62, 1.0, 0.42);
  body.position.y = 0.85;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(sharedBoxGeo, headMat);
  head.scale.set(0.45, 0.45, 0.45);
  head.position.set(0, 1.58, 0);
  head.castShadow = true;
  group.add(head);

  const hat = new THREE.Mesh(sharedConeGeo, tunicMat);
  hat.scale.set(0.85, 0.35, 0.85);
  hat.position.set(0, 1.9, 0);
  group.add(hat);

  group.position.set(npc.x, 0, npc.z);
  return group;
}

export function createResourceNodeMesh(node: WorldResourceNode): THREE.Group {
  const group = new THREE.Group();
  group.name = `Resource_${node.id}`;

  if (node.type === 'wood') {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 });
    const leavesMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.65 });
    const trunk = new THREE.Mesh(sharedCylinderGeo, trunkMat);
    trunk.scale.set(0.55, 1.6, 0.55);
    trunk.position.y = 0.8;
    trunk.castShadow = true;
    group.add(trunk);

    const canopy1 = new THREE.Mesh(sharedConeGeo, leavesMat);
    canopy1.scale.set(2.1, 1.8, 2.1);
    canopy1.position.y = 2.1;
    canopy1.castShadow = true;
    group.add(canopy1);

    const canopy2 = new THREE.Mesh(sharedConeGeo, leavesMat);
    canopy2.scale.set(1.6, 1.5, 1.6);
    canopy2.position.y = 3.0;
    canopy2.castShadow = true;
    group.add(canopy2);
  } else {
    const colorMap: Record<ResourceType, number> = {
      wood: 0x15803d,
      steel: 0x94a3b8,
      copper: 0xd97706,
      diamond: 0x38bdf8,
      grain: 0x4ade80,
      oil: 0x475569,
    };
    const col = colorMap[node.type] || 0x38bdf8;
    const mat = new THREE.MeshStandardMaterial({
      color: col,
      emissive: node.type === 'diamond' ? col : 0x000000,
      emissiveIntensity: node.type === 'diamond' ? 0.45 : 0,
      roughness: 0.25,
      metalness: 0.65,
    });
    for (let i = 0; i < 3; i++) {
      const crystal = new THREE.Mesh(sharedConeGeo, mat);
      crystal.scale.set(0.55, 1.3 - i * 0.25, 0.55);
      crystal.position.set((i - 1) * 0.35, (1.3 - i * 0.25) / 2, (i % 2) * 0.2);
      crystal.rotation.z = (i - 1) * 0.22;
      crystal.castShadow = true;
      group.add(crystal);
    }
  }

  group.position.set(node.x, 0, node.z);
  return group;
}

export function createProteinStructureMesh(residues: ProteinResiduePoint[]): THREE.Group {
  const group = new THREE.Group();
  group.name = 'BioscienceProteinStructure';

  if (residues.length === 0) return group;

  const scaleFactor = 4.2;
  const points: THREE.Vector3[] = [];

  for (const r of residues) {
    const pos = new THREE.Vector3(r.x * scaleFactor, r.y * scaleFactor, r.z * scaleFactor);
    points.push(pos);

    const plddtInfo = getAlphaFoldPlddtColor(r.plddt);
    const atomMat = new THREE.MeshStandardMaterial({
      color: plddtInfo.hexNumber,
      emissive: r.isMutationHotspot ? 0xef4444 : 0x000000,
      emissiveIntensity: r.isMutationHotspot ? 0.65 : 0,
      roughness: 0.25,
      metalness: 0.35,
    });
    const atom = new THREE.Mesh(sharedSphereGeo, atomMat);
    atom.scale.setScalar(r.isMutationHotspot ? 0.24 : 0.16);
    atom.position.copy(pos);
    group.add(atom);
  }

  if (points.length >= 2) {
    const curve = new THREE.CatmullRomCurve3(points);
    const tubeGeo = new THREE.TubeGeometry(curve, Math.min(200, points.length * 3), 0.045, 8, false);
    const tubeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.35,
      metalness: 0.4,
      transparent: true,
      opacity: 0.85,
    });
    const backbone = new THREE.Mesh(tubeGeo, tubeMat);
    group.add(backbone);
  }

  return group;
}
