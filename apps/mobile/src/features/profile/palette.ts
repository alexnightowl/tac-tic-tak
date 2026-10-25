import { feedback, rank } from '@tac/core/tokens';

// Nearest existing tokens for web colours that are not tokens yet (reported
// for baking): the gold chip gradient #fce898 → #eca226 → #d07c20 used by the
// creator crown and unlocked achievement chips.
export const GOLD = [rank.intermediate.color, feedback.hint, rank.advanced.color] as const;
