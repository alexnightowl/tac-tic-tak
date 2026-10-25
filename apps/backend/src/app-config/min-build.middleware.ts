import type { NextFunction, Request, Response } from 'express';
import type { AppConfig } from './app-config';
import { parseBuildHeader, parsePlatform } from './app-config';

/** Paths an outdated build must still reach: the config that tells it to update, and health. */
const EXEMPT = /^\/api\/(?:v\d+\/)?(?:app-config|health)(?:[/?]|$)/;

/**
 * Min-build gate (B3). Answers 426 Upgrade Required ONLY when the request
 * carries X-App-Build, X-Platform is ios/android, the build parses as an
 * integer and it is below that platform's minimum. Anything else (the web,
 * curl, a missing/unknown platform, a malformed build, no minimum
 * configured) passes through untouched.
 */
export function minBuildGate(config: AppConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    const buildHeader = req.headers['x-app-build'];
    if (buildHeader === undefined || req.method === 'OPTIONS') return next();
    // Express routing is case-insensitive (/api/App-Config reaches the
    // controller), so the exemption check must be too.
    const url = (req.originalUrl ?? req.url).toLowerCase();
    if (!url.startsWith('/api/') || EXEMPT.test(url)) return next();

    const platform = parsePlatform(asString(req.headers['x-platform']));
    const build = parseBuildHeader(asString(buildHeader));
    if (!platform || build === null) return next();

    const min = config.minSupportedBuild[platform];
    if (!(min > 0) || build >= min) return next();

    res.status(426).json({
      statusCode: 426,
      message: 'app update required',
      error: 'Upgrade Required',
      minSupportedBuild: min,
      storeUrl: config.storeUrls[platform],
    });
  };
}

function asString(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}
