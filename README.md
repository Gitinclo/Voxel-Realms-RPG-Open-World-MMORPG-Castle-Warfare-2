# Voxel Realms XR: Open World MMORPG & Castle Warfare

**Voxel Realms XR** is a spatial WebXR and 3D Open-World MMORPG & Castle Warfare simulation built with **Three.js**, **XR Blocks (`xrblocks`)**, **D3.js**, **Cloud Firestore**, and an **Express + Vite** full-stack architecture.

---

## ⚡ Sovereign Administration, GM, Admin & Moderator Control

- **Super Administrator / Grand Game Master (GM) / Lead Moderator**: `creatergame31@gmail.com`
- **Official Support & Moderation Contact**: [`mailto:creatergame31@gmail.com`](mailto:creatergame31@gmail.com)
- **Privileges & Access**:
  - **Global System Update (`Update All`)**: Instantaneous multi-system synchronization across Citadel Keep, Imperial Resources, T20 Immortal Legions, 4-Path Cultivation, D3.js Growth Chronicle, Heroes, Clan Alliance Tech, and World AI.
  - **GM Sovereign Cheats**: Toggle Immortal Godmode, +10.0M All Resources, +1.0M T20 Immortal Legions, and Instant Max Dao Ascension (Realm 23 · Dao Creator L9).
  - **Player Moderation Roster & Audit Trail**: Warn, Mute, Ban, Unban, and Pardon Red-Name PK Karma with immutable timestamps attributed to `creatergame31@gmail.com`.
  - **Direct GM Support Ticket Desk**: Players can submit Bug Reports, Ban Appeals, GM Assistance requests, and Moderator Escalations directly to `creatergame31@gmail.com` (persisted to Cloud Firestore `/support_tickets/{ticketId}`).
  - **Cloud Firestore Security Rules (`firestore.rules`)**: Hardware-enforced `isAdmin()` helper granting verified `creatergame31@gmail.com` full read/write/delete governance across `/saves/{uid}` and `/support_tickets/{ticketId}`.

---

## 🌟 Core Features & Architecture

### 1. Four-Path Immortal Cultivation & D3.js Growth Chronicle
- **23 Immortal Realms × 9 Layers**: Spans *Mortal Foundation*, *Immortal Ascension*, *Primordial Chaos*, and *Ultimate Origin* (up to **Dao Creator**).
- **Four Simultaneous Paths**:
  - **🌬️ Qi Essence (Spiritual Dao)**
  - **🩸 Sacred Body (Physical Vessel)**
  - **👁️ Divine Soul (Primordial Spirit)**
  - **🧠 Dao Heart / Mind (Comprehension & Inner Demon Immunity)**
- **Interactive D3.js Multi-Line & Area Chart (`src/modals/cultivationChart.ts`)**:
  - Renders player cultivation growth and path progression over secluded years (`Stage Score = RealmIndex × 9 + Layer`).
  - Displays Era milestone threshold bands (*Immortal Ascension*, *Primordial Chaos*, *Ultimate Origin*), path-specific data nodes, interactive hover tooltips, KPI summary badges, and a `+50y Secluded Meditation` action that dynamically appends snapshots.
- **Realm Suppression, Karma & Master-Disciple Economy**:
  - **Realm Suppression**: Higher realms exert exponential combat suppression (e.g., Golden Core deals `100x` damage against Qi Refinement).
  - **Red-Name PK Karma & Heavenly Retribution**: Unlawful PK lowers Karma, triggers stationary Celestial Lightning strikes, and applies a bounty until pardoned or absolved.
  - **Master & Disciple Lineage**: Proximity cultivation speed buffs (+50%), automatic Spirit Stone tribute funneling, and *Heaven Earth Sleeve* skill scroll transmission.

### 2. Citadel Keep (Lv. 1–100) & T1–T20 Combined-Arms Warfare
- **Procedural Voxel Citadel**: Scales visually across 6 architectural eras (*Frontier Timber Fort* → *Omniversal Sovereign Citadel*).
- **Combined-Arms Combat Triangle**:
  - **🛡️ Shieldbearers** counter **🏹 Shooters**
  - **🏹 Shooters** counter **💣 Bombers**
  - **💣 Bombers** counter **🛡️ Shieldbearers**
- **Tier 1 to Tier 20 Progression**: From Militia Recruits (T1) to Omniversal Sovereign Guards (T20).

