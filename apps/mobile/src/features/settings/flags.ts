// Account features that wait on backend PRs (PLAN §4). The UI is built and
// shown disabled in dev builds so it can be reviewed; release builds hide
// the rows until the flag flips with the server change.

/** B4: POST /auth/logout-all. */
export const ACCOUNT_LOGOUT_ALL = false;
/** B10: DELETE /users/me {password}. */
export const ACCOUNT_DELETE = false;

/** Privacy page: a static page on the web domain (B16, Phase 10/11). */
export const PRIVACY_URL = 'https://tactictak.online/privacy';
