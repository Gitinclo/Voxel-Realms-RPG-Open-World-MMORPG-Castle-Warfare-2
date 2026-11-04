export const SUPER_ADMIN_EMAIL = 'creatergame31@gmail.com';

export type AdminRoleTitle = 'Administration' | 'Grand GM' | 'Admin' | 'Lead Moderator';

export type ModerationActionType =
  | 'warn'
  | 'mute'
  | 'unmute'
  | 'ban'
  | 'unban'
  | 'pardon_karma'
  | 'grant_stipend';

export type SupportTicketCategory =
  | 'gm_assistance'
  | 'moderation_appeal'
  | 'bug_report'
  | 'security_alert';

export interface AdminPermissionMatrix {
  canExecuteGmCommands: boolean;
  canModeratePlayers: boolean;
  canBroadcastServerDecrees: boolean;
  canManageBountiesAndKarma: boolean;
  canInspectCloudSaves: boolean;
  canRespondToSupportTickets: boolean;
}

export interface AdminAccessProfile {
  accountEmail: string;
  normalizedEmail: string;
  isAuthorizedAdmin: boolean;
  isSuperAdmin: boolean;
  isGm: boolean;
  isModerator: boolean;
  roleBadge: string;
  roles: AdminRoleTitle[];
  permissions: AdminPermissionMatrix;
}

export interface AdminContactDirectoryProfile {
  primaryEmail: string;
  displayName: string;
  officialTitle: string;
  roles: AdminRoleTitle[];
  slaResponseWindow: string;
  channels: string[];
  mailtoHref: string;
}

export interface ModeratedPlayerRecord {
  id: string;
  lordName: string;
  clanTag: string;
  castleLevel: number;
  realmName: string;
  karmaValue: number;
  status: 'active' | 'muted' | 'suspended';
  warningsCount: number;
  lastModerationNote: string;
}

export interface ModerationAuditEntry {
  id: string;
  timestamp: number;
  actorEmail: string;
  targetPlayerId: string;
  targetLordName: string;
  action: ModerationActionType;
  reason: string;
  resultingStatus: 'active' | 'muted' | 'suspended';
}

export interface AdminSupportTicket {
  id: string;
  timestamp: number;
  recipientEmail: string;
  senderName: string;
  senderEmail: string;
  category: SupportTicketCategory;
  subject: string;
  message: string;
  status: 'open' | 'resolved';
  adminResolutionNote?: string;
  mailtoUrl: string;
}

export const ADMIN_MODERATOR_CONTACT_DIRECTORY: AdminContactDirectoryProfile = {
  primaryEmail: SUPER_ADMIN_EMAIL,
  displayName: 'Sovereign Creator & Lead GM',
  officialTitle: 'Sovereign Administration · Grand GM · Admin · Lead Moderator',
  roles: ['Administration', 'Grand GM', 'Admin', 'Lead Moderator'],
  slaResponseWindow: 'Priority 24/7 Sovereign Administration & GM Desk',
  channels: [
    'In-App GM & Moderator Ticket Desk',
    '1P Google Workspace Gmail Dispatch (creatergame31@gmail.com)',
    'Cloud Firestore /support_tickets Audit Log',
    'Direct Email (mailto:creatergame31@gmail.com)',
  ],
  mailtoHref: `mailto:${SUPER_ADMIN_EMAIL}?subject=${encodeURIComponent('[Voxel Realms GM/Admin Contact] Sovereign Inquiry')}`,
};

