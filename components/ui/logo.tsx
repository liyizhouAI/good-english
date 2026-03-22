'use client';

// ─── Pixel letter grids (5 wide × 7 tall) ────────────────────────────────────

const G = [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,0],[1,0,1,1,1],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]];
const O = [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]];
const D = [[1,1,1,0,0],[1,0,0,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,1,0],[1,1,1,0,0]];
const E = [[1,1,1,1,0],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,1,0]];
const N = [[1,0,0,0,1],[1,1,0,0,1],[1,0,1,0,1],[1,0,0,1,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1]];
const L = [[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,1,1]];
const I = [[1,1,1,0,0],[0,1,0,0,0],[0,1,0,0,0],[0,1,0,0,0],[0,1,0,0,0],[0,1,0,0,0],[1,1,1,0,0]];
const S = [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,0],[0,1,1,1,0],[0,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]];
const H = [[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,1,1,1,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1]];

const GOOD    = [G, O, O, D];
const ENGLISH = [E, N, G, L, I, S, H];

// ─── Single pixel block ───────────────────────────────────────────────────────
// faceColor = main block, hiColor = 1px top highlight strip, shadow always dark
interface BlockProps { x: number; y: number; p: number; face: string; hi: string }

function Block({ x, y, p, face, hi }: BlockProps) {
  const hs = Math.max(1, Math.round(p / 5)); // highlight strip height
  return (
    <g>
      {/* 1px drop shadow */}
      <rect x={x + 1} y={y + 1} width={p} height={p} fill="#06090C" />
      {/* Main face */}
      <rect x={x} y={y} width={p} height={p} fill={face} />
      {/* Top highlight strip */}
      <rect x={x} y={y} width={p} height={hs} fill={hi} />
    </g>
  );
}

// ─── Render one word at (ox, oy) with given colors ────────────────────────────
function Word({
  letters, ox, oy, p, gap, face, hi,
}: {
  letters: number[][][];
  ox: number; oy: number;
  p: number; gap: number;
  face: string; hi: string;
}) {
  const nodes: React.ReactNode[] = [];
  letters.forEach((grid, li) => {
    const lx = ox + li * (5 * p + gap);
    grid.forEach((row, ri) => {
      row.forEach((v, ci) => {
        if (v) {
          nodes.push(
            <Block
              key={`${li}-${ri}-${ci}`}
              x={lx + ci * p}
              y={oy + ri * p}
              p={p}
              face={face}
              hi={hi}
            />
          );
        }
      });
    });
  });
  return <>{nodes}</>;
}

// ─── Core wordmark SVG builder ────────────────────────────────────────────────
// p  = block size in px
// gap = spacing between letters within a word
// Returns a self-contained <svg> with dark rounded background

function Wordmark({ p, gap, padX, padY, r }: {
  p: number;
  gap: number;
  padX: number;
  padY: number;
  r: number;
}) {
  const letterW = 5 * p;
  const letterH = 7 * p;

  // Word widths
  const goodW   = GOOD.length    * (letterW + gap) - gap;
  const engW    = ENGLISH.length * (letterW + gap) - gap;
  const wordGap = Math.round(p * 1.6); // gap between GOOD and ENGLISH

  const contentW = goodW + wordGap + engW + 1; // +1 for shadow
  const contentH = letterH + 1;

  const bgW = contentW + padX * 2;
  const bgH = contentH + padY * 2;

  return (
    <svg
      viewBox={`0 0 ${bgW} ${bgH}`}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="GOOD ENGLISH"
      role="img"
    >
      {/* Dark background */}
      <rect width={bgW} height={bgH} rx={r} ry={r} fill="#111518" />
      {/* GOOD — gray */}
      <Word
        letters={GOOD}
        ox={padX}
        oy={padY}
        p={p} gap={gap}
        face="#7A8694"
        hi="#A4B0BC"
      />
      {/* ENGLISH — light */}
      <Word
        letters={ENGLISH}
        ox={padX + goodW + wordGap}
        oy={padY}
        p={p} gap={gap}
        face="#C0CDD8"
        hi="#E2EBF2"
      />
    </svg>
  );
}

// ─── Small "G" icon only (collapsed sidebar) ──────────────────────────────────
function GIcon({ height }: { height: number }) {
  const p = 3;
  const vw = 5 * p + 1;  // 16
  const vh = 7 * p + 1;  // 22
  const w  = Math.round(height * (vw / vh));
  return (
    <svg
      width={w} height={height}
      viewBox={`0 0 ${vw} ${vh}`}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="G"
      role="img"
    >
      <Word letters={[G]} ox={0} oy={0} p={p} gap={0} face="#C0CDD8" hi="#E2EBF2" />
    </svg>
  );
}

// ─── Public components ────────────────────────────────────────────────────────

/**
 * Small inline logo — matches the opencode header logo style.
 * Used in mobile top bar and sidebar expanded state.
 * Rendered at natural SVG size (auto width × ~22px tall).
 */
export function LogoSmall() {
  // p=2, gap=2 → letters 10×14px, BG ~144×22px
  return (
    <span className="inline-flex items-center" style={{ lineHeight: 0 }}>
      <Wordmark p={2} gap={2} padX={5} padY={4} r={3} />
    </span>
  );
}

/**
 * Large dashboard hero wordmark.
 * p=5, BG ~348×56px — scales with container.
 */
export function LogoLarge() {
  return (
    <div className="w-full max-w-[360px]" style={{ lineHeight: 0 }}>
      <Wordmark p={5} gap={4} padX={10} padY={8} r={6} />
    </div>
  );
}

/**
 * Sidebar logo slot:
 * - collapsed → small "G" icon
 * - expanded  → small full wordmark
 */
export function SidebarLogo({ collapsed }: { collapsed: boolean }) {
  if (collapsed) return <GIcon height={22} />;
  return <LogoSmall />;
}

/**
 * Mobile top-bar logo (always full wordmark, small).
 */
export function TopBarLogo() {
  return <LogoSmall />;
}

/**
 * Dashboard h1 pixel wordmark.
 */
export function GoodEnglishHeading() {
  return (
    <div>
      <h1 className="sr-only">Good English</h1>
      <LogoLarge />
    </div>
  );
}
