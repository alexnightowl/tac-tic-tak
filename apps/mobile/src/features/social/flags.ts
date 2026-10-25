// Feature flags for parts waiting on backend work (PLAN §4).

/** B13: GET /leaderboard also returns the viewer's own row (`me`) when it
 *  is outside the top N. Off: the sticky row shows the viewer's rating from
 *  the account with the rank as "100+". */
export const LEADERBOARD_ME_ROW = false;

/** No endpoint clears an avatar today (POST /users/me/avatar only sets one). */
export const AVATAR_REMOVE = false;