export const INITIAL_MODERATED_PLAYERS: ModeratedPlayerRecord[] = [
  {
    id: 'plyr_shadow_fiend',
    lordName: 'Malakor Bloodbane',
    clanTag: 'DREAD',
    castleLevel: 68,
    realmName: 'Soul Formation (化神境)',
    karmaValue: -4200,
    status: 'active',
    warningsCount: 1,
    lastModerationNote: 'Flagged for Red-Name Novice Zone PK griefing.',
  },
  {
    id: 'plyr_void_spammer',
    lordName: 'Xylar Voidwhisper',
    clanTag: 'ABYSS',
    castleLevel: 44,
    realmName: 'Nascent Soul (元婴境)',
    karmaValue: -850,
    status: 'muted',
    warningsCount: 2,
    lastModerationNote: 'World chat muted by Moderator for fraudulent spirit stone links.',
  },
  {
    id: 'plyr_jade_valkyrie',
    lordName: 'Seraphina Dawnstar',
    clanTag: 'VALOR',
    castleLevel: 85,
    realmName: 'Mahayana (大乘境)',
    karmaValue: 3200,
    status: 'active',
    warningsCount: 0,
    lastModerationNote: 'Honorable Alliance Marshal — clean record.',
  },
  {
    id: 'plyr_iron_shogun',
    lordName: 'Kaelen Ironwrath',
    clanTag: 'TITAN',
    castleLevel: 72,
    realmName: 'Body Integration (合体境)',
    karmaValue: -150,
    status: 'active',
    warningsCount: 0,
    lastModerationNote: 'Disputed Citadel Outpost #3 siege telemetry.',
  },
];

export function normalizeAccountEmail(email: string | null | undefined): string {
  return (email || '').trim().toLowerCase();
}

export function evaluateAdminModeratorAccess(
  accountEmail: string | null | undefined,
  sessionOverrideActive = false
): AdminAccessProfile {
  const normalized = normalizeAccountEmail(accountEmail);
  const matchesSuperAdmin = normalized === SUPER_ADMIN_EMAIL;
  const isAuthorizedAdmin = matchesSuperAdmin || Boolean(sessionOverrideActive);

  const permissions: AdminPermissionMatrix = {
    canExecuteGmCommands: isAuthorizedAdmin,
    canModeratePlayers: isAuthorizedAdmin,
    canBroadcastServerDecrees: isAuthorizedAdmin,
    canManageBountiesAndKarma: isAuthorizedAdmin,
    canInspectCloudSaves: isAuthorizedAdmin,
    canRespondToSupportTickets: isAuthorizedAdmin,
  };

  return {
    accountEmail: matchesSuperAdmin
      ? SUPER_ADMIN_EMAIL
      : (accountEmail || '').trim() || (sessionOverrideActive ? SUPER_ADMIN_EMAIL : 'guest@voxelrealms.local'),
    normalizedEmail: matchesSuperAdmin
      ? SUPER_ADMIN_EMAIL
      : normalized || (sessionOverrideActive ? SUPER_ADMIN_EMAIL : 'guest@voxelrealms.local'),
    isAuthorizedAdmin,
    isSuperAdmin: isAuthorizedAdmin,
    isGm: isAuthorizedAdmin,
    isModerator: isAuthorizedAdmin,
    roleBadge: isAuthorizedAdmin
      ? 'SOVEREIGN ADMIN / GM / MODERATOR'
      : 'STANDARD CULTIVATOR',
    roles: isAuthorizedAdmin
      ? ['Administration', 'Grand GM', 'Admin', 'Lead Moderator']
      : [],
    permissions,
  };
}

