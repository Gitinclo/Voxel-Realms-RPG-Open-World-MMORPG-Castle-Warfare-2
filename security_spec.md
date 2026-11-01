# Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **Ownership & Path Binding (`RealmSave`)**: A `/realm_saves/{saveId}` document can only be read, created, updated, or deleted by the authenticated, email-verified user whose `request.auth.uid == saveId` AND `incoming().ownerId == request.auth.uid`.
2. **Master Gate Relational Sync (`BattleChronicle`)**: A `/realm_saves/{saveId}/chronicles/{chronicleId}` document can only be accessed or mutated if the parent `/realm_saves/{saveId}` document exists (`exists(...)`) and its `ownerId == request.auth.uid`.
3. **Immutable Fields**: `ownerId` and `createdAt` can never change during an `update`.
4. **Temporal Integrity**: `createdAt` must equal `request.time` on `create`, and `updatedAt` must equal `request.time` on `create` and `update`.
5. **Terminal State Locking**: Once a `BattleChronicle` reaches `status == 'archived'`, no further updates are permitted.

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated Write**: `auth = null` attempting to create `/realm_saves/user_1`.
2. **Unverified Email Spoof**: `auth = { uid: 'user_1', token: { email_verified: false } }` attempting to write `/realm_saves/user_1`.
3. **Cross-User Identity Spoofing**: `auth.uid = 'user_attacker'` setting `ownerId: 'user_victim'` on `/realm_saves/user_victim`.
4. **Shadow Field Injection (Create)**: Adding `"isAdmin": true` to `/realm_saves/user_1`.
5. **Shadow Field Injection (Update)**: Modifying an unlisted field `"hacked": 1` during an update to `/realm_saves/user_1`.
6. **Out-of-Bounds Castle Level**: Setting `castleLevel: 999` (must be `0 <= castleLevel <= 100`).
7. **Out-of-Bounds Cultivation Realm**: Setting `cultivationRealmIndex: 99` (must be `0 <= cultivationRealmIndex <= 22`).
8. **Payload Bloat / Denial of Wallet**: Sending a 50,000-character `stateJson` string (exceeding `maxLength: 20000`).
9. **Client Timestamp Forgery**: Providing a past/future `createdAt` or `updatedAt` instead of `request.time`.
10. **Immutable Field Mutation**: Changing `createdAt` or `ownerId` during `update`.
11. **Orphaned Subcollection Write**: Creating `/realm_saves/nonexistent_user/chronicles/c1` when `/realm_saves/nonexistent_user` does not exist.
12. **Terminal State Re-opening**: Updating `/realm_saves/user_1/chronicles/c1` after `existing().status == 'archived'`.
