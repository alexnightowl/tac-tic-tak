// 12-play-v2 helper (Maestro runScript, GraalJS): records attempts on the
// running session straight through the local API, so a 1-minute bullet
// session moves the rating deterministically. Env: API, E2E_USER,
// E2E_PASSWORD, SESSION, PUZZLES (csv), CORRECT ('true' | 'false').
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
    body: JSON.stringify({ puzzleId: ids[i], correct: CORRECT === 'true', responseMs: 3000 }),
  });
  if (r.status === 201 || r.status === 200) ok++;
}
output.injected = ok;