export function applyPlayerModerationAction(
  roster: ModeratedPlayerRecord[],
  targetPlayerId: string,
  action: ModerationActionType,
  actorEmail: string = SUPER_ADMIN_EMAIL,
  reason = 'Sovereign GM / Moderator enforcement action',
  nowMs: number = Date.now()
): {
  updatedRoster: ModeratedPlayerRecord[];
  auditEntry: ModerationAuditEntry | null;
} {
  let auditEntry: ModerationAuditEntry | null = null;
  const cleanActor = normalizeAccountEmail(actorEmail) || SUPER_ADMIN_EMAIL;

  const updatedRoster = roster.map((player) => {
    if (player.id !== targetPlayerId) return player;

    let nextStatus = player.status;
    let nextWarnings = player.warningsCount;
    let nextKarma = player.karmaValue;
    let nextCastleLevel = player.castleLevel;
    let note = reason;

    switch (action) {
      case 'warn':
        nextWarnings += 1;
        note = `[WARN #${nextWarnings} by ${cleanActor}] ${reason}`;
        break;
      case 'mute':
        nextStatus = 'muted';
        note = `[MUTED by ${cleanActor}] ${reason}`;
        break;
      case 'unmute':
        if (nextStatus === 'muted') nextStatus = 'active';
        note = `[UNMUTED by ${cleanActor}] ${reason}`;
        break;
      case 'ban':
        nextStatus = 'suspended';
        note = `[SUSPENDED by ${cleanActor}] ${reason}`;
        break;
      case 'unban':
        nextStatus = 'active';
        note = `[REINSTATED by ${cleanActor}] ${reason}`;
        break;
      case 'pardon_karma':
        nextKarma = Math.max(0, nextKarma);
        note = `[KARMA PARDONED by ${cleanActor}] Restored to righteous standing (0+ Karma).`;
        break;
      case 'grant_stipend':
        nextCastleLevel = Math.min(100, nextCastleLevel + 1);
        note = `[GM STIPEND by ${cleanActor}] Granted +1 Citadel Level & Sovereign Compensation.`;
        break;
    }

    auditEntry = {
      id: `mod_audit_${nowMs}_${player.id}`,
      timestamp: nowMs,
      actorEmail: cleanActor,
      targetPlayerId: player.id,
      targetLordName: player.lordName,
      action,
      reason: note,
      resultingStatus: nextStatus,
    };

    return {
      ...player,
      status: nextStatus,
      warningsCount: nextWarnings,
      karmaValue: nextKarma,
      castleLevel: nextCastleLevel,
      lastModerationNote: note,
    };
  });

  return { updatedRoster, auditEntry };
}

export function createContactSupportTicket(params: {
  senderName: string;
  senderEmail?: string;
  category: SupportTicketCategory;
  subject: string;
  message: string;
  timestamp?: number;
}): {
  ticket: AdminSupportTicket;
  gmailPayload: { to: string; subject: string; bodyText: string };
} {
  const now = params.timestamp ?? Date.now();
  const cleanSenderName = params.senderName.trim() || 'Sovereign Cultivator';
  const cleanSenderEmail = (params.senderEmail || '').trim() || 'player@voxelrealms.local';
  const cleanSubject = params.subject.trim() || 'Sovereign GM / Moderator Inquiry';
  const cleanMessage = params.message.trim() || 'Requesting GM / Moderator assistance.';

  const categoryLabels: Record<SupportTicketCategory, string> = {
    gm_assistance: 'GM In-Game Assistance',
    moderation_appeal: 'Moderation / Sanction Appeal',
    bug_report: 'Technical Bug / Exploit Report',
    security_alert: 'Account & Security Escalation',
  };

  const formattedSubject = `[Voxel Realms ${categoryLabels[params.category]}] ${cleanSubject}`;
  const formattedBody = [
    `To: ${SUPER_ADMIN_EMAIL} (Administration / GM / Admin / Moderator Control)`,
    `From: ${cleanSenderName} <${cleanSenderEmail}>`,
    `Category: ${categoryLabels[params.category]}`,
    `Timestamp: ${new Date(now).toISOString()}`,
    `----------------------------------------`,
    cleanMessage,
  ].join('\n');

  const mailtoUrl = `mailto:${SUPER_ADMIN_EMAIL}?subject=${encodeURIComponent(
    formattedSubject
  )}&body=${encodeURIComponent(formattedBody)}`;

  const ticket: AdminSupportTicket = {
    id: `ticket_${now}`,
    timestamp: now,
    recipientEmail: SUPER_ADMIN_EMAIL,
    senderName: cleanSenderName,
    senderEmail: cleanSenderEmail,
    category: params.category,
    subject: cleanSubject,
    message: cleanMessage,
    status: 'open',
    mailtoUrl,
  };

  return {
    ticket,
    gmailPayload: {
      to: SUPER_ADMIN_EMAIL,
      subject: formattedSubject,
      bodyText: formattedBody,
    },
  };
}

