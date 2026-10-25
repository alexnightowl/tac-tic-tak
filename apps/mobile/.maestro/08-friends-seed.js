// Seeds 08-search-accept through the LOCAL API (never prod). Run from a flow
// with runScript; env: E2E_PASSWORD (shared by the three users), SEED,
// FRIEND_A, FRIEND_B, FRIEND_C, optional API (default http://localhost:4000/api).
//   SEED=requests  clears every friendship among A, B, C, then A → B and
//                  C → B pending (two incoming requests for B)
//   SEED=cleanup   clears every friendship among A, B, C
var API_URL = typeof API !== 'undefined' && API ? API : 'http://localhost:4000/api';

function call(method, path, body, token) {
  var opts = { headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers.Authorization = 'Bearer ' + token;
  if (body !== undefined || method === 'POST') opts.body = JSON.stringify(body === undefined ? {} : body);
  var url = API_URL + path;
  var r =
    method === 'GET' ? http.get(url, opts) : method === 'DELETE' ? http.delete(url, opts) : http.post(url, opts);
  return { status: r.status, data: r.body ? json(r.body) : null };
}

function login(nickname) {
  var r = call('POST', '/auth/login', { nickname: nickname, password: E2E_PASSWORD });
  if (r.status >= 300) throw new Error('login failed for ' + nickname + ': ' + r.status);
  return r.data.token;
}

var names = [FRIEND_A, FRIEND_B, FRIEND_C];

function inSet(nickname) {
  for (var i = 0; i < names.length; i++) if (names[i] === nickname) return true;
  return false;
}

/** Deletes every pending request and friendship this user has with the others. */
function clear(token) {
  var friends = call('GET', '/friends', undefined, token).data || [];
  for (var i = 0; i < friends.length; i++) {
    if (inSet(friends[i].user.nickname)) call('DELETE', '/friends/by-user/' + friends[i].user.id, undefined, token);
  }
  var pending = call('GET', '/friends/pending', undefined, token).data || { incoming: [], outgoing: [] };
  var rows = pending.incoming.concat(pending.outgoing);
  for (var j = 0; j < rows.length; j++) {
    if (inSet(rows[j].user.nickname)) call('DELETE', '/friends/' + rows[j].id, undefined, token);
  }
}

var tokens = {};
for (var k = 0; k < names.length; k++) tokens[names[k]] = login(names[k]);
for (var m = 0; m < names.length; m++) clear(tokens[names[m]]);

if (SEED === 'requests') {
  var a = call('POST', '/friends/request', { nickname: FRIEND_B }, tokens[FRIEND_A]);
  var c = call('POST', '/friends/request', { nickname: FRIEND_B }, tokens[FRIEND_C]);
  if (a.status >= 300 || c.status >= 300) throw new Error('request failed: ' + a.status + ' / ' + c.status);
}
output.seeded = SEED;
