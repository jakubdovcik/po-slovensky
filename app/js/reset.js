// Password reset: Supabase's recovery email links here with a short-lived token in the
// URL fragment. The learner sets a new password, then signs in again inside the app.

import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const app = document.getElementById('app');
const CROSS = '<svg class="cross" viewBox="0 0 20 28" aria-hidden="true"><path d="M8 0h4v28H8zM4 6h12v3.5H4zM1 13h18v3.5H1z" fill="currentColor"/></svg>';
const params = new URLSearchParams(location.hash.slice(1));
const token = params.get('access_token');
const linkError = params.get('error_description');

function page(body) {
  app.innerHTML = `<main class="screen auth"><div class="welcome-mark sm">${CROSS}</div>${body}</main>`;
}

function form(error = '') {
  page(`<h1 class="display sm center">Choose a new password</h1>
    <label class="field-label" for="pw">New password</label>
    <input id="pw" class="text-input left" type="password" autocomplete="new-password" placeholder="At least 6 characters">
    ${error ? `<div class="form-error">${error}</div>` : ''}
    <button class="btn primary big" id="go">Save new password</button>`);
  document.getElementById('go').onclick = submit;
}

async function submit() {
  const password = document.getElementById('pw').value;
  if (password.length < 6) return form('Please use at least 6 characters.');
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'PUT',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).msg || 'The link may have expired. Request a new one from the app.');
    history.replaceState(null, '', location.pathname);
    page(`<h1 class="display sm center">Password changed</h1>
      <p class="lede center">Now open <b>Po slovensky</b> from your home screen and sign in with your new password.</p>`);
  } catch (e) { form(e.message); }
}

if (token && !linkError) form();
else page(`<h1 class="display sm center">This link doesn't work</h1>
  <p class="lede center">${linkError ? linkError.replace(/\+/g, ' ') : 'It may have expired.'} Open the app, tap <b>Forgot password?</b> and request a new one.</p>`);
