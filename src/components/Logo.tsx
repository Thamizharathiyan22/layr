import { useId } from 'react';
import { APP_NAME } from '../brand';

export default function Logo({ onClick }: { onClick?: () => void }) {
  // Unique gradient id: a hidden copy of the logo elsewhere must not break this one
  const gid = `lg${useId().replace(/:/g, '')}`;
  return (
    <button className="logo" onClick={onClick} disabled={!onClick} type="button">
      <svg viewBox="0 0 64 64" width="30" height="30" aria-hidden>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8b5cf6" />
            <stop offset="1" stopColor="#f472b6" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="16" fill="rgba(255,255,255,.06)" />
        <rect x="14" y="16" width="36" height="8" rx="4" fill={`url(#${gid})`} opacity=".45" />
        <rect x="14" y="28" width="36" height="8" rx="4" fill={`url(#${gid})`} opacity=".75" />
        <rect x="14" y="40" width="36" height="8" rx="4" fill={`url(#${gid})`} />
      </svg>
      <span>{APP_NAME}</span>
    </button>
  );
}
