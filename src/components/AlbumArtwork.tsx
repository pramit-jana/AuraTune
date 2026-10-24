import React from 'react';
import { Track } from '../types/music';

interface AlbumArtworkProps {
  track: Track;
  size?: 'sm' | 'md' | 'lg' | 'hero';
  isPlaying?: boolean;
  className?: string;
}

export const AlbumArtwork: React.FC<AlbumArtworkProps> = ({
  track,
  size = 'md',
  isPlaying = false,
  className = '',
}) => {
  const { primary, secondary, accent, motif } = track.coverPalette;

  const dimensions =
    size === 'sm'
      ? 'w-10 h-10 rounded-md'
      : size === 'md'
        ? 'w-14 h-14 rounded-lg'
        : size === 'lg'
          ? 'w-28 h-28 rounded-xl'
          : 'w-full h-full min-h-[220px] rounded-xl';

  return (
    <div
      className={`relative overflow-hidden select-none shrink-0 border border-slate-800/80 ${dimensions} ${className}`}
      style={{
        background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
      }}
      role="img"
      aria-label={`${track.title} by ${track.artist} album cover`}
    >
      <svg
        viewBox="0 0 200 200"
        className="w-full h-full object-cover"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id={`grad-${track.id}-${size}`} cx="50%" cy="50%" r="65%">
            <stop offset="0%" stopColor={accent} stopOpacity="0.32" />
            <stop offset="65%" stopColor={secondary} stopOpacity="0.15" />
            <stop offset="100%" stopColor={primary} stopOpacity="0.9" />
          </radialGradient>
        </defs>

        <rect width="200" height="200" fill={`url(#grad-${track.id}-${size})`} />

        {motif === 'vinyl' && (
          <g
            className={isPlaying ? 'origin-center animate-spin' : 'origin-center'}
            style={{ animationDuration: '9s' }}
          >
            <circle cx="100" cy="100" r="72" fill="none" stroke={accent} strokeWidth="1" strokeOpacity="0.3" />
            <circle cx="100" cy="100" r="56" fill="none" stroke={accent} strokeWidth="0.75" strokeOpacity="0.25" />
            <circle cx="100" cy="100" r="40" fill="none" stroke={accent} strokeWidth="1" strokeOpacity="0.4" />
            <circle cx="100" cy="100" r="20" fill={accent} fillOpacity="0.85" />
            <circle cx="100" cy="100" r="5" fill={primary} />
          </g>
        )}

        {motif === 'waves' && (
          <g stroke={accent} fill="none" strokeWidth="1.5">
            <path d="M 10 130 Q 55 95, 100 130 T 190 130" strokeOpacity="0.7" />
            <path d="M 10 105 Q 55 70, 100 105 T 190 105" strokeOpacity="0.45" />
            <path d="M 10 80 Q 55 45, 100 80 T 190 80" strokeOpacity="0.25" />
            <circle cx="100" cy="68" r="24" fill={accent} fillOpacity="0.22" stroke="none" />
          </g>
        )}

        {motif === 'prism' && (
          <g stroke={accent} fill="none" strokeWidth="1.4">
            <polygon points="100,32 162,148 38,148" strokeOpacity="0.75" />
            <polygon points="100,54 144,136 56,136" strokeOpacity="0.35" />
            <line x1="100" y1="32" x2="100" y2="148" strokeOpacity="0.3" />
          </g>
        )}

        {motif === 'botanical' && (
          <g stroke={accent} fill="none" strokeWidth="1.3">
            <path d="M 100 165 L 100 45" strokeOpacity="0.65" />
            <path d="M 100 130 Q 132 115, 142 92 Q 116 98, 100 130" fill={accent} fillOpacity="0.2" />
            <path d="M 100 105 Q 68 90, 58 67 Q 84 73, 100 105" fill={accent} fillOpacity="0.2" />
            <path d="M 100 80 Q 128 65, 134 46 Q 112 52, 100 80" fill={accent} fillOpacity="0.3" />
          </g>
        )}

        {motif === 'horizon' && (
          <g>
            <circle cx="100" cy="92" r="42" fill={accent} fillOpacity="0.28" />
            <line x1="16" y1="122" x2="184" y2="122" stroke={accent} strokeWidth="1.5" strokeOpacity="0.8" />
            <line x1="32" y1="136" x2="168" y2="136" stroke={accent} strokeWidth="1" strokeOpacity="0.45" />
            <line x1="54" y1="150" x2="146" y2="150" stroke={accent} strokeWidth="1" strokeOpacity="0.25" />
          </g>
        )}

        {motif === 'eclipse' && (
          <g>
            <circle cx="106" cy="96" r="46" fill={accent} fillOpacity="0.7" />
            <circle cx="92" cy="96" r="42" fill={primary} />
            <circle cx="100" cy="100" r="68" fill="none" stroke={accent} strokeWidth="0.8" strokeOpacity="0.25" />
          </g>
        )}
      </svg>
    </div>
  );
};