### 3. Clan Alliance Territory Warfare & Synchronized Leaderboards
- **Alliance Outpost Sieges**: Rally clan legions to capture strategic outposts, earn War Score, and expand controlled sectors.
- **Alliance Tech Tree**: Upgrade *March Speed*, *Troop Attack*, *Castle Defense*, and *Resource Yield*.
- **Live Synchronized Global Rankings**: Dynamically sorts all Sovereign Lords by real-time combat power, synchronizes custom Lord Names and Clan Tags, and highlights the `GM/ADMIN (creatergame31@gmail.com)` badge.

### 4. Dynamic Weather, Autonomous World AI & Bioscience 3D PDB Viewer
- **Dynamic Weather Engine**: Cycles through *Clear Skies*, *Torrential Rain*, *Blazing Drought*, *Thunderstorm*, and *Dense Fog* with real-time shader uniforms and resource gathering modifiers.
- **Autonomous World AI Director (Lv. 1–1000)**: Simulates faction diplomacy, monster migrations, and procedural Radiant Quests.
- **AlphaFold / RCSB PDB 3D Molecular Structure Viewer**: Inspect real 3D protein structures (`TP53`, `BRCA1`, `EGFR`, `CRISPR-Cas9`) with UniProt, Ensembl, PubMed, and ChEMBL metadata.

### 5. Cloud Save, Google Workspace & Gemini Tactical Advisor
- **Firebase Cloud Persistence**: Save and load realm state to Cloud Firestore (`/saves/{uid}`) and dispatch support tickets (`/support_tickets/{ticketId}`).
- **Google Workspace Export**: One-click export of Realm Battle Chronicles to **Google Docs** and Economy Ledgers to **Google Sheets**.
- **Server-Side AI Tactical Advisor**: Powered by `@google/genai` via `/api/gemini/*` Express endpoints + real-time WebSocket voice streaming (`/api/live`).

---

## 📁 Project Structure

```text
├── README.md                          # Project documentation & architecture guide
├── index.html                         # WebXR & 2D HUD entry point
├── server.ts                          # Express + Vite backend & Gemini API routes
├── firestore.rules                    # Cloud Firestore rules (with creatergame31@gmail.com isAdmin())
├── firebase-blueprint.json            # Firestore schema definitions
├── security_spec.md                   # Firestore security specification
└── src/
    ├── index.ts                       # Main VoxelRealmsXRApp (xb.Script) & HUD controller
    ├── index.css                      # Global Tailwind CSS & spatial HUD styling
    ├── game/
    │   ├── adminModeration.ts         # GM/Admin/Moderator RBAC, leaderboard sync & support tickets
    │   ├── cultivationMath.ts         # 23 Realms × 9 Layers math, 4 paths, Karma & D3 history
    │   ├── math.ts                    # BigInt combat power, castle upgrades & T1-T20 troop tiers
    │   ├── clanMath.ts                # Alliance outpost siege & territory calculations
    │   ├── troopTraining.ts           # Barracks training & VIP discount math
    │   ├── dailyLogin.ts              # 7-day login streak & Veteran Scroll rewards
    │   ├── vipSubscription.ts         # Imperial VIP tiers (VIP 0 - VIP 5) & daily stipends
    │   ├── heroSkins.ts               # Mythic hero skins & multiplicative stat bonuses
    │   ├── weather.ts                 # Dynamic weather effects & gather rate modifiers
    │   ├── graphicsEngine.ts          # Cross-platform LOD, Uber-shader & post-processing policy
    │   ├── proceduralWorld.ts         # 3D Voxel terrain, castle, player, NPC & monster meshes
    │   ├── worldAI.ts                 # Autonomous World AI Director & radiant quest generator
    │   ├── bioscience.ts              # Biomedical target profiles (TP53, BRCA1, EGFR, Cas9)
    │   └── world3d.ts                 # 3D molecular ball-and-stick / ribbon mesh builder
    ├── modals/
    │   ├── originalModals.ts          # Interactive spatial drawer modals & GM Admin Console
    │   └── cultivationChart.ts        # D3.js Cultivation Growth & Path Progression chart
    └── services/
        ├── firebaseAndWorkspace.ts    # Firebase Auth, Firestore CRUD & Google Docs/Sheets export
        └── geminiClient.ts            # Client service for /api/gemini/* & WebSocket /api/live
```

---

## 🚀 Running & Testing Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Full-Stack Development Server (Port 3000)
```bash
npm run dev
```

### 3. Run the Unit Test Suite
All core game math, cultivation progression, D3 history snapshots, and `creatergame31@gmail.com` Admin/GM/Moderator permissions are unit-tested via Node's native test runner:
```bash
npx tsx --test src/game/*.test.ts
```

### 4. Production Build
```bash
npm run build
```
