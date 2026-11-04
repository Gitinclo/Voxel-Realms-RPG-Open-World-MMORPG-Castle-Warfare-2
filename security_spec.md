# Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **Bootstrapped Super Admin / GM / Moderator (`isAdmin()`)**: The verified account `creatergame31@gmail.com` (`request.auth.token.email_verified == true && request.auth.token.email == 'creatergame31@gmail.com'`) or a UID present in `/admins/{uid}` holds Sovereign Administration, GM, and Moderator privileges across `/realm_saves`, `/chronicles`, and `/support_tickets`.
2. **Ownership & Path Binding (`RealmSave`)**: A `/realm_saves/{saveId}` document can only be read, created, updated, or deleted by the authenticated, email-verified user whose `request.auth.uid == saveId` AND `incoming().ownerId == request.auth.uid`, or inspected/moderated by `isAdmin()`.
3. **Master Gate Relational Sync (`BattleChronicle`)**: A `/realm_saves/{saveId}/chronicles/{chronicleId}` document can only be accessed or mutated if the parent `/realm_saves/{saveId}` document exists (`exists(...)`) and its `ownerId == request.auth.uid` (or by `isAdmin()`).
4. **Support & Contact Dispatch (`SupportTicket`)**: A `/support_tickets/{ticketId}` document must target `recipientEmail == 'creatergame31@gmail.com'`, bind `ownerId == request.auth.uid` on creation with `status == 'open'`, and can be listed/resolved by `isAdmin()`.
5. **Immutable Fields**: `ownerId` and `createdAt` can never change during an `update`.
6. **Temporal Integrity**: `createdAt` must equal `request.time` on `create`, and `updatedAt` must equal `request.time` on `create` and `update`.
7. **Terminal State Locking**: Once a `BattleChronicle` reaches `status == 'archived'` or a `SupportTicket` reaches `status == 'resolved'`, no further updates are permitted.

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated Write**: `auth = null` attempting to create `/realm_saves/user_1`.
2. **Unverified Email Spoof**: `auth = { uid: 'admin_1', token: { email: 'creatergame31@gmail.com', email_verified: false } }` attempting to invoke `isAdmin()` or write `/realm_saves/user_1`.
3. **Cross-User Identity Spoofing**: `auth.uid = 'user_attacker'` setting `ownerId: 'user_victim'` on `/realm_saves/user_victim`.
4. **Shadow Field Injection (Create)**: Adding `"isAdmin": true` to `/realm_saves/user_1`.
5. **Shadow Field Injection (Update)**: Modifying an unlisted field `"hacked": 1` during an update to `/realm_saves/user_1`.
6. **Out-of-Bounds Castle Level**: Setting `castleLevel: 999` (must be `0 <= castleLevel <= 100`).
7. **Out-of-Bounds Cultivation Realm**: Setting `cultivationRealmIndex: 99` (must be `0 <= cultivationRealmIndex <= 22`).
8. **Payload Bloat / Denial of Wallet**: Sending a 50,000-character `stateJson` string (exceeding `maxLength: 20000`).
9. **Client Timestamp Forgery**: Providing a past/future `createdAt` or `updatedAt` instead of `request.time`.
10. **Immutable Field Mutation**: Changing `createdAt` or `ownerId` during `update`.
11. **Orphaned Subcollection Write**: Creating `/realm_saves/nonexistent_user/chronicles/c1` when `/realm_saves/nonexistent_user` does not exist.
12. **Terminal State Re-opening**: Updating `/realm_saves/user_1/chronicles/c1` after `existing().status == 'archived'` or `/support_tickets/t1` after `existing().status == 'resolved'`.
