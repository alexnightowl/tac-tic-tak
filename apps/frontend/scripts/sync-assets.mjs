// Copies the app's design v2 assets into public/v2 (D31, docs/web/PLAN.md §2).
// The Docker build context has no apps/mobile, so the copies are committed;
// rerun after the app's assets change: node apps/frontend/scripts/sync-assets.mjs
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const from = join(here, '../../mobile/assets');
const to = join(here, '../public/v2');

const DIRS = ['plates', 'surfaces', 'textures', 'board', 'pieces', 'icons', 'themes', 'learn', 'achievements', 'onboarding'];
// Cinzel has no Cyrillic: uk display text falls back to Forum (app: UK_DISPLAY_DEFAULT).
const FONTS = ['Forum.ttf'];

rmSync(to, { recursive: true, force: true });
for (const d of DIRS) cpSync(join(from, d), join(to, d), { recursive: true });
mkdirSync(join(to, 'fonts'), { recursive: true });
for (const f of FONTS) cpSync(join(from, 'fonts', f), join(to, 'fonts', f));
console.log(`synced ${DIRS.length} folders and ${FONTS.length} font(s) into ${to}`);
