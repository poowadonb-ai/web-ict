"use client";

import { useMemo } from "react";

interface Star {
  id: number;
  top: string;
  left: string;
  size: number;
  duration: number;
  delay: number;
  color: string;
}

const STAR_COLORS = [
  "rgba(255,255,255,",
  "rgba(255,255,255,",
  "rgba(255,255,255,",
  "rgba(168,85,247,",  // purple
  "rgba(6,182,212,",   // cyan
  "rgba(236,72,153,",  // pink
];

// Seeded pseudo-random so stars don't jump on re-render
function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export default function StarField() {
  const stars = useMemo<Star[]>(() => {
    const rng = seededRng(42);
    return Array.from({ length: 120 }, (_, i) => ({
      id: i,
      top: `${rng() * 100}%`,
      left: `${rng() * 100}%`,
      size: rng() * 1.8 + 0.5,
      duration: rng() * 4 + 2,
      delay: rng() * 6,
      color: STAR_COLORS[Math.floor(rng() * STAR_COLORS.length)],
    }));
  }, []);

  return (
    <>
      <style>{`
        @keyframes sf-twinkle {
          0%, 100% { opacity: 0.1; transform: scale(1); }
          50%       { opacity: 0.9; transform: scale(1.3); }
        }
        .sf-star {
          position: fixed;
          border-radius: 50%;
          pointer-events: none;
          will-change: opacity;
          animation: sf-twinkle var(--sf-dur, 3s) var(--sf-delay, 0s) ease-in-out infinite;
        }
      `}</style>
      {stars.map((s) => (
        <div
          key={s.id}
          className="sf-star"
          style={{
            top: s.top,
            left: s.left,
            width: s.size,
            height: s.size,
            background: `${s.color}0.85)`,
            zIndex: 0,
            // CSS custom properties drive the animation timing
            ["--sf-dur" as string]: `${s.duration}s`,
            ["--sf-delay" as string]: `${s.delay}s`,
          }}
        />
      ))}
    </>
  );
}