export function resolveSupportTicket(
  tickets: AdminSupportTicket[],
  ticketId: string,
  resolutionNote = `Resolved by Sovereign Admin (${SUPER_ADMIN_EMAIL})`
): AdminSupportTicket[] {
  return tickets.map((t) =>
    t.id === ticketId
      ? {
          ...t,
          status: 'resolved',
          adminResolutionNote: resolutionNote,
        }
      : t
  );
}

export interface SynchronizedLeaderboardRow {
  rank: number;
  name: string;
  lordName: string;
  clanTag: string;
  power: bigint;
  castleLevel: number;
  troopsTotal: bigint;
  monstersSlain: number;
  isPlayer?: boolean;
  adminBadge?: string;
}

export function computeSynchronizedLeaderboard(
  entries: Array<{
    rank: number;
    name?: string;
    lordName?: string;
    clanTag: string;
    power: bigint;
    castleLevel: number;
    troopsTotal?: bigint;
    monstersSlain?: number;
    isPlayer?: boolean;
  }>,
  livePlayer: {
    name: string;
    clanTag: string;
    power: bigint;
    castleLevel: number;
    troopsTotal: bigint;
    monstersSlain: number;
    isAuthorizedAdmin: boolean;
  }
): SynchronizedLeaderboardRow[] {
  const mapped: SynchronizedLeaderboardRow[] = entries.map((e) => {
    const isPlayer = Boolean(e.isPlayer);
    const resolvedName = isPlayer
      ? livePlayer.name
      : e.lordName || e.name || 'Sovereign Commander';
    return {
      rank: e.rank,
      name: resolvedName,
      lordName: resolvedName,
      clanTag: isPlayer ? livePlayer.clanTag : e.clanTag,
      power: isPlayer ? livePlayer.power : e.power,
      castleLevel: isPlayer ? livePlayer.castleLevel : e.castleLevel,
      troopsTotal: isPlayer ? livePlayer.troopsTotal : e.troopsTotal ?? 0n,
      monstersSlain: isPlayer ? livePlayer.monstersSlain : e.monstersSlain ?? 0,
      isPlayer,
      adminBadge:
        isPlayer && livePlayer.isAuthorizedAdmin
          ? `GM/ADMIN (${SUPER_ADMIN_EMAIL})`
          : undefined,
    };
  });

  mapped.sort((a, b) => (b.power > a.power ? 1 : b.power < a.power ? -1 : 0));
  return mapped.map((row, idx) => ({
    ...row,
    rank: idx + 1,
  }));
}

export interface GlobalSystemUpdateSummary {
  newUpdateVersion: number;
  updatedCastleLevel: number;
  updatedRealmIndex: number;
  resourcesGrantedEach: bigint;
  legionsReinforcedEach: bigint;
  timestampIso: string;
  summaryBanner: string;
}

export function summarizeGlobalSystemUpdate(params: {
  previousUpdateVersion: number;
  currentCastleLevel: number;
  currentRealmIndex: number;
  nowMs?: number;
}): GlobalSystemUpdateSummary {
  const nextVer = (params.previousUpdateVersion || 1) + 1;
  const nextCastle = Math.min(100, params.currentCastleLevel + 5);
  const nextRealm = Math.min(22, params.currentRealmIndex + 1);
  const resGrant = 5_000_000n;
  const troopGrant = 250_000n;
  const iso = new Date(params.nowMs ?? Date.now()).toISOString();

  return {
    newUpdateVersion: nextVer,
    updatedCastleLevel: nextCastle,
    updatedRealmIndex: nextRealm,
    resourcesGrantedEach: resGrant,
    legionsReinforcedEach: troopGrant,
    timestampIso: iso,
    summaryBanner: `🔄 [SYSTEM UPDATE v${nextVer}.0 · ${SUPER_ADMIN_EMAIL}] Citadel Lv.${nextCastle}, 4-Path Cultivation + D3 Analytics, Legions, Heroes, Clan Tech & Rankings Synchronized!`,
  };
}

