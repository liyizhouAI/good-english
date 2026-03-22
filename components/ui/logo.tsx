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

// ─── Pixel block: main face + 1px shadow + 1px highlight strip ───────────────
function Block({ x, y, p, face, hi }: {
  x: number; y: number; p: number; face: string; hi: string;
}) {
  return (
    <g>
      <rect x={x + 1} y={y + 1} width={p} height={p} fill="#06090C" />
      <rect x={x}     y={y}     width={p} height={p} fill={face} />
      <rect x={x}     y={y}     width={p} height={1}  fill={hi} />
    </g>
  );
}

// ─── Render one word ──────────────────────────────────────────────────────────
function Word({ letters, ox, oy, p, gap, face, hi }: {
  letters: number[][][]; ox: number; oy: number;
  p: number; gap: number; face: string; hi: string;
}) {
  const nodes: React.ReactNode[] = [];
  letters.forEach((grid, li) => {
    const lx = ox + li * (5 * p + gap);
    grid.forEach((row, ri) =>
      row.forEach((v, ci) => {
        if (v) nodes.push(
          <Block key={`${li}-${ri}-${ci}`}
            x={lx + ci * p} y={oy + ri * p}
            p={p} face={face} hi={hi} />
        );
      })
    );
  });
  return <>{nodes}</>;
}

// ─── Core SVG wordmark (always transparent background) ───────────────────────
function Wordmark({ p, gap }: { p: number; gap: number }) {
  const lw = 5 * p;
  const lh = 7 * p;
  const goodW  = GOOD.length    * (lw + gap) - gap;
  const engW   = ENGLISH.length * (lw + gap) - gap;
  const wGap   = Math.round(p * 1.8);           // gap between words
  const totalW = goodW + wGap + engW + 1;        // +1 shadow bleed
  const totalH = lh + 1;

  return (
    <svg
      viewBox={`0 0 ${totalW} ${totalH}`}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="GOOD ENGLISH"
      role="img"
      style={{ display: 'block' }}
    >
      <Word letters={GOOD}    ox={0}             oy={0} p={p} gap={gap} face="#7A8694" hi="#A4B0BC" />
      <Word letters={ENGLISH} ox={goodW + wGap}  oy={0} p={p} gap={gap} face="#C0CDD8" hi="#E2EBF2" />
    </svg>
  );
}

// ─── Banner logo (top-bar, no background, compact) ───────────────────────────
// p=2 → letters 10×14px → full wordmark ~130×15px
export function LogoBanner() {
  return <Wordmark p={2} gap={2} />;
}

// ─── Dashboard hero logo (larger) ────────────────────────────────────────────
// p=4 → letters 20×28px → full wordmark ~260×29px
export function LogoLarge() {
  return (
    <div className="w-full max-w-[280px]">
      <Wordmark p={4} gap={3} />
    </div>
  );
}

// Re-export for backward compat in sidebar
export { LogoBanner as TopBarLogo };
export function SidebarLogo({ collapsed: _ }: { collapsed: boolean }) {
  return null; // replaced by slogan in sidebar
}
export function GoodEnglishHeading() {
  return (
    <div>
      <h1 className="sr-only">Good English</h1>
      <LogoLarge />
    </div>
  );
}
