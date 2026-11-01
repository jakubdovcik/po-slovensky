// Accounts and sync via Supabase (auth + one "profiles" row per user, protected by
// row-level security). Talks to the REST API directly, so there's no library to load.
// The phone stays the source of truth: the app works fully offline and merges with
// the cloud copy whenever it can.

import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { state, save, currentProfileId, mergeStates, replaceState, onSave } from './store.js';

const sessionKey = () => 'poslovensky.session.' + currentProfileId();

export function session() {
  try { return JSON.parse(localStorage.getItem(sessionKey())); } catch { return null; }
}
function setSession(s) {
  try { s ? localStorage.setItem(sessionKey(), JSON.stringify(s)) : localStorage.removeItem(sessionKey()); } catch { /* ignore */ }
}
export const signedIn = () => !!session();
export const userEmail = () => session()?.user?.email || '';
export const lastSync = () => session()?.lastSync || 0;

let listeners = [];
export function onSyncChange(fn) { listeners.push(fn); }
const notify = () => listeners.forEach((fn) => fn());

class AuthError extends Error {}

function friendly(j, status) {
  const m = j.msg || j.error_description || j.message || j.error || `Error ${status}`;
  if (/invalid login|invalid_credentials/i.test(m)) return 'Wrong email or password.';
  if (/already (been )?registered|already exists|user_already_exists/i.test(m)) return 'An account with this email already exists. Sign in instead.';
  if (/password/i.test(m) && /6|characters|weak/i.test(m)) return 'Please use a password with at least 6 characters.';
  if (/email/i.test(m) && /invalid/i.test(m)) return 'That email address doesn\'t look right.';
  if (/rate limit|too many/i.test(m)) return 'Too many attempts. Please wait a few minutes and try again.';
  return m;
}

async function authCall(path, body) {
  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
      method: 'POST', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
  } catch { throw new Error('No connection. Check your internet and try again.'); }
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new AuthError(friendly(j, res.status));
  return j;
}

const toSession = (j, keep = {}) => ({
  ...keep,
  access_token: j.access_token,
  refresh_token: j.refresh_token,
  expires_at: Date.now() + (j.expires_in || 3600) * 1000,
  user: { id: j.user.id, email: j.user.email },
});

export async function signUp(email, password) {
  const j = await authCall('signup', { email, password });
  if (!j.access_token) throw new Error('Account created, but it needs email confirmation. Turn "Confirm email" off in Supabase.');
  setSession(toSession(j));
  await sync();
}

export async function signIn(email, password) {
  const j = await authCall('token?grant_type=password', { email, password });
  setSession(toSession(j));
  await sync();
}

export function signOut() {
  const s = session();
  setSession(null);
  notify();
  if (s) fetch(`${SUPABASE_URL}/auth/v1/logout`, { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${s.access_token}` } }).catch(() => {});
}

export async function requestPasswordReset(email) {
  const redirect = new URL('reset.html', location.href).href;
  await authCall(`recover?redirect_to=${encodeURIComponent(redirect)}`, { email });
}

async function accessToken() {
  let s = session();
  if (!s) return null;
  if (Date.now() > s.expires_at - 60_000) {
    try {
      const j = await authCall('token?grant_type=refresh_token', { refresh_token: s.refresh_token });
      s = toSession(j, { lastSync: s.lastSync });
      setSession(s);
    } catch (e) {
      if (e instanceof AuthError) { setSession(null); notify(); } // session revoked: sign out locally
      throw e;
    }
  }
  return s.access_token;
}

async function rest(method, path, body, prefer) {
  const token = await accessToken();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Sync failed (${res.status})`);
  return res.status === 204 || res.headers.get('content-length') === '0' ? null : res.json().catch(() => null);
}

let running = null;
let lastError = '';
export const syncError = () => lastError;
export const syncing = () => !!running;

/** Pulls the cloud copy, merges it into this device, and pushes the result back. */
export function sync() {
  if (!signedIn()) return Promise.resolve(false);
  if (running) return running;
  if (navigator.onLine === false) { lastError = 'offline'; return Promise.resolve(false); }
  running = (async () => {
    const uid = session().user.id;
    const rows = await rest('GET', `profiles?id=eq.${uid}&select=data`);
    if (rows?.[0]?.data) replaceState(mergeStates(state, rows[0].data));
    await rest('POST', 'profiles', {
      id: uid, name: state.name, avatar: state.avatar || null, data: state, updated_at: new Date().toISOString(),
    }, 'resolution=merge-duplicates,return=minimal');
    const s = session();
    if (s) setSession({ ...s, lastSync: Date.now() });
    lastError = '';
    return true;
  })().catch((e) => { lastError = e.message; return false; })
    .finally(() => { running = null; notify(); });
  notify();
  return running;
}

// Sync a few seconds after changes, when the app goes to the background, and on reconnect.
let timer = null;
onSave(() => {
  if (!signedIn()) return;
  clearTimeout(timer);
  timer = setTimeout(sync, 5000);
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') sync(); });
window.addEventListener('online', () => sync());
