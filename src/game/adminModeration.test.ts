import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ADMIN_MODERATOR_CONTACT_DIRECTORY,
  INITIAL_MODERATED_PLAYERS,
  SUPER_ADMIN_EMAIL,
  applyPlayerModerationAction,
  computeSynchronizedLeaderboard,
  createContactSupportTicket,
  evaluateAdminModeratorAccess,
  resolveSupportTicket,
  summarizeGlobalSystemUpdate,
} from './adminModeration';

describe('Admin, GM, and Moderator Control & Contact (creatergame31@gmail.com)', () => {
  it('recognizes creatergame31@gmail.com as Super Admin, Grand GM, Admin, and Lead Moderator', () => {
    const profile = evaluateAdminModeratorAccess('creatergame31@gmail.com');
    assert.equal(profile.isAuthorizedAdmin, true);
    assert.equal(profile.isSuperAdmin, true);
    assert.equal(profile.isGm, true);
    assert.equal(profile.isModerator, true);
    assert.equal(profile.accountEmail, 'creatergame31@gmail.com');
    assert.deepEqual(profile.roles, ['Administration', 'Grand GM', 'Admin', 'Lead Moderator']);
    assert.equal(profile.permissions.canExecuteGmCommands, true);
    assert.equal(profile.permissions.canModeratePlayers, true);
    assert.equal(profile.permissions.canBroadcastServerDecrees, true);
    assert.equal(profile.permissions.canManageBountiesAndKarma, true);
    assert.equal(profile.permissions.canInspectCloudSaves, true);
    assert.equal(profile.permissions.canRespondToSupportTickets, true);
  });

  it('normalizes case and whitespace when verifying creatergame31@gmail.com', () => {
    const profile = evaluateAdminModeratorAccess('  CreaterGame31@GMAIL.com ');
    assert.equal(profile.isAuthorizedAdmin, true);
    assert.equal(profile.normalizedEmail, SUPER_ADMIN_EMAIL);
  });

  it('denies admin privileges to non-admin emails when session override is off', () => {
    const guest = evaluateAdminModeratorAccess('randomplayer@example.com', false);
    assert.equal(guest.isAuthorizedAdmin, false);
    assert.equal(guest.permissions.canModeratePlayers, false);
    assert.equal(guest.roles.length, 0);
  });

  it('exposes official contact directory bound to creatergame31@gmail.com', () => {
    assert.equal(ADMIN_MODERATOR_CONTACT_DIRECTORY.primaryEmail, 'creatergame31@gmail.com');
    assert.ok(ADMIN_MODERATOR_CONTACT_DIRECTORY.mailtoHref.startsWith('mailto:creatergame31@gmail.com'));
    assert.ok(ADMIN_MODERATOR_CONTACT_DIRECTORY.roles.includes('Administration'));
    assert.ok(ADMIN_MODERATOR_CONTACT_DIRECTORY.roles.includes('Lead Moderator'));
  });

  it('applies mute, ban, pardon_karma, and warn moderation actions with audit trail', () => {
    const targetId = INITIAL_MODERATED_PLAYERS[0].id;

    const mutedRes = applyPlayerModerationAction(
      INITIAL_MODERATED_PLAYERS,
      targetId,
      'mute',
      'creatergame31@gmail.com',
      'Spamming global channel',
      1700000000000
    );
    const mutedPlayer = mutedRes.updatedRoster.find((p) => p.id === targetId)!;
    assert.equal(mutedPlayer.status, 'muted');
    assert.equal(mutedRes.auditEntry?.actorEmail, 'creatergame31@gmail.com');
    assert.equal(mutedRes.auditEntry?.action, 'mute');

    const pardonRes = applyPlayerModerationAction(
      mutedRes.updatedRoster,
      targetId,
      'pardon_karma',
      'creatergame31@gmail.com',
      'GM Pardon',
      1700000005000
    );
    const pardonedPlayer = pardonRes.updatedRoster.find((p) => p.id === targetId)!;
    assert.equal(pardonedPlayer.karmaValue, 0);

    const banRes = applyPlayerModerationAction(
      pardonRes.updatedRoster,
      targetId,
      'ban',
      'creatergame31@gmail.com',
      'Severe ToS violation',
      1700000010000
    );
    assert.equal(banRes.updatedRoster.find((p) => p.id === targetId)?.status, 'suspended');
  });

  it('creates and resolves support contact tickets addressed to creatergame31@gmail.com', () => {
    const { ticket, gmailPayload } = createContactSupportTicket({
      senderName: 'Aiden Skyrender',
      senderEmail: 'aiden@valor.org',
      category: 'gm_assistance',
      subject: 'Missing Outpost Siege Chest',
      message: 'We captured Outpost #2 but did not receive the clan honor chest.',
      timestamp: 1700000100000,
    });

    assert.equal(ticket.recipientEmail, 'creatergame31@gmail.com');
    assert.equal(gmailPayload.to, 'creatergame31@gmail.com');
    assert.ok(gmailPayload.subject.includes('Missing Outpost Siege Chest'));
    assert.ok(ticket.mailtoUrl.startsWith('mailto:creatergame31@gmail.com'));
    assert.equal(ticket.status, 'open');

    const resolvedList = resolveSupportTicket([ticket], ticket.id, 'Granted chest via GM Console');
    assert.equal(resolvedList[0].status, 'resolved');
    assert.equal(resolvedList[0].adminResolutionNote, 'Granted chest via GM Console');
  });

  it('synchronizes and re-ranks the global leaderboard with live player power and creatergame31@gmail.com badge', () => {
    const entries = [
      { rank: 1, name: 'Lord Chronos', clanTag: 'TITAN', power: 500_000n, castleLevel: 50 },
      { rank: 2, name: 'Aiden Skyrender', clanTag: 'VALOR', power: 100_000n, castleLevel: 12, isPlayer: true },
    ];
    const synced = computeSynchronizedLeaderboard(entries, {
      name: 'Aiden Skyrender',
      clanTag: 'VALOR',
      power: 999_999_999n,
      castleLevel: 88,
      troopsTotal: 5_000_000n,
      monstersSlain: 99,
      isAuthorizedAdmin: true,
    });

    assert.equal(synced[0].isPlayer, true);
    assert.equal(synced[0].rank, 1);
    assert.equal(synced[0].lordName, 'Aiden Skyrender');
    assert.equal(synced[0].castleLevel, 88);
    assert.ok(synced[0].adminBadge?.includes('creatergame31@gmail.com'));
    assert.equal(synced[1].rank, 2);
    assert.equal(synced[1].lordName, 'Lord Chronos');
  });

  it('computes deterministic global system update telemetry', () => {
    const summary = summarizeGlobalSystemUpdate({
      previousUpdateVersion: 1,
      currentCastleLevel: 12,
      currentRealmIndex: 3,
      nowMs: 1700000000000,
    });
    assert.equal(summary.newUpdateVersion, 2);
    assert.equal(summary.updatedCastleLevel, 17);
    assert.equal(summary.updatedRealmIndex, 4);
    assert.ok(summary.summaryBanner.includes('creatergame31@gmail.com'));
  });
});

