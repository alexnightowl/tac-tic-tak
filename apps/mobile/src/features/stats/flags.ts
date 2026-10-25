// Feature flags for parts that wait on backend work (PLAN §4).

/** B13: /analytics/recommendations returns structured fields (theme, weakness,
 *  failureRate, avgResponseMs) instead of an English sentence. Off: the
 *  card rebuilds the sentence in the UI language from the themes rows. */
export const STRUCTURED_RECOMMENDATIONS = false;
