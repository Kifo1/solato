import { useId } from 'react';
import { cn } from '@shared/lib/utils';

interface SolatoLogoProps {
  size?: number;
  isActive?: boolean;
  showFrame?: boolean;
  className?: string;
}

/**
 * Solato brand mark derived directly from the signature dual-arc timer circle.
 * When `isActive` is true, the opposing quarter-arcs rotate 90deg just like the stopwatch dial.
 */
export function SolatoLogo({
  size = 34,
  isActive = false,
  showFrame = true,
  className,
}: Readonly<SolatoLogoProps>) {
  const uid = useId();
  const bgId = `solato-bg-${uid}`;
  const arcAId = `solato-arc-a-${uid}`;
  const arcBId = `solato-arc-b-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn('shrink-0 select-none', className)}
    >
      <defs>
        <radialGradient id={bgId} cx="50%" cy="22%" r="82%">
          <stop offset="0%" stopColor="#202530" />
          <stop offset="100%" stopColor="#0C0E12" />
        </radialGradient>
        <linearGradient id={arcAId} x1="32" y1="11" x2="53" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
        <linearGradient id={arcBId} x1="32" y1="53" x2="11" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
      </defs>

      {showFrame && (
        <rect
          x="2"
          y="2"
          width="60"
          height="60"
          rx="16"
          fill={`url(#${bgId})`}
          stroke="rgba(255,255,255,0.10)"
          strokeWidth="1.5"
        />
      )}

      {/* Subtle ambient glow when timer is actively running */}
      {isActive && <circle cx="32" cy="32" r="21" fill="#F59E0B" opacity="0.12" />}

      {/* Base full timer track */}
      <circle
        cx="32"
        cy="32"
        r="19"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth="3.2"
      />

      {/* Signature opposing quarter-arcs (mirroring TimerDisplay ring) */}
      <g
        style={{
          transformOrigin: '32px 32px',
          transform: isActive ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 650ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <path
          d="M 33.5 13.06 A 19 19 0 0 1 50.94 30.5"
          stroke={`url(#${arcAId})`}
          strokeWidth="4.2"
          strokeLinecap="round"
        />
        <path
          d="M 30.5 50.94 A 19 19 0 0 1 13.06 33.5"
          stroke={`url(#${arcBId})`}
          strokeWidth="4.2"
          strokeLinecap="round"
        />
      </g>

      {/* Center solar chronometer pivot */}
      <circle
        cx="32"
        cy="32"
        r={isActive ? '5.2' : '4.2'}
        fill="#F59E0B"
        opacity={isActive ? '0.28' : '0.16'}
        className="transition-all duration-500"
      />
      <circle cx="32" cy="32" r="2.6" fill="#FBBF24" />
    </svg>
  );
}
