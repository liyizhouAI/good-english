"use client";

import type { CSSProperties, ReactNode } from "react";

// Pixel art unit size (px)
const P = 3;
// Shadow offset (px)
const S = 1;

// 5×7 pixel art "G"
const LETTER_G: number[][] = [
  [0, 1, 1, 1, 0],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 0],
  [1, 0, 1, 1, 1],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
  [0, 1, 1, 1, 0],
];

interface PixelGridProps {
  grid: number[][];
  offsetX: number;
  offsetY: number;
  mainColor: string;
  shadowColor: string;
}

function PixelGrid({
  grid,
  offsetX,
  offsetY,
  mainColor,
  shadowColor,
}: PixelGridProps) {
  const shadows: ReactNode[] = [];
  const mains: ReactNode[] = [];

  grid.forEach((row, ri) => {
    row.forEach((px, ci) => {
      if (!px) return;
      shadows.push(
        <rect
          key={`s-${ri}-${ci}`}
          x={offsetX + ci * P + S}
          y={offsetY + ri * P + S}
          width={P}
          height={P}
          fill={shadowColor}
        />,
      );
      mains.push(
        <rect
          key={`m-${ri}-${ci}`}
          x={offsetX + ci * P}
          y={offsetY + ri * P}
          width={P}
          height={P}
          fill={mainColor}
        />,
      );
    });
  });

  return (
    <>
      {shadows}
      {mains}
    </>
  );
}

/** Pixel art "G" icon — replaces the Zap icon in the sidebar */
export function GoodEnglishIcon({ size = 24 }: { size?: number }) {
  // G is 5×7 → 15×21px at P=3
  const w = 5 * P;
  const h = 7 * P;
  const ox = Math.floor((size - w) / 2);
  const oy = Math.floor((size - h) / 2);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Good English"
      role="img"
      style={{ imageRendering: "pixelated" }}
    >
      <PixelGrid
        grid={LETTER_G}
        offsetX={ox}
        offsetY={oy}
        mainColor="#CBD5E1"
        shadowColor="#374151"
      />
    </svg>
  );
}

/** Inline pixel-shadow text style for "Good English" headings */
const PIXEL_TEXT_STYLE: CSSProperties = {
  fontFamily: '"Courier New", Courier, monospace',
  letterSpacing: "0.12em",
  textShadow: "1px 1px 0 #374151, 2px 2px 0 rgba(55,65,81,0.35)",
  fontWeight: 700,
};

/**
 * Sidebar logo — collapsed shows icon only, expanded shows icon + text.
 */
export function SidebarLogo({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return <GoodEnglishIcon size={24} />;
  }
  return (
    <span className="flex items-center gap-2.5">
      <GoodEnglishIcon size={22} />
      <span
        className="text-base text-[var(--foreground)] tracking-widest uppercase"
        style={PIXEL_TEXT_STYLE}
      >
        Good English
      </span>
    </span>
  );
}

/**
 * Mobile top-bar inline logo (icon + text).
 */
export function TopBarLogo() {
  return (
    <span className="flex items-center gap-2">
      <GoodEnglishIcon size={20} />
      <span
        className="text-sm text-[var(--foreground)] uppercase tracking-widest"
        style={PIXEL_TEXT_STYLE}
      >
        Good English
      </span>
    </span>
  );
}

/**
 * Large heading pixel-art wordmark for dashboard h1.
 */
export function GoodEnglishHeading({ className = "" }: { className?: string }) {
  return (
    <h1
      className={`font-bold uppercase ${className}`}
      style={{
        ...PIXEL_TEXT_STYLE,
        fontSize: "clamp(1.5rem, 4vw, 2.25rem)",
        textShadow: "2px 2px 0 #374151, 4px 4px 0 rgba(55,65,81,0.25)",
        letterSpacing: "0.18em",
      }}
    >
      Good English
    </h1>
  );
}
