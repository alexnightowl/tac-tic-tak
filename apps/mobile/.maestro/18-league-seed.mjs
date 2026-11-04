// 18-league seed (LOCAL API only): me + friend B, a finished race, a dare
// waiting on B, a dare from B waiting on me. Prints shell exports.
const API = process.env.API ?? 'http://localhost:4000/api';
const lang = process.argv[2] ?? 'en';
const pw = 'League' + Math.random().toString(36).slice(2, 8) + '9';
const rnd = () => Math.random().toString(36).slice(2, 7);
async function call(tok, method, path, body) {
  const r = await fetch(API + path, { method, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); try { return JSON.parse(t); } catch { return t; }
}
async function user(prefix) {
  const nickname = prefix + rnd();
  const r = await call(null, 'POST', '/auth/register', { nickname, password: pw, repeatPassword: pw });
  const me = await call(r.token, 'GET', '/users/me');
  await call(r.token, 'PATCH', '/users/me/settings', { language: lang, onboardingCompleted: true });
  return { tok: r.token, nickname, id: me.id };
}
function run(stream, score, challengeId) {
  const results = Array.from({ length: score }, (_, i) => ({ i, ok: true, ms: 100 }));
  return { clientId: 'c' + rnd() + rnd(), streamId: stream.streamId, format: 'time3', challengeId, score, mistakes: 0, bestCombo: score, durationMs: 10000, lastSolveMs: 1000 + score, results, localDay: new Date().toISOString().slice(0, 10), tzOffsetMin: 0 };
}
const A = await user('lgme'), B = await user('lgfr');
await call(A.tok, 'POST', '/friends/request', { nickname: B.nickname });
const pend = await call(B.tok, 'GET', '/friends/pending');
await call(B.tok, 'POST', `/friends/${pend.incoming[0].id}/accept`);
// A finished race (A wins).
const c1 = await call(A.tok, 'POST', '/challenges', { opponentId: B.id, format: 'time3' });
await call(A.tok, 'POST', '/storm/runs', run(c1.stream, 9, c1.challenge.id));
const bs = await call(B.tok, 'POST', '/storm/streams', { challengeId: c1.challenge.id });
await call(B.tok, 'POST', '/storm/runs', run(bs, 5, c1.challenge.id));
// A solo run each, then dares both ways.
const sa = await call(A.tok, 'POST', '/storm/streams', {});
const ra = await call(A.tok, 'POST', '/storm/runs', run(sa, 7));
await call(A.tok, 'POST', '/challenges', { opponentId: B.id, format: 'time3', runId: ra.runId });
const sb = await call(B.tok, 'POST', '/storm/streams', {});
const rb = await call(B.tok, 'POST', '/storm/runs', run(sb, 6));
await call(B.tok, 'POST', '/challenges', { opponentId: A.id, format: 'time3', runId: rb.runId });
const l = await call(A.tok, 'GET', '/challenges');
console.log(`export ME=${A.nickname} PW=${pw}`);
console.error(`seeded ${A.nickname}: challenges in=${l.incoming.length} out=${l.outgoing.length} fin=${l.finished.length}`);
