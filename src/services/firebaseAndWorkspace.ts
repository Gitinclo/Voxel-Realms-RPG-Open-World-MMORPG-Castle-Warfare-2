/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  User,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/presentations',
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/chat.spaces.readonly',
  'https://www.googleapis.com/auth/chat.messages',
  'https://www.googleapis.com/auth/forms.body',
  'https://www.googleapis.com/auth/forms.responses.readonly',
  'https://www.googleapis.com/auth/meetings.space.created',
  'https://www.googleapis.com/auth/meetings.space.readonly',
  'https://www.googleapis.com/auth/contacts.readonly',
];

const provider = new GoogleAuthProvider();
for (const scope of WORKSPACE_SCOPES) {
  provider.addScope(scope);
}

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'realm_saves', 'connection_probe'));
  } catch {
    // Expected when unauthenticated or in offline preview
  }
}

export function initAuth(
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void,
) {
  void testFirestoreConnection();
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      if (!isSigningIn) {
        cachedAccessToken = null;
      }
      if (onAuthFailure) onAuthFailure();
    }
  });
}

export async function googleSignIn(): Promise<{ user: User; accessToken: string } | null> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
}

export function getAccessToken(): string | null {
  return cachedAccessToken;
}

export async function logout(): Promise<void> {
  await auth.signOut();
  cachedAccessToken = null;
}

export interface RealmCloudSavePayload {
  lordName: string;
  clanTag: string;
  castleLevel: number;
  cultivationRealmIndex: number;
  cultivationLayer: number;
  karmaValue: number;
  powerRatingStr: string;
  stateJson: string;
}

