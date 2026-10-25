// 05-outcomes helper (Maestro runScript, GraalJS): records correct attempts
// on the running session straight through the local API, so a 1-minute
// bullet session meets every unlock criterion deterministically (solved ≥ 7,
// accuracy, peak rise: the puzzles are picked above the start rating by
// 05-outcomes.sh). Env: API, E2E_USER, E2E_PASSWORD, SESSION, PUZZLES (csv).
var login = http.post(API + '/auth/login', {
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ nickname: E2E_USER, password: E2E_PASSWORD }),
});
var token = json(login.body).token;
var ids = PUZZLES.split(',');
var ok = 0;
for (var i = 0; i < ids.length; i++) {
  var r = http.post(API + '/sessions/' + SESSION + '/attempt', {
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ puzzleId: ids[i], correct: true, responseMs: 3000 }),
  });
  if (r.status === 201 || r.status === 200) ok++;
}
output.injected = ok;
