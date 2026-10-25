// Seeds the Phase 6 flows through the LOCAL API (never prod). Run from a
// flow with runScript; env: E2E_USER, E2E_PASSWORD, SEED, optional THEME,
// API (default http://localhost:4000/api). Results land on `output`.
//   SEED=drill    a theme session on THEME (default fork) with 3 missed puzzles
//                 → ReviewItems in that theme (output.theme)
//   SEED=mistakes a mixed session: 1 missed, 1 slow solve, 1 quick solve
//                 → output.sessionId, output.puzzleId (an attempted puzzle)
//   SEED=viewer   a session whose first attempted puzzle has a line of ≥ 6 moves
//                 → output.puzzleId, output.sessionId
//   SEED=history  2 short sessions finished today → output.sessionId (the newest)
//   SEED=status   GET /sessions/${SESSION_ID} → output.status
var API_URL = typeof API !== 'undefined' && API ? API : 'http://localhost:4000/api';

function call(method, path, body, token) {
  var opts = { headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers.Authorization = 'Bearer ' + token;
  // Maestro's http.post insists on a body.
  if (body !== undefined || method === 'POST') opts.body = JSON.stringify(body === undefined ? {} : body);
  var url = API_URL + path;
  var r =
    method === 'GET' ? http.get(url, opts) : method === 'DELETE' ? http.delete(url, opts) : http.post(url, opts);
  return { status: r.status, data: r.body ? json(r.body) : null };
}

function login() {
  var r = call('POST', '/auth/login', { nickname: E2E_USER, password: E2E_PASSWORD });
  if (r.status >= 300) throw new Error('login failed: ' + r.status);
  return r.data.token;
}

function localDate() {
  var d = new Date();
  var m = String(d.getMonth() + 1);
  var day = String(d.getDate());
  return d.getFullYear() + '-' + (m.length < 2 ? '0' + m : m) + '-' + (day.length < 2 ? '0' + day : day);
}

/** One session: `plan` lists attempts as [correct, responseMs]. Returns { id, puzzles }. */
function session(token, mode, theme, plan) {
  var body = { startRating: 1200, durationSec: 180, mode: mode, style: 'blitz' };
  if (theme) body.theme = theme;
  var s = call('POST', '/sessions', body, token);
  if (s.status >= 300) throw new Error('create failed: ' + s.status);
  var id = s.data.sessionId;
  var next = s.data.firstPuzzle;
  var puzzles = [];
  for (var i = 0; i < plan.length; i++) {
    if (!next) next = call('POST', '/sessions/' + id + '/next', undefined, token).data;
    var pid = next.puzzle.id;
    puzzles.push(pid);
    call('POST', '/sessions/' + id + '/attempt', { puzzleId: pid, correct: plan[i][0], responseMs: plan[i][1] }, token);
    next = null;
  }
  call('POST', '/sessions/' + id + '/finish?localDate=' + localDate(), undefined, token);
  return { id: id, puzzles: puzzles };
}

var token = login();
if (SEED === 'drill') {
  var theme = typeof THEME !== 'undefined' && THEME ? THEME : 'fork';
  session(token, 'theme', theme, [[false, 4000], [false, 4000], [false, 4000]]);
  output.theme = theme;
} else if (SEED === 'mistakes') {
  var m = session(token, 'mixed', null, [[false, 4000], [true, 30000], [true, 2000]]);
  output.sessionId = m.id;
  output.puzzleId = m.puzzles[0];
} else if (SEED === 'viewer') {
  // Play quick solves until a long line comes up (the stepper needs ≥ 5 steps).
  var vs = call('POST', '/sessions', { startRating: 1500, durationSec: 180, mode: 'mixed', style: 'blitz' }, token).data;
  var vn = vs.firstPuzzle;
  for (var k = 0; k < 25; k++) {
    if (!vn) vn = call('POST', '/sessions/' + vs.sessionId + '/next', undefined, token).data;
    call('POST', '/sessions/' + vs.sessionId + '/attempt', { puzzleId: vn.puzzle.id, correct: true, responseMs: 3000 }, token);
    if (vn.puzzle.moves.length >= 6) {
      output.puzzleId = vn.puzzle.id;
      output.moves = String(vn.puzzle.moves.length);
      break;
    }
    vn = null;
  }
  call('POST', '/sessions/' + vs.sessionId + '/finish?localDate=' + localDate(), undefined, token);
  output.sessionId = vs.sessionId;
  if (!output.puzzleId) throw new Error('no long puzzle in 25 tries');
} else if (SEED === 'history') {
  session(token, 'mixed', null, [[true, 3000], [false, 5000]]);
  var h = session(token, 'mixed', null, [[true, 2500]]);
  output.sessionId = h.id;
} else if (SEED === 'status') {
  output.status = String(call('GET', '/sessions/' + SESSION_ID, undefined, token).status);
}