export async function saveRealmStateToFirestore(payload: RealmCloudSavePayload): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in with Google first to save your realm to Firestore.');
  const path = `realm_saves/${user.uid}`;
  const docRef = doc(db, 'realm_saves', user.uid);

  const safePayload = {
    ownerId: user.uid.slice(0, 128),
    lordName: payload.lordName.slice(0, 60) || 'Aiden Skyrender',
    clanTag: payload.clanTag.replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'VALOR',
    castleLevel: Math.max(0, Math.min(100, Math.floor(payload.castleLevel))),
    cultivationRealmIndex: Math.max(0, Math.min(22, Math.floor(payload.cultivationRealmIndex))),
    cultivationLayer: Math.max(1, Math.min(9, Math.floor(payload.cultivationLayer))),
    karmaValue: Math.max(-1000000, Math.min(1000000, Math.floor(payload.karmaValue))),
    powerRatingStr: payload.powerRatingStr.slice(0, 64),
    stateJson: payload.stateJson.slice(0, 20000),
  };

  try {
    const existingSnap = await getDoc(docRef);
    if (!existingSnap.exists()) {
      await setDoc(docRef, {
        ...safePayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(
        docRef,
        {
          ...safePayload,
          createdAt: existingSnap.data().createdAt,
          updatedAt: serverTimestamp(),
        },
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function loadRealmStateFromFirestore(): Promise<RealmCloudSavePayload | null> {
  const user = auth.currentUser;
  if (!user) return null;
  const path = `realm_saves/${user.uid}`;
  try {
    const snap = await getDoc(doc(db, 'realm_saves', user.uid));
    if (!snap.exists()) return null;
    return snap.data() as RealmCloudSavePayload;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function appendBattleChronicleToFirestore(title: string, summary: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  const chronicleId = `chr_${Date.now()}`;
  const path = `realm_saves/${user.uid}/chronicles/${chronicleId}`;
  try {
    await setDoc(doc(db, 'realm_saves', user.uid, 'chronicles', chronicleId), {
      ownerId: user.uid,
      title: title.slice(0, 140),
      summary: summary.slice(0, 2000),
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function listBattleChroniclesFromFirestore(): Promise<
  Array<{ id: string; title: string; summary: string }>
> {
  const user = auth.currentUser;
  if (!user) return [];
  const path = `realm_saves/${user.uid}/chronicles`;
  try {
    const q = query(collection(db, 'realm_saves', user.uid, 'chronicles'), where('ownerId', '==', user.uid));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      title: String(d.data().title || ''),
      summary: String(d.data().summary || ''),
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

// ============================================================================
// 1P GOOGLE WORKSPACE INTEGRATIONS (12 SERVICES)
// ============================================================================

async function workspaceFetch(url: string, init: RequestInit = {}): Promise<any> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Google Workspace access token missing. Please click "Sign in with Google" first.');
  }
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Workspace API (${res.status}): ${text.slice(0, 240)}`);
  }
  return res.json();
}

export async function listGoogleDriveFiles(): Promise<Array<{ id: string; name: string; mimeType: string }>> {
  const data = await workspaceFetch(
    'https://www.googleapis.com/drive/v3/files?pageSize=8&fields=files(id,name,mimeType)',
  );
  return data.files || [];
}

export async function createGoogleDocChronicle(title: string, bodyText: string): Promise<{ documentId: string; title: string }> {
  const docData = await workspaceFetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
  await workspaceFetch(`https://docs.googleapis.com/v1/documents/${docData.documentId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [{ insertText: { location: { index: 1 }, text: bodyText } }],
    }),
  });
  return { documentId: docData.documentId, title: docData.title };
}

export async function createGoogleSheetLedger(
  title: string,
  rows: Array<Array<string | number>>,
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const sheet = await workspaceFetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    body: JSON.stringify({ properties: { title } }),
  });
  await workspaceFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheet.spreadsheetId}/values/A1:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      body: JSON.stringify({ values: rows }),
    },
  );
  return {
    spreadsheetId: sheet.spreadsheetId,
    spreadsheetUrl: sheet.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${sheet.spreadsheetId}`,
  };
}

export async function createGoogleSlidesDeck(title: string): Promise<{ presentationId: string }> {
  const pres = await workspaceFetch('https://slides.googleapis.com/v1/presentations', {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
  return { presentationId: pres.presentationId };
}

export async function scheduleCalendarSiegeRally(summary: string, description: string): Promise<{ htmlLink: string }> {
  const start = new Date(Date.now() + 3600_000).toISOString();
  const end = new Date(Date.now() + 7200_000).toISOString();
  const ev = await workspaceFetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      body: JSON.stringify({
        summary,
        description,
        start: { dateTime: start },
        end: { dateTime: end },
      }),
    },
  );
  return { htmlLink: ev.htmlLink || 'https://calendar.google.com' };
}

export async function createGoogleTaskQuest(title: string, notes: string): Promise<{ id: string; title: string }> {
  const task = await workspaceFetch('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks', {
    method: 'POST',
    body: JSON.stringify({ title, notes }),
  });
  return { id: task.id, title: task.title };
}

export async function listGmailDispatches(): Promise<Array<{ id: string; snippet: string }>> {
  const list = await workspaceFetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=4');
  const messages = list.messages || [];
  const details: Array<{ id: string; snippet: string }> = [];
  for (const m of messages.slice(0, 3)) {
    const msg = await workspaceFetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=minimal`);
    details.push({ id: m.id, snippet: msg.snippet || '(No snippet)' });
  }
  return details;
}

export async function sendGmailDispatch(to: string, subject: string, bodyText: string): Promise<{ id: string }> {
  const rawMime = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    bodyText,
  ].join('\r\n');
  const encoded = btoa(unescape(encodeURIComponent(rawMime)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return workspaceFetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    body: JSON.stringify({ raw: encoded }),
  });
}

export async function createGoogleFormRecruitment(title: string): Promise<{ formId: string; responderUri: string }> {
  const form = await workspaceFetch('https://forms.googleapis.com/v1/forms', {
    method: 'POST',
    body: JSON.stringify({ info: { title, documentTitle: title } }),
  });
  return { formId: form.formId, responderUri: form.responderUri || '' };
}

export async function createGoogleMeetWarRoom(): Promise<{ meetingUri: string; name: string }> {
  const space = await workspaceFetch('https://meet.googleapis.com/v2/spaces', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  return { meetingUri: space.meetingUri || 'https://meet.google.com', name: space.name || 'spaces/war-room' };
}

export async function listGoogleChatSpaces(): Promise<Array<{ name: string; displayName: string }>> {
  const data = await workspaceFetch('https://chat.googleapis.com/v1/spaces?pageSize=5');
  return data.spaces || [];
}

export async function listGoogleKeepNotes(): Promise<Array<{ name: string; title: string }>> {
  const data = await workspaceFetch('https://keep.googleapis.com/v1/notes?pageSize=5');
  return data.notes || [];
}

export async function listGoogleContactsAllies(): Promise<Array<{ name: string; email: string }>> {
  const data = await workspaceFetch(
    'https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses&pageSize=6',
  );
  return (data.connections || []).map((c: any) => ({
    name: c.names?.[0]?.displayName || 'Allied Commander',
    email: c.emailAddresses?.[0]?.value || '',
  }));
}
