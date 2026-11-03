// Seeds the Storm suite on the LOCAL backend (16-storm.sh). Never point API
// at prod. Registers ME (the app logs in as it) and three friends, makes
// them friends and posts solo runs through the real API, so Start shows
// Your best 2, the week top 3 (Oleh 23, Mira 11, Taras 6) and ME as a 4th
// row, and a 3-solve run in the app beats the old best.
// Prints shell assignments (ME, ME_ID).
//   node 16-storm-seed.mjs <password> [en|uk]
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const API = process.env.API ?? 'http://localhost:4000/api';
if (!/localhost|127\.0\.0\.1|10\.0\.2\.2/.test(API)) throw new Error('local backend only');
const pw = process.argv[2];
const lang = process.argv[3] ?? 'en';
if (!pw) throw new Error('usage: node 16-storm-seed.mjs <password> [en|uk]');
const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
/** Local docker Postgres (a run cannot outlast its stream's age: backdate it). */
const psql = (sql) => execFileSync('docker', ['compose', 'exec', '-T', 'postgres', 'psql', '-U', 'taktic', '-d', 'taktic', '-tAc', sql], { cwd: ROOT }).toString().trim();
const rnd = () => Math.random().toString(36).slice(2, 7);

async function call(tok, method, path, body) {
  const r = await fetch(API + path, {
    method,
    headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  if (r.status >= 300) throw new Error(`${method} ${path} → ${r.status} ${text.slice(0, 200)}`);
  return json;
}

async function user(prefix, displayName) {
  const nickname = prefix + rnd();
  const r = await call(null, 'POST', '/auth/register', { nickname, password: pw, repeatPassword: pw });
  const tok = r.accessToken ?? r.token ?? r.access_token;
  if (displayName) await call(tok, 'PATCH', '/users/me/profile', { displayName });
  const me = await call(tok, 'GET', '/users/me');
  return { tok, nickname, id: me.id ?? me.user?.id };
}

/** A solo run of `score` solves and `mistakes` misses on a fresh stream. */
async function soloRun(u, score, mistakes) {
  const stream = await call(u.tok, 'POST', '/storm/streams', {});
  psql(`update "StormStream" set "createdAt" = now() - interval '15 minutes' where id = '${stream.streamId}'`);
  const results = [];
  let solved = 0;
  let missed = 0;
  for (let i = 0; solved < score || missed < mistakes; i++) {
    const ok = solved < score && (missed >= mistakes || i % 5 !== 3);
    results.push({ i, ok, ms: 4000 });
    ok ? solved++ : missed++;
  }
  const durationMs = 180_000;
  await call(u.tok, 'POST', '/storm/runs', {
    clientId: 'seed' + rnd() + rnd(),
    streamId: stream.streamId,
    format: 'time3',
    score,
    mistakes,
    bestCombo: Math.min(score, 6),
    durationMs,
    lastSolveMs: durationMs - 4000,
    results,
    localDay: new Date().toISOString().slice(0, 10),
    tzOffsetMin: new Date().getTimezoneOffset(),
  });
}

async function befriend(me, friend) {
  await call(friend.tok, 'POST', '/friends/request', { nickname: me.nickname });
  const pend = await call(me.tok, 'GET', '/friends/pending');
  const req = pend.incoming?.find((r) => (r.user?.nickname ?? r.nickname) === friend.nickname) ?? pend.incoming?.[0];
  await call(me.tok, 'POST', `/friends/${req.id ?? req.friendshipId}/accept`);
}

const me = await user('sm');
await call(me.tok, 'PATCH', '/users/me/settings', { language: lang, onboardingCompleted: true });
for (const [name, score, mistakes] of [['Oleh', 23, 2], ['Mira', 11, 3], ['Taras', 6, 3]]) {
  const f = await user('sf', name);
  await befriend(me, f);
  await soloRun(f, score, mistakes);
}
await soloRun(me, 2, 3);

for (const [k, v] of Object.entries({ ME: me.nickname, ME_ID: me.id })) console.log(`${k}=${v}`);
