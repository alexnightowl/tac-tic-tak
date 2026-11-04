/* eslint-disable @next/next/no-img-element -- uploaded avatars come from the API host; next/image adds nothing at these sizes */
'use client';

import { isCreatorNickname } from '@tac/core/catalogs';
import { feedback, rank } from '@tac/core/tokens';
import { Crown } from 'lucide-react';
import { memo, type CSSProperties } from 'react';

import { assetUrl } from '@/lib/api';
import { useT } from '@/lib/i18n';
import './kit.css';

const CYRILLIC = /[Ѐ-ӿ]/;

/** Web getInitials (components/Avatar.tsx), as the app's initialsOf. */
export function initialsOf(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return '?';
  const parts = cleaned.split(/[^A-Za-zА-Яа-яЁёІіЇїЄєҐґ0-9]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return cleaned.slice(0, 2).toUpperCase();
}

/**
 * The `.av` disc (app ShellAvatar): the uploaded photo, else the slate
 * texture (220 px, centred) under the graphite veil and a bone sheen at
 * 35 % / 28 %, with display-face initials at 36 % of the disc. Shadows:
 * `--sh-avatar` (two inset layers, a 1 px ring, a soft drop).
 */
export function ShellAvatar({
  nickname,
  avatarUrl,
  size,
}: {
  nickname: string;
  avatarUrl?: string | null;
  size: number;
}) {
  const uri = assetUrl(avatarUrl);
  const initials = initialsOf(nickname);
  return (
    <span className="v2-av" style={{ width: size, height: size }}>
      {uri ? (
        <img src={uri} alt="" width={size} height={size} className="v2-av-img" draggable={false} />
      ) : (
        <span
          className="v2-av-initials"
          // Cinzel has no Cyrillic: pick the display face by the glyphs, not the UI language.
          lang={CYRILLIC.test(initials) ? 'uk' : 'en'}
          style={{ fontSize: Math.round(size * 0.36) }}
          aria-hidden
        >
          {initials}
        </span>
      )}
    </span>
  );
}

/** Creator chip gradient: the app's GOLD (features/profile/palette.ts). */
const GOLD = `linear-gradient(135deg, ${rank.intermediate.color} 0%, ${feedback.hint} 60%, ${rank.advanced.color} 100%)`;

/**
 * The shared Avatar (app features/profile/Avatar): the `.av` disc plus the
 * creator decoration, a gold ring with a 2 px gap and a crown chip at the
 * bottom-right. Decorative by default; pass `label` to name it.
 */
export const Avatar = memo(function Avatar({
  nickname,
  avatarUrl,
  size,
  label,
  className,
  style,
}: {
  nickname: string;
  avatarUrl?: string | null;
  size: number;
  label?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const t = useT();
  const creator = isCreatorNickname(nickname);
  const chip = Math.max(14, Math.round(size * 0.32));
  const icon = Math.max(9, Math.round(chip * 0.6));
  const off = -Math.round(chip * 0.15);
  return (
    <span
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      style={{ position: 'relative', display: 'inline-block', flex: 'none', width: size, height: size, ...style }}
    >
      {creator ? <span className="v2-av-ring" aria-hidden /> : null}
      <ShellAvatar nickname={nickname} avatarUrl={avatarUrl} size={size} />
      {creator ? (
        <span
          className="v2-av-crown"
          title={t('profile.creator')}
          style={{ width: chip + 4, height: chip + 4, right: off - 2, bottom: off - 2 }}
        >
          <span style={{ width: chip, height: chip, background: GOLD }}>
            <Crown size={icon} color="var(--eos-embers)" fill="var(--eos-embers)" aria-hidden />
          </span>
        </span>
      ) : null}
    </span>
  );
});
