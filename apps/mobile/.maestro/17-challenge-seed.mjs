// Seeds the Challenge suite on the LOCAL backend (17-challenge.sh). Never
// point API at prod. Registers two throwaway users, ME (the app logs in as
// it) and a FRIEND, makes them friends and creates, through the real API:
//   incoming  FRIEND → ME, FRIEND played 14 solved / 2 mistakes, with a note;
//   result    ME → FRIEND, both played (ME 15/2 beats FRIEND 13/3);
//   waiting   ME → FRIEND (5 min), only ME played (12/1).
// Prints shell assignments (ME, FRIEND, FRIEND_NAME, INCOMING, RESULT, WAITING).
//   node 17-challenge-seed.mjs <password> [en|uk]
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const API = process.env.API ?? 'http://localhost:4000/api';
if (!/localhost|127\.0\.0\.1|10\.0\.2\.2/.test(API)) throw new Error('local backend only');
const pw = process.argv[2];
const lang = process.argv[3] ?? 'en';
if (!pw) throw new Error('usage: node 17-challenge-seed.mjs <password> [en|uk]');
const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
/** Local docker Postgres (the run length is bounded by the stream's age: backdate it). */
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

function run(stream, challengeId, format, score, mistakes, durationMs) {
  const results = [];
  let solved = 0;
  let missed = 0;
  for (let i = 0; solved < score || missed < mistakes; i++) {
    const ok = solved < score && (missed >= mistakes || i % 5 !== 3);
    results.push({ i, ok, ms: Math.round(durationMs / (score + mistakes)) });
    ok ? solved++ : missed++;
  }
  return {
    clientId: 'seed' + rnd() + rnd(),
    streamId: stream.streamId,
    format,
    challengeId,
    score,
    mistakes,
    bestCombo: Math.min(score, 6),
    durationMs,
    lastSolveMs: durationMs - 4000,
    results,
    localDay: new Date().toISOString().slice(0, 10),
    tzOffsetMin: 0,
  };
}

/** `from` challenges `to` and plays; returns the challenge and its stream. */
async function challenge(from, to, format, score, mistakes, note) {
  const c = await call(from.tok, 'POST', '/challenges', { opponentId: to.id, format, ...(note ? { note } : {}) });
  const id = c.challenge.id;
  psql(`update "StormStream" set "createdAt" = now() - interval '15 minutes' where id = '${c.stream.streamId}'`);
  await call(from.tok, 'POST', '/storm/runs', run(c.stream, id, format, score, mistakes, format === 'time5' ? 300_000 : 180_000));
  return { id, stream: c.stream };
}

const me = await user('cm');
await call(me.tok, 'PATCH', '/users/me/settings', { language: lang, onboardingCompleted: true });
const friend = await user('cf', 'Oleh');
await call(friend.tok, 'POST', '/friends/request', { nickname: me.nickname });
const pend = await call(me.tok, 'GET', '/friends/pending');
const req = pend.incoming?.[0];
await call(me.tok, 'POST', `/friends/${req.id ?? req.friendshipId}/accept`);

const incoming = await challenge(friend, me, 'time3', 14, 2, 'It gets brutal after 12. Good luck.');
const result = await challenge(me, friend, 'time3', 15, 2);
await call(friend.tok, 'POST', '/storm/runs', run(result.stream, result.id, 'time3', 13, 3, 180_000));
const waiting = await challenge(me, friend, 'time5', 12, 1);

const out = {
  ME: me.nickname,
  ME_ID: me.id,
  FRIEND: friend.nickname,
  FRIEND_NAME: 'Oleh',
  INCOMING: incoming.id,
  RESULT: result.id,
  WAITING: waiting.id,
};
for (const [k, v] of Object.entries(out)) console.log(`${k}=${v}`);
