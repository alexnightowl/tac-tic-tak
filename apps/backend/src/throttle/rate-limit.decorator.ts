import { SetMetadata } from '@nestjs/common';
import type { ThrottleName } from './throttle.config';

export const RATE_LIMIT_KEY = 'tac:rate-limit';

/**
 * Opts a route into one or more named throttlers from throttle.config.ts
 * (the `global` one applies everywhere without it).
 *
 *   @RateLimit('login-ip', 'login-nickname')
 */
export const RateLimit = (...names: Exclude<ThrottleName, 'global'>[]) => SetMetadata(RATE_LIMIT_KEY, names);
