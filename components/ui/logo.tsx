'use client';

// ─── Pixel block colors (opencode-style metallic gray) ───────────────────────
const CLR = {
  dropShadow: '#050709',   // near-black drop shadow
  face: '#8D99A6',         // main block face
  hiTop: '#D4DCE4',        // top highlight strip
  hiLeft: '#B0BBC6',       // left highlight strip
  shBottom: '#3D4A56',     // bottom shadow strip
  shRight: '#3D4A56',      // right shadow strip
} as const;

// ─── Single pixel block with 3-D bevel ───────────────────────────────────────
function PixelBlock({
  x, y, p, b,
}: {
  x: number; y: number;
  p: number; // block size
  b: number; // bevel/shadow thickness
}) {
  return (
    <>
      {/* Drop shadow — offset bottom-right */}
      <rect x={x + b} y={y + b} width={p} height={p} fill={CLR.dropShadow} />
      {/* Main face */}
      <rect x={x} y={y} width={p} height={p} fill={CLR.face} />
      {/* Top highlight (full width) */}
      <rect x={x} y={y} width={p} height={b} fill={CLR.hiTop} />
      {/* Left highlight */}
      <rect x={x} y={y + b} width={b} height={p - b * 2} fill={CLR.hiLeft} />
      {/* Bottom shadow */}
      <rect x={x} y={y + p - b} width={p} height={b} fill={CLR.shBottom} />
      {/* Right shadow */}
      <rect x={x + p - b} y={y + b} width={b} height={p - b} fill={CLR.shRight} />
    </>
  );
}

// ─── Pixel-art letter grids (5-wide × 7-tall) ────────────────────────────────

const LETTER_G = [
  [0, 1, 1, 1, 0],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 0],
  [1, 0, 1, 1, 1],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
  [0, 1, 1, 1, 0],
];

const LETTER_O = [
  [0, 1, 1, 1, 0],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
  [0, 1, 1, 1, 0],
];

const LETTER_D = [
  [1, 1, 1, 0, 0],
  [1, 0, 0, 1, 0],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 1, 0],
  [1, 1, 1, 0, 0],
];

const LETTER_E = [
  [1, 1, 1, 1, 0],
  [1, 0, 0, 0, 0],
  [1, 0, 0, 0, 0],
  [1, 1, 1, 0, 0],
  [1, 0, 0, 0, 0],
  [1, 0, 0, 0, 0],
  [1, 1, 1, 1, 0],
];

const LETTER_N = [
  [1, 0, 0, 0, 1],
  [1, 1, 0, 0, 1],
  [1, 0, 1, 0, 1],
  [1, 0, 0, 1, 1],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
];

const LETTER_L = [
  [1, 0, 0, 0, 0],
  [1, 0, 0, 0, 0],
  [1, 0, 0, 0, 0],
  [1, 0, 0, 0, 0],
  [1, 0, 0, 0, 0],
  [1, 0, 0, 0, 0],
  [1, 1, 1, 1, 1],
];

const LETTER_I = [
  [1, 1, 1, 0, 0],
  [0, 1, 0, 0, 0],
  [0, 1, 0, 0, 0],
  [0, 1, 0, 0, 0],
  [0, 1, 0, 0, 0],
  [0, 1, 0, 0, 0],
  [1, 1, 1, 0, 0],
];

const LETTER_S = [
  [0, 1, 1, 1, 0],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 0],
  [0, 1, 1, 1, 0],
  [0, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
  [0, 1, 1, 1, 0],
];

const LETTER_H = [
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
  [1, 1, 1, 1, 1],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
];

// ─── Render a letter at a given offset ───────────────────────────────────────
function Letter({
  grid, ox, oy, p, b,
}: {
  grid: number[][];
  ox: number; oy: number;
  p: number; b: number;
}) {
  return (
    <>
      {grid.flatMap((row, ri) =>
        row.map((v, ci) =>
          v ? (
            <PixelBlock
              key={`${ri}-${ci}`}
              x={ox + ci * p}
              y={oy + ri * p}
              p={p}
              b={b}
            />
          ) : null
        )
      )}
    </>
  );
}

// ─── "GOOD ENGLISH" wordmark — configurable block size ───────────────────────
function PixelWordmark({
  p = 5,     // block pixel size
  gap = p,   // gap between letters
}: {
  p?: number;
  gap?: number;
}) {
  const b = Math.max(1, Math.round(p / 4));
  const rows = 7;
  const cols = 5;
  const letterW = cols * p;
  const spaceW = Math.round(p * 0.8);

  // "GOOD ENGLISH" = G O O D [space] E N G L I S H
  const letters = [
    LETTER_G, LETTER_O, LETTER_O, LETTER_D,
    null, // space
    LETTER_E, LETTER_N, LETTER_G, LETTER_L, LETTER_I, LETTER_S, LETTER_H,
  ];

  let cursor = 0;
  const positions: { grid: number[][] | null; x: number }[] = letters.map((grid) => {
    const x = cursor;
    cursor += grid === null ? spaceW + gap : letterW + gap;
    return { grid, x };
  });

  const totalW = cursor - gap + b;
  const totalH = rows * p + b;

  return (
    <svg
      viewBox={`0 0 ${totalW} ${totalH}`}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="GOOD ENGLISH"
      role="img"
    >
      {positions.map(({ grid, x }, i) =>
        grid ? (
          <Letter key={i} grid={grid} ox={x} oy={0} p={p} b={b} />
        ) : null
      )}
    </svg>
  );
}

// ─── Public components ────────────────────────────────────────────────────────

/**
 * Small pixel "G" icon — for collapsed sidebar / mobile bar.
 * height prop controls rendered size; SVG scales cleanly.
 */
export function GoodEnglishIcon({ height = 28 }: { height?: number }) {
  const p = 4;
  const b = 1;
  const vw = 5 * p + b;  // 21
  const vh = 7 * p + b;  // 29
  const w = Math.round(height * (vw / vh));

  return (
    <svg
      width={w}
      height={height}
      viewBox={`0 0 ${vw} ${vh}`}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Good English"
      role="img"
    >
      <Letter grid={LETTER_G} ox={0} oy={0} p={p} b={b} />
    </svg>
  );
}

/**
 * Sidebar logo:
 * - collapsed → small G icon only
 * - expanded → G icon + "Good English" in serif font
 */
export function SidebarLogo({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return <GoodEnglishIcon height={26} />;
  }
  return (
    <span className="flex items-center gap-3">
      <GoodEnglishIcon height={26} />
      <span
        className="text-[15px] font-bold tracking-[0.15em] uppercase text-[var(--foreground)]"
        style={{ fontFamily: 'var(--font-serif), Georgia, serif' }}
      >
        Good English
      </span>
    </span>
  );
}

/**
 * Mobile top bar logo (icon + text, compact).
 */
export function TopBarLogo() {
  return (
    <span className="flex items-center gap-2.5">
      <GoodEnglishIcon height={22} />
      <span
        className="text-sm font-bold tracking-[0.12em] uppercase text-[var(--foreground)]"
        style={{ fontFamily: 'var(--font-serif), Georgia, serif' }}
      >
        Good English
      </span>
    </span>
  );
}

/**
 * Full pixel-art wordmark for the dashboard hero.
 * Scales fluidly with the container width.
 */
export function GoodEnglishHeading() {
  return (
    <div className="w-full max-w-[480px]">
      <PixelWordmark p={5} gap={4} />
    </div>
  );
}
