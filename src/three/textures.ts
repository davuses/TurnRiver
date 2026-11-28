import * as THREE from 'three';
import type { Card, Position, Suit } from '../poker/types';

export type FeltThemeId = 'emerald' | 'navy' | 'crimson';

const FELT_PALETTES: Record<
  FeltThemeId,
  {
    center: string;
    mid: string;
    edge: string;
    weaveLight: string;
    weaveDark: string;
    accentGold: string;
  }
> = {
  emerald: {
    center: '#145a40',
    mid: '#0c3f2c',
    edge: '#051f16',
    weaveLight: 'rgba(110, 231, 183, 0.055)',
    weaveDark: 'rgba(2, 16, 11, 0.22)',
    accentGold: 'rgba(218, 182, 102, 0.52)',
  },
  navy: {
    center: '#163c68',
    mid: '#0e2847',
    edge: '#061326',
    weaveLight: 'rgba(125, 200, 255, 0.055)',
    weaveDark: 'rgba(3, 10, 22, 0.24)',
    accentGold: 'rgba(218, 186, 118, 0.5)',
  },
  crimson: {
    center: '#6d1d2d',
    mid: '#4a121e',
    edge: '#22070d',
    weaveLight: 'rgba(255, 165, 180, 0.055)',
    weaveDark: 'rgba(20, 3, 7, 0.25)',
    accentGold: 'rgba(226, 190, 112, 0.54)',
  },
};

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Bespoke 1024x640 casino speed-cloth baize layout projected 1:1 onto the oval playing felt:
 * - Warm radial spotlight vignette
 * - Authentic woven speed-cloth diamond & suited micro-pattern
 * - Double brushed-gold oval betting line
 * - Embossed TurnRiver High Stakes center watermark & 5 subtle board card slots
 */
export function createFeltTextures(
  theme: FeltThemeId,
  maxAnisotropy: number
): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const palette = FELT_PALETTES[theme];
  const w = 1024;
  const h = 640;
  const [canvas, ctx] = makeCanvas(w, h);
  const cx = w / 2;
  const cy = h / 2;

  // 1. Deep radial casino baize gradient (natural falloff under overhead pendant pool)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1.35, 0.88);
  const grad = ctx.createRadialGradient(0, -18, 28, 0, 0, 420);
  grad.addColorStop(0, palette.center);
  grad.addColorStop(0.58, palette.mid);
  grad.addColorStop(1, palette.edge);
  ctx.fillStyle = grad;
  ctx.fillRect(-w, -h, w * 2, h * 2);
  ctx.restore();

  // 2. Speed-cloth micro-woven cross-hatch + subtle suited diamond lattice
  const rand = mulberry32(theme === 'emerald' ? 101 : theme === 'navy' ? 202 : 303);
  ctx.fillStyle = palette.weaveDark;
  for (let y = 0; y < h; y += 3) {
    ctx.fillRect(0, y, w, 1);
  }
  ctx.fillStyle = palette.weaveLight;
  for (let x = 0; x < w; x += 4) {
    ctx.fillRect(x, 0, 1, h);
  }

  // Subtle suited casino speed-cloth pattern (faint diamonds & suit pips)
  ctx.strokeStyle = palette.weaveLight;
  ctx.lineWidth = 1;
  const step = 36;
  const glyphs = ['♠', '♥', '♦', '♣'];
  ctx.font = '11px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let gIdx = 0;
  for (let y = 18; y < h; y += step) {
    for (let x = 18; x < w; x += step) {
      const ox = ((y / step) % 2) * (step / 2);
      const px = x + ox;
      ctx.beginPath();
      ctx.moveTo(px, y - 10);
      ctx.lineTo(px + 10, y);
      ctx.lineTo(px, y + 10);
      ctx.lineTo(px - 10, y);
      ctx.closePath();
      ctx.stroke();

      ctx.fillStyle = palette.weaveLight;
      ctx.fillText(glyphs[gIdx++ % 4], px, y + 0.5);
    }
  }

  // Fine woolen felt grain noise
  for (let i = 0; i < 11000; i++) {
    const px = Math.floor(rand() * w);
    const py = Math.floor(rand() * h);
    ctx.fillStyle = rand() > 0.5 ? palette.weaveLight : palette.weaveDark;
    ctx.fillRect(px, py, 2, 2);
  }

  // 3. Double gold casino betting-line oval
  ctx.strokeStyle = palette.accentGold;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, w * 0.375, h * 0.355, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(218, 182, 102, 0.22)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(cx, cy, w * 0.365, h * 0.342, 0, 0, Math.PI * 2);
  ctx.stroke();

  // 4. Subtle embossed casino emblem & 5 community card slot hairlines (aligned 1:1 to 3D board at z = -0.08)
  ctx.fillStyle = 'rgba(225, 195, 125, 0.2)';
  ctx.font = '700 22px "Space Grotesk", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TURNRIVER  ·  HIGH STAKES', cx, cy - 150);

  ctx.fillStyle = 'rgba(225, 195, 125, 0.14)';
  ctx.font = '600 13px "JetBrains Mono", monospace';
  ctx.fillText('NO-LIMIT TEXAS HOLD’EM  ·  CASINO SALON', cx, cy + 148);

  // 5 faint gold-hairline community card outlines matching 3D board spacing (0.44u -> 77px)
  ctx.strokeStyle = 'rgba(225, 195, 125, 0.18)';
  ctx.lineWidth = 1.5;
  const slotW = 64;
  const slotH = 104;
  const slotGap = 13;
  const totalW = 5 * slotW + 4 * slotGap;
  const startX = cx - totalW / 2;
  const slotY = cy - 16 - slotH / 2;
  for (let i = 0; i < 5; i++) {
    const sx = startX + i * (slotW + slotGap);
    ctx.strokeRect(sx, slotY, slotW, slotH);
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = Math.min(8, maxAnisotropy);

  // Linear micro-baize bump map
  const [bCanvas, bCtx] = makeCanvas(256, 256);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 256, 256);
  const randB = mulberry32(404);
  for (let i = 0; i < 8000; i++) {
    const v = Math.floor(102 + randB() * 52);
    bCtx.fillStyle = `rgb(${v},${v},${v})`;
    bCtx.fillRect(Math.floor(randB() * 256), Math.floor(randB() * 256), 2, 2);
  }
  const bumpMap = new THREE.CanvasTexture(bCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(9, 6);
  bumpMap.anisotropy = Math.min(4, maxAnisotropy);

  return { map, bumpMap };
}

/**
 * Rich lacquered dark mahogany / walnut wood grain for the casino racetrack ring
 */
export function createMahoganyWoodTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const w = 512;
  const h = 256;
  const [canvas, ctx] = makeCanvas(w, h);
  const [bCanvas, bCtx] = makeCanvas(w, h);

  ctx.fillStyle = '#3b190d';
  ctx.fillRect(0, 0, w, h);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, w, h);

  const rand = mulberry32(515);
  // Flowing rich burled mahogany / reddish-walnut grain bands
  for (let y = 0; y < h; y++) {
    const wave = Math.sin(y * 0.13) * 0.55 + Math.sin(y * 0.041 + 1.4) * 0.45;
    const r = Math.floor(66 + wave * 32 + rand() * 10);
    const g = Math.floor(26 + wave * 14 + rand() * 6);
    const b = Math.floor(13 + wave * 7 + rand() * 4);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, y, w, 1);

    const bv = Math.floor(120 + wave * 18 + (rand() - 0.5) * 14);
    bCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
    bCtx.fillRect(0, y, w, 1);
  }

  // Dark walnut pores & warm amber highlights
  for (let i = 0; i < 480; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const len = 18 + rand() * 96;
    ctx.fillStyle = rand() > 0.35 ? 'rgba(20, 7, 3, 0.42)' : 'rgba(148, 72, 32, 0.24)';
    ctx.fillRect(x, y, len, 1.4);
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(4, 2);
  map.anisotropy = Math.min(8, maxAnisotropy);

  const bumpMap = new THREE.CanvasTexture(bCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(4, 2);

  return { map, bumpMap };
}

/**
 * Supple deep charcoal-espresso casino armrest leather with fine pebbled grain
 */
export function createLeatherRailTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size, size);
  ctx.fillStyle = '#0d0b0e';
  ctx.fillRect(0, 0, size, size);

  const rand = mulberry32(707);
  for (let i = 0; i < 3600; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 0.9 + rand() * 2.4;
    const shade = Math.floor(10 + rand() * 14);
    ctx.fillStyle = `rgba(${shade + 4}, ${shade + 1}, ${shade + 2}, 0.55)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(10, 3);
  map.anisotropy = Math.min(4, maxAnisotropy);

  const [bCanvas, bCtx] = makeCanvas(256, 256);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 256, 256);
  const randB = mulberry32(808);
  for (let i = 0; i < 3400; i++) {
    const v = Math.floor(92 + randB() * 72);
    bCtx.fillStyle = `rgb(${v},${v},${v})`;
    bCtx.beginPath();
    bCtx.arc(randB() * 256, randB() * 256, 1.4 + randB() * 2.2, 0, Math.PI * 2);
    bCtx.fill();
  }
  const bumpMap = new THREE.CanvasTexture(bCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(10, 3);

  return { map, bumpMap };
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size, size);
  const grad = ctx.createRadialGradient(size / 2, size / 2, 12, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.78)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.38)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Luxury dark Monte-Carlo / Bellagio Axminster casino salon carpet (subtle warm bronze diamond motif)
 */
export function createStudioFloorTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const [canvas, ctx] = makeCanvas(size, size);

  ctx.fillStyle = '#0d0b10';
  ctx.fillRect(0, 0, size, size);

  // Subtle woven carpet fibers
  const rand = mulberry32(909);
  for (let i = 0; i < 9000; i++) {
    const x = Math.floor(rand() * size);
    const y = Math.floor(rand() * size);
    const v = Math.floor(12 + rand() * 16);
    ctx.fillStyle = `rgb(${v + 4}, ${v}, ${v + 5})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Ornate dark-gold geometric salon carpet diamond trellis
  const tile = 128;
  ctx.strokeStyle = 'rgba(180, 138, 72, 0.09)';
  ctx.lineWidth = 2;
  for (let y = 0; y < size; y += tile) {
    for (let x = 0; x < size; x += tile) {
      const mx = x + tile / 2;
      const my = y + tile / 2;
      ctx.beginPath();
      ctx.moveTo(mx, y + 10);
      ctx.lineTo(x + tile - 10, my);
      ctx.lineTo(mx, y + tile - 10);
      ctx.lineTo(x + 10, my);
      ctx.closePath();
      ctx.stroke();

      ctx.strokeStyle = 'rgba(22, 92, 66, 0.1)';
      ctx.beginPath();
      ctx.arc(mx, my, 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(180, 138, 72, 0.09)';
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(9, 9);
  tex.anisotropy = Math.min(8, maxAnisotropy);
  return tex;
}

export type CardStyle = 'classic' | 'jumbo';

function suitHex(suit: Suit, fourColor: boolean): string {
  if (fourColor) {
    switch (suit) {
      case 's':
        return '#0a0e16';
      case 'h':
        return '#a80f24';
      case 'd':
        return '#084294';
      case 'c':
        return '#0a5e2a';
    }
  }
  return suit === 'h' || suit === 'd' ? '#c8102e' : '#090b10';
}

function drawVectorSuitPip(
  ctx: CanvasRenderingContext2D,
  suit: Suit,
  cx: number,
  cy: number,
  size: number,
  fillStyle: string
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = fillStyle;
  ctx.beginPath();

  if (suit === 'h') {
    // Classic plump casino heart
    const s = size;
    ctx.moveTo(0, s * 0.92);
    ctx.bezierCurveTo(-s * 0.98, s * 0.25, -s * 1.06, -s * 0.62, -s * 0.48, -s * 0.86);
    ctx.bezierCurveTo(-s * 0.16, -s * 0.98, 0, -s * 0.68, 0, -s * 0.44);
    ctx.bezierCurveTo(0, -s * 0.68, s * 0.16, -s * 0.98, s * 0.48, -s * 0.86);
    ctx.bezierCurveTo(s * 1.06, -s * 0.62, s * 0.98, s * 0.25, 0, s * 0.92);
    ctx.closePath();
    ctx.fill();
  } else if (suit === 'd') {
    // Authentic casino diamond with subtle concave facets
    const w = size * 0.78;
    const h = size * 1.02;
    ctx.moveTo(0, -h);
    ctx.quadraticCurveTo(w * 0.34, -h * 0.32, w, 0);
    ctx.quadraticCurveTo(w * 0.34, h * 0.32, 0, h);
    ctx.quadraticCurveTo(-w * 0.34, h * 0.32, -w, 0);
    ctx.quadraticCurveTo(-w * 0.34, -h * 0.32, 0, -h);
    ctx.closePath();
    ctx.fill();
  } else if (suit === 's') {
    // Classic sharp-tipped spade leaf + crisp flared pedestal stem (distinct from 3-lobed club)
    const s = size;
    ctx.moveTo(0, -s * 1.08);
    ctx.bezierCurveTo(s * 0.86, -s * 0.28, s * 1.04, s * 0.44, s * 0.48, s * 0.62);
    ctx.bezierCurveTo(s * 0.22, s * 0.70, s * 0.10, s * 0.50, s * 0.08, s * 0.42);
    ctx.quadraticCurveTo(s * 0.13, s * 0.82, s * 0.36, s * 0.98);
    ctx.lineTo(-s * 0.36, s * 0.98);
    ctx.quadraticCurveTo(-s * 0.13, s * 0.82, -s * 0.08, s * 0.42);
    ctx.bezierCurveTo(-s * 0.10, s * 0.50, -s * 0.22, s * 0.70, -s * 0.48, s * 0.62);
    ctx.bezierCurveTo(-s * 1.04, s * 0.44, -s * 0.86, -s * 0.28, 0, -s * 1.08);
    ctx.closePath();
    ctx.fill();
  } else {
    // Crisp 3-lobed clover club with wide lobe separation so it never blobs into a spade at distance
    const s = size;
    const r = s * 0.35;
    ctx.arc(0, -s * 0.54, r, 0, Math.PI * 2);
    ctx.moveTo(-s * 0.54 + r, s * 0.08);
    ctx.arc(-s * 0.54, s * 0.08, r, 0, Math.PI * 2);
    ctx.moveTo(s * 0.54 + r, s * 0.08);
    ctx.arc(s * 0.54, s * 0.08, r, 0, Math.PI * 2);
    ctx.fill();

    // Small center join + slender flared pedestal stem
    ctx.beginPath();
    ctx.arc(0, -s * 0.08, s * 0.20, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-s * 0.11, -s * 0.04);
    ctx.lineTo(s * 0.11, -s * 0.04);
    ctx.quadraticCurveTo(s * 0.12, s * 0.68, s * 0.34, s * 0.98);
    ctx.lineTo(-s * 0.34, s * 0.98);
    ctx.quadraticCurveTo(-s * 0.12, s * 0.68, -s * 0.11, -s * 0.04);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

export function createCardFaceTexture(
  card: Card,
  fourColor: boolean,
  style: CardStyle = 'classic'
): THREE.CanvasTexture {
  const w = 512;
  const h = 720;
  const [canvas, ctx] = makeCanvas(w, h);

  // Crisp high-contrast bright white playing card face (classic Bicycle-style legibility)
  const paperGrad = ctx.createRadialGradient(w * 0.48, h * 0.42, 40, w / 2, h / 2, w * 0.95);
  paperGrad.addColorStop(0, '#ffffff');
  paperGrad.addColorStop(0.75, '#fbfcfe');
  paperGrad.addColorStop(1, '#f3f5f8');
  ctx.fillStyle = paperGrad;
  ctx.fillRect(0, 0, w, h);

  // Crisp rounded outer card border
  const drawRoundedRect = (x: number, y: number, rw: number, rh: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + rw - r, y);
    ctx.quadraticCurveTo(x + rw, y, x + rw, y + r);
    ctx.lineTo(x + rw, y + rh - r);
    ctx.quadraticCurveTo(x + rw, y + rh, x + rw - r, y + rh);
    ctx.lineTo(x + r, y + rh);
    ctx.quadraticCurveTo(x, y + rh, x, y + rh - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  drawRoundedRect(12, 12, w - 24, h - 24, 24);
  ctx.strokeStyle = 'rgba(42, 48, 58, 0.72)';
  ctx.lineWidth = 3;
  ctx.stroke();

  const color = suitHex(card.suit, fourColor);
  const rankDisplay = card.rank === 'T' ? '10' : card.rank;
  const isCourt = card.rank === 'J' || card.rank === 'Q' || card.rank === 'K';
  const isAce = card.rank === 'A';
  const isJumbo = style === 'jumbo';

  // Helper: draw crisp top-left (or mirrored bottom-right) corner index with condensed "10"
  const drawCornerIndex = (inverted: boolean) => {
    ctx.save();
    if (inverted) {
      ctx.translate(w, h);
      ctx.rotate(Math.PI);
    }
    const cx = isJumbo ? 68 : 48;
    const rankY = isJumbo ? 88 : 64;
    const pipY = isJumbo ? 182 : 138;
    const pipSize = isJumbo ? 32 : 28;

    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.save();
    ctx.translate(cx, rankY);
    if (card.rank === 'T') {
      // Authentic horizontally condensed "10" so it sits neatly above the corner pip without ever colliding
      ctx.scale(isJumbo ? 0.62 : 0.68, 1);
      ctx.font = isJumbo
        ? '800 128px "JetBrains Mono", ui-monospace, sans-serif'
        : '800 90px Georgia, "Times New Roman", serif';
      ctx.fillText('10', 0, 0);
    } else {
      ctx.font = isJumbo
        ? '800 126px "JetBrains Mono", ui-monospace, sans-serif'
        : '800 88px Georgia, "Times New Roman", serif';
      ctx.fillText(rankDisplay, 0, 0);
    }
    ctx.restore();

    drawVectorSuitPip(ctx, card.suit, cx, pipY, pipSize, color);
    ctx.restore();
  };

  // Helper: compact royal crest for Jumbo face cards
  const drawCompactCrest = (cx: number, cy: number) => {
    ctx.save();
    ctx.translate(cx, cy);
    if (card.rank === 'K') {
      ctx.beginPath();
      ctx.moveTo(-42, 18);
      ctx.lineTo(-48, -16);
      ctx.lineTo(-22, 0);
      ctx.lineTo(0, -26);
      ctx.lineTo(22, 0);
      ctx.lineTo(48, -16);
      ctx.lineTo(42, 18);
      ctx.closePath();
      ctx.fillStyle = '#d4a135';
      ctx.fill();
      ctx.strokeStyle = '#3b2809';
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.fillStyle = color;
      for (const jx of [-22, 0, 22]) {
        ctx.beginPath();
        ctx.arc(jx, 10, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (card.rank === 'Q') {
      ctx.beginPath();
      ctx.moveTo(-38, 16);
      ctx.quadraticCurveTo(-34, -14, -18, 2);
      ctx.quadraticCurveTo(0, -30, 18, 2);
      ctx.quadraticCurveTo(34, -14, 38, 16);
      ctx.closePath();
      ctx.fillStyle = '#dbb04a';
      ctx.fill();
      ctx.strokeStyle = '#3b2809';
      ctx.lineWidth = 3.2;
      ctx.stroke();
      ctx.fillStyle = '#faf3e0';
      for (const [px, py] of [[-34, -9], [0, -22], [34, -9]] as Array<[number, number]>) {
        ctx.beginPath();
        ctx.arc(px, py, 4.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      ctx.moveTo(-28, -18);
      ctx.lineTo(28, -18);
      ctx.lineTo(28, 2);
      ctx.quadraticCurveTo(24, 18, 0, 26);
      ctx.quadraticCurveTo(-24, 18, -28, 2);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#d4a135';
      ctx.lineWidth = 4.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-20, 2);
      ctx.lineTo(0, -10);
      ctx.lineTo(20, 2);
      ctx.strokeStyle = '#f4d98b';
      ctx.lineWidth = 5;
      ctx.stroke();
    }
    ctx.restore();
  };

  // Helper: authentic symmetrical double-headed casino court illustration (J / Q / K)
  const drawCourtPortrait = () => {
    const fx = 116;
    const fy = 94;
    const fw = w - fx * 2;
    const fh = h - fy * 2;

    // Clean white classic court panel backdrop with crisp dark outline
    drawRoundedRect(fx, fy, fw, fh, 6);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#1e242c';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Primary & secondary royal robe palette (classic French-deck harmonies)
    const isRedSuit = card.suit === 'h' || card.suit === 'd';
    const robePrimary =
      fourColor && card.suit === 'd'
        ? '#12468f'
        : fourColor && card.suit === 'c'
          ? '#0f5c30'
          : isRedSuit
            ? '#9d1b2b'
            : '#1a2744';
    const robeAccent = isRedSuit ? '#1e355e' : '#9c1d2b';
    const goldFill = '#d4a33a';
    const goldDark = '#6b4b11';
    const inkStroke = '#1c1814';

    // Clip all interior court artwork cleanly inside the frame
    ctx.save();
    drawRoundedRect(fx + 3, fy + 3, fw - 6, fh - 6, 10);
    ctx.clip();

    // Subtle diamond brocade watermark behind figure
    ctx.strokeStyle = 'rgba(176, 134, 48, 0.14)';
    ctx.lineWidth = 1.5;
    for (let y = fy + 20; y < fy + fh; y += 36) {
      for (let x = fx + 20; x < fx + fw; x += 36) {
        ctx.beginPath();
        ctx.moveTo(x, y - 9);
        ctx.lineTo(x + 9, y);
        ctx.lineTo(x, y + 9);
        ctx.lineTo(x - 9, y);
        ctx.closePath();
        ctx.stroke();
      }
    }

    const drawCourtHalf = (inverted: boolean) => {
      ctx.save();
      if (inverted) {
        ctx.translate(w, h);
        ctx.rotate(Math.PI);
      }
      // Clip to top half with diagonal waist cut (classic Bicycle/Kem double-headed split)
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + fw, fy);
      ctx.lineTo(fx + fw, h / 2 - 22);
      ctx.lineTo(fx, h / 2 + 22);
      ctx.closePath();
      ctx.clip();

      const cx = w / 2;

      // 1. Royal torso & layered velvet cloak
      ctx.beginPath();
      ctx.moveTo(cx - 118, h / 2 + 30);
      ctx.quadraticCurveTo(cx - 104, 246, cx - 50, 224);
      ctx.lineTo(cx + 50, 224);
      ctx.quadraticCurveTo(cx + 104, 246, cx + 118, h / 2 + 30);
      ctx.closePath();
      ctx.fillStyle = robePrimary;
      ctx.fill();
      ctx.strokeStyle = inkStroke;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Secondary royal tunic panel & gold brocade trim
      ctx.beginPath();
      ctx.moveTo(cx - 48, h / 2 + 30);
      ctx.lineTo(cx - 34, 232);
      ctx.lineTo(cx + 34, 232);
      ctx.lineTo(cx + 48, h / 2 + 30);
      ctx.closePath();
      ctx.fillStyle = robeAccent;
      ctx.fill();
      ctx.strokeStyle = goldFill;
      ctx.lineWidth = 4;
      ctx.stroke();

      // Diagonal gold heraldic sash across chest
      ctx.beginPath();
      ctx.moveTo(cx - 72, 244);
      ctx.lineTo(cx - 46, 234);
      ctx.lineTo(cx + 66, h / 2 + 12);
      ctx.lineTo(cx + 38, h / 2 + 22);
      ctx.closePath();
      ctx.fillStyle = goldFill;
      ctx.fill();
      ctx.strokeStyle = goldDark;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Small decorative suit crest on chest
      drawVectorSuitPip(ctx, card.suit, cx, 294, 17, '#f4d98b');

      // White ermine royal collar with classic black spots
      ctx.beginPath();
      ctx.moveTo(cx - 56, 232);
      ctx.quadraticCurveTo(cx, 256, cx + 56, 232);
      ctx.quadraticCurveTo(cx + 48, 214, cx + 26, 212);
      ctx.lineTo(cx - 26, 212);
      ctx.quadraticCurveTo(cx - 48, 214, cx - 56, 232);
      ctx.closePath();
      ctx.fillStyle = '#faf5e8';
      ctx.fill();
      ctx.strokeStyle = inkStroke;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = inkStroke;
      for (const ex of [-34, -16, 0, 16, 34]) {
        ctx.beginPath();
        ctx.arc(cx + ex, 227 + (ex === 0 ? 3 : 0), 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Regalia held at right side (King sword, Queen Tudor rose, Jack halberd)
      if (card.rank === 'K') {
        // Upright royal broadsword blade & gilded crossguard
        ctx.save();
        ctx.translate(cx + 84, 218);
        ctx.rotate(-0.14);
        ctx.beginPath();
        ctx.moveTo(0, -102);
        ctx.lineTo(9, -82);
        ctx.lineTo(7, 26);
        ctx.lineTo(-7, 26);
        ctx.lineTo(-9, -82);
        ctx.closePath();
        ctx.fillStyle = '#cbd5e1';
        ctx.fill();
        ctx.strokeStyle = inkStroke;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -90);
        ctx.lineTo(0, 22);
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = goldFill;
        ctx.fillRect(-24, 22, 48, 10);
        ctx.strokeStyle = goldDark;
        ctx.lineWidth = 2;
        ctx.strokeRect(-24, 22, 48, 10);
        ctx.fillStyle = robePrimary;
        ctx.fillRect(-5, 32, 10, 24);
        ctx.beginPath();
        ctx.arc(0, 60, 8, 0, Math.PI * 2);
        ctx.fillStyle = goldFill;
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else if (card.rank === 'Q') {
        // Queen's Tudor rose on gilded stem
        ctx.save();
        ctx.translate(cx + 82, 226);
        ctx.beginPath();
        ctx.moveTo(-4, 62);
        ctx.quadraticCurveTo(4, 24, 0, -6);
        ctx.strokeStyle = '#1f6a3a';
        ctx.lineWidth = 4.5;
        ctx.stroke();
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * Math.PI * 2 - Math.PI / 2;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * 12, -16 + Math.sin(a) * 12, 10, 0, Math.PI * 2);
          ctx.fillStyle = isRedSuit ? '#c82333' : '#b8324a';
          ctx.fill();
          ctx.strokeStyle = inkStroke;
          ctx.lineWidth = 1.8;
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(0, -16, 7.5, 0, Math.PI * 2);
        ctx.fillStyle = goldFill;
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else {
        // Jack's gilded & steel halberd polearm
        ctx.save();
        ctx.translate(cx + 84, 212);
        ctx.rotate(-0.1);
        ctx.fillStyle = '#7c4a1d';
        ctx.fillRect(-3.5, -62, 7, 152);
        ctx.strokeStyle = inkStroke;
        ctx.lineWidth = 2;
        ctx.strokeRect(-3.5, -62, 7, 152);
        ctx.beginPath();
        ctx.moveTo(0, -96);
        ctx.lineTo(10, -60);
        ctx.quadraticCurveTo(30, -44, 24, -18);
        ctx.quadraticCurveTo(8, -28, 3, -30);
        ctx.lineTo(-3, -30);
        ctx.lineTo(-18, -42);
        ctx.lineTo(-8, -60);
        ctx.closePath();
        ctx.fillStyle = '#cbd5e1';
        ctx.fill();
        ctx.strokeStyle = inkStroke;
        ctx.lineWidth = 2.4;
        ctx.stroke();
        ctx.restore();
      }

      // 3. Sculpted hair & royal head
      ctx.fillStyle = card.rank === 'Q' ? '#faf2df' : '#d8b25a';
      ctx.strokeStyle = inkStroke;
      ctx.lineWidth = 2.5;
      if (card.rank === 'Q') {
        // Flowing royal veil behind Queen's head
        ctx.beginPath();
        ctx.moveTo(cx - 34, 152);
        ctx.quadraticCurveTo(cx - 56, 188, cx - 44, 224);
        ctx.lineTo(cx + 44, 224);
        ctx.quadraticCurveTo(cx + 56, 188, cx + 34, 152);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        // Stylized golden curled hair rolls
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.arc(cx + side * 34, 178, 16, 0, Math.PI * 2);
          ctx.arc(cx + side * 36, 198, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }

      // Face oval
      ctx.beginPath();
      ctx.ellipse(cx, 184, 30, 36, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#f6dfc2';
      ctx.fill();
      ctx.strokeStyle = inkStroke;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Eyes & brows
      ctx.strokeStyle = inkStroke;
      ctx.lineWidth = 2.2;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + side * 6, 172);
        ctx.quadraticCurveTo(cx + side * 13, 168, cx + side * 20, 172);
        ctx.stroke();
        ctx.fillStyle = inkStroke;
        ctx.beginPath();
        ctx.arc(cx + side * 12, 179, 2.8, 0, Math.PI * 2);
        ctx.fill();
      }
      // Nose bridge
      ctx.beginPath();
      ctx.moveTo(cx, 178);
      ctx.lineTo(cx - 2, 191);
      ctx.lineTo(cx + 3, 192);
      ctx.stroke();

      // Beard (King) vs serene mouth (Queen/Jack)
      if (card.rank === 'K') {
        ctx.beginPath();
        ctx.moveTo(cx - 26, 195);
        ctx.quadraticCurveTo(cx - 24, 222, cx, 228);
        ctx.quadraticCurveTo(cx + 24, 222, cx + 26, 195);
        ctx.quadraticCurveTo(cx + 12, 206, cx, 203);
        ctx.quadraticCurveTo(cx - 12, 206, cx - 26, 195);
        ctx.closePath();
        ctx.fillStyle = '#c89b44';
        ctx.fill();
        ctx.strokeStyle = inkStroke;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, 197);
        ctx.quadraticCurveTo(cx - 12, 193, cx - 18, 201);
        ctx.moveTo(cx, 197);
        ctx.quadraticCurveTo(cx + 12, 193, cx + 18, 201);
        ctx.strokeStyle = '#5c3f10';
        ctx.lineWidth = 2.4;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(cx - 8, 202);
        ctx.quadraticCurveTo(cx, 206, cx + 8, 202);
        ctx.strokeStyle = card.rank === 'Q' ? '#a82235' : inkStroke;
        ctx.lineWidth = 2.4;
        ctx.stroke();
      }

      // 4. Distinct Royal Headgear (King crown, Queen pearl diadem, Jack plumed beret)
      if (card.rank === 'K') {
        ctx.beginPath();
        ctx.moveTo(cx - 38, 156);
        ctx.lineTo(cx - 44, 120);
        ctx.lineTo(cx - 20, 136);
        ctx.lineTo(cx, 110);
        ctx.lineTo(cx + 20, 136);
        ctx.lineTo(cx + 44, 120);
        ctx.lineTo(cx + 38, 156);
        ctx.closePath();
        ctx.fillStyle = goldFill;
        ctx.fill();
        ctx.strokeStyle = inkStroke;
        ctx.lineWidth = 2.8;
        ctx.stroke();
        ctx.fillStyle = '#b48220';
        ctx.fillRect(cx - 38, 148, 76, 10);
        ctx.strokeRect(cx - 38, 148, 76, 10);
        ctx.fillStyle = color;
        for (const jx of [-22, 0, 22]) {
          ctx.beginPath();
          ctx.arc(cx + jx, 153, 3.6, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (card.rank === 'Q') {
        ctx.beginPath();
        ctx.moveTo(cx - 36, 155);
        ctx.quadraticCurveTo(cx - 32, 124, cx - 16, 139);
        ctx.quadraticCurveTo(cx, 108, cx + 16, 139);
        ctx.quadraticCurveTo(cx + 32, 124, cx + 36, 155);
        ctx.closePath();
        ctx.fillStyle = goldFill;
        ctx.fill();
        ctx.strokeStyle = inkStroke;
        ctx.lineWidth = 2.6;
        ctx.stroke();
        ctx.fillStyle = '#faf3e0';
        for (const [px, py] of [[-32, 127], [0, 114], [32, 127]] as Array<[number, number]>) {
          ctx.beginPath();
          ctx.arc(cx + px, py, 4.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      } else {
        // Jack plumed cavalier beret
        ctx.beginPath();
        ctx.ellipse(cx - 2, 145, 42, 16, -0.12, 0, Math.PI * 2);
        ctx.fillStyle = robePrimary;
        ctx.fill();
        ctx.strokeStyle = inkStroke;
        ctx.lineWidth = 2.6;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 34, 154);
        ctx.quadraticCurveTo(cx, 146, cx + 34, 154);
        ctx.strokeStyle = goldFill;
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 26, 140);
        ctx.quadraticCurveTo(cx - 56, 112, cx - 18, 108);
        ctx.quadraticCurveTo(cx - 28, 124, cx - 18, 138);
        ctx.closePath();
        ctx.fillStyle = '#f2c85b';
        ctx.fill();
        ctx.strokeStyle = goldDark;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.restore();
    };

    // Render top upright half & bottom 180-degree mirrored half
    drawCourtHalf(false);
    drawCourtHalf(true);

    // Gilded diagonal waist divider ribbon between the two mirrored halves
    ctx.beginPath();
    ctx.moveTo(fx - 4, h / 2 + 22);
    ctx.lineTo(fx + fw + 4, h / 2 - 22);
    ctx.strokeStyle = goldFill;
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(fx - 4, h / 2 + 22);
    ctx.lineTo(fx + fw + 4, h / 2 - 22);
    ctx.strokeStyle = goldDark;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Large, unmistakable opposite-corner suit emblems inside the court frame (Bicycle style)
    const drawCourtCornerPip = (px: number, py: number, inverted: boolean) => {
      ctx.save();
      ctx.translate(px, py);
      if (inverted) ctx.rotate(Math.PI);
      // Clean white halo so the large suit emblem pops cleanly over royal art
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.beginPath();
      ctx.arc(0, 0, 44, 0, Math.PI * 2);
      ctx.fill();
      drawVectorSuitPip(ctx, card.suit, 0, 0, 40, color);
      ctx.restore();
    };
    drawCourtCornerPip(fx + 50, fy + 56, false);
    drawCourtCornerPip(fx + fw - 50, fy + fh - 56, true);

    ctx.restore(); // end court frame clip

    // Crisp classic dark court border
    drawRoundedRect(fx, fy, fw, fh, 6);
    ctx.strokeStyle = '#1e242c';
    ctx.lineWidth = 3.5;
    ctx.stroke();
  };

  // Draw center artwork based on style ('classic' vs 'jumbo')
  if (isJumbo) {
    // Pro-grinder Jumbo layout: clean high-contrast center emblem so cards scan instantaneously
    drawRoundedRect(126, 124, w - 252, h - 248, 16);
    ctx.strokeStyle = 'rgba(176, 152, 102, 0.45)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    if (isCourt) {
      drawCompactCrest(w / 2, h / 2 - 118);
      drawVectorSuitPip(ctx, card.suit, w / 2, h / 2 + 26, 86, color);
    } else {
      drawVectorSuitPip(ctx, card.suit, w / 2, h / 2, isAce ? 104 : 92, color);
    }
  } else if (isAce) {
    // Crisp, bold, uncluttered Ace center pip (classic Bicycle proportion)
    const acePipSize = card.suit === 's' ? 88 : 80;
    drawVectorSuitPip(ctx, card.suit, w / 2, h / 2, acePipSize, color);
  } else if (isCourt) {
    drawCourtPortrait();
  } else {
    // Bold, high-contrast classic Bicycle pip grids for 2-10 with clean clearance from corner indices
    const PIP_LAYOUTS: Record<string, Array<[number, number, boolean?]>> = {
      '2': [[0.5, 0.21], [0.5, 0.79, true]],
      '3': [[0.5, 0.195], [0.5, 0.5], [0.5, 0.805, true]],
      '4': [[0.34, 0.21], [0.66, 0.21], [0.34, 0.79, true], [0.66, 0.79, true]],
      '5': [[0.34, 0.21], [0.66, 0.21], [0.5, 0.5], [0.34, 0.79, true], [0.66, 0.79, true]],
      '6': [[0.34, 0.195], [0.66, 0.195], [0.34, 0.5], [0.66, 0.5], [0.34, 0.805, true], [0.66, 0.805, true]],
      '7': [[0.34, 0.195], [0.66, 0.195], [0.5, 0.345], [0.34, 0.5], [0.66, 0.5], [0.34, 0.805, true], [0.66, 0.805, true]],
      '8': [[0.34, 0.195], [0.66, 0.195], [0.5, 0.345], [0.34, 0.5], [0.66, 0.5], [0.5, 0.655, true], [0.34, 0.805, true], [0.66, 0.805, true]],
      '9': [[0.34, 0.18], [0.66, 0.18], [0.34, 0.39], [0.66, 0.39], [0.5, 0.5], [0.34, 0.61, true], [0.66, 0.61, true], [0.34, 0.82, true], [0.66, 0.82, true]],
      'T': [[0.34, 0.175], [0.66, 0.175], [0.5, 0.295], [0.34, 0.395], [0.66, 0.395], [0.34, 0.605, true], [0.66, 0.605, true], [0.5, 0.705, true], [0.34, 0.825, true], [0.66, 0.825, true]],
    };
    const pips = PIP_LAYOUTS[card.rank] ?? [[0.5, 0.5]];
    const pipSize = pips.length >= 9 ? 47 : pips.length >= 6 ? 51 : 55;
    for (const [nx, ny, inverted] of pips) {
      const px = nx * w;
      const py = ny * h;
      if (inverted) {
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(Math.PI);
        drawVectorSuitPip(ctx, card.suit, 0, 0, pipSize, color);
        ctx.restore();
      } else {
        drawVectorSuitPip(ctx, card.suit, px, py, pipSize, color);
      }
    }
  }

  // Draw top-left & mirrored bottom-right corner indices on top so they remain razor-sharp
  drawCornerIndex(false);
  drawCornerIndex(true);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function createCardBackTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 720;
  const [canvas, ctx] = makeCanvas(w, h);

  // Warm matte ivory outer casino border (calibrated to avoid spotlight glare)
  ctx.fillStyle = '#cbc1ad';
  ctx.fillRect(0, 0, w, h);

  // Rich Monte-Carlo midnight-plum inner field
  const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, h * 0.55);
  bgGrad.addColorStop(0, '#271329');
  bgGrad.addColorStop(0.6, '#170c1c');
  bgGrad.addColorStop(1, '#0e0712');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(24, 24, w - 48, h - 48);

  // Ornate gilded diamond guilloché lattice
  ctx.strokeStyle = 'rgba(218, 178, 96, 0.34)';
  ctx.lineWidth = 2;
  for (let y = 46; y < h - 46; y += 34) {
    for (let x = 46; x < w - 46; x += 34) {
      ctx.beginPath();
      ctx.moveTo(x, y - 13);
      ctx.lineTo(x + 13, y);
      ctx.lineTo(x, y + 13);
      ctx.lineTo(x - 13, y);
      ctx.closePath();
      ctx.stroke();
    }
  }

  // Double metallic gold border frames
  ctx.strokeStyle = '#d4a94d';
  ctx.lineWidth = 6;
  ctx.strokeRect(38, 38, w - 76, h - 76);

  ctx.strokeStyle = 'rgba(244, 214, 138, 0.55)';
  ctx.lineWidth = 2;
  ctx.strokeRect(50, 50, w - 100, h - 100);

  // Central heraldic medallion crest
  ctx.fillStyle = '#180d20';
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 74, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#e0b75e';
  ctx.lineWidth = 5;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(224, 183, 94, 0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 62, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#f6e3b6';
  ctx.font = 'bold 54px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TR', w / 2, h / 2 + 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * Soft glowing radial bokeh texture for chandelier light-beam dust motes
 */
export function createBokehParticleTexture(): THREE.CanvasTexture {
  const size = 64;
  const [canvas, ctx] = makeCanvas(size, size);
  const grad = ctx.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255, 232, 180, 1)');
  grad.addColorStop(0.35, 'rgba(255, 212, 130, 0.55)');
  grad.addColorStop(1, 'rgba(255, 196, 100, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Deep diamond-tufted acoustic velvet wall panel texture for the private casino salon backdrop
 */
export function createVelvetPanelTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size, size);

  ctx.fillStyle = '#0e1714';
  ctx.fillRect(0, 0, size, size);

  // Subtle dark emerald-obsidian diamond tufting with golden micro-buttons
  const step = 64;
  ctx.strokeStyle = 'rgba(4, 10, 8, 0.72)';
  ctx.lineWidth = 3;
  for (let y = 0; y <= size; y += step) {
    for (let x = 0; x <= size; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + step, y + step);
      ctx.moveTo(x + step, y);
      ctx.lineTo(x, y + step);
      ctx.stroke();

      ctx.fillStyle = 'rgba(196, 158, 78, 0.22)';
      ctx.beginPath();
      ctx.arc(x, y, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 5);
  tex.anisotropy = Math.min(4, maxAnisotropy);
  return tex;
}

export function createDealerPuckTexture(): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size, size);

  const grad = ctx.createRadialGradient(size * 0.42, size * 0.4, 10, size / 2, size / 2, size / 2);
  grad.addColorStop(0, '#fffdf6');
  grad.addColorStop(0.75, '#ebe1c5');
  grad.addColorStop(1, '#c6ae70');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = '#7e6023';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.42, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#151820';
  ctx.font = 'bold 96px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('D', size / 2, size / 2 + 2);

  ctx.font = '700 18px "Space Grotesk", sans-serif';
  ctx.fillStyle = '#5a4419';
  ctx.fillText('DEALER', size / 2, size * 0.78);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Heavy brushed-gold casino card-protector medallion face with spade crest
 */
export function createCardProtectorTexture(): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size, size);
  const cx = size / 2;
  const cy = size / 2;

  const grad = ctx.createRadialGradient(cx - 22, cy - 22, 12, cx, cy, cx);
  grad.addColorStop(0, '#fae596');
  grad.addColorStop(0.55, '#d4a644');
  grad.addColorStop(1, '#7c5819');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Outer milled coin ring
  ctx.strokeStyle = '#5c3f0e';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.43, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 245, 200, 0.55)';
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.37, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Deep obsidian inner medallion disc with golden spade crest
  ctx.fillStyle = '#18130e';
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#efd079';
  ctx.font = 'bold 84px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('♠', cx, cy - 4);

  ctx.font = '700 16px "Space Grotesk", sans-serif';
  ctx.fillStyle = '#d7b25a';
  ctx.fillText('HIGH ROLLER', cx, cy + 52);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Paulson-style clay poker chip cylinder side wall with 6 crisp contrasting edge-spot stripes
 */
export function createChipSideTexture(): THREE.CanvasTexture {
  const w = 256;
  const h = 32;
  const [canvas, ctx] = makeCanvas(w, h);

  // Neutral white base so InstancedMesh setColorAt tints the clay body naturally
  ctx.fillStyle = '#dcdcdc';
  ctx.fillRect(0, 0, w, h);

  // 6 authentic vertical casino edge-spot stripes (bright ivory + subtle dark flank)
  const stripes = 6;
  for (let i = 0; i < stripes; i++) {
    const x = Math.round((i / stripes) * w);
    ctx.fillStyle = '#262626';
    ctx.fillRect(x, 0, 2, h);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 2, 0, 12, h);
    ctx.fillStyle = '#262626';
    ctx.fillRect(x + 14, 0, 2, h);
  }

  // Subtle horizontal clay mold groove along top/bottom rim
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(0, 0, w, 3);
  ctx.fillRect(0, h - 3, w, 3);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/**
 * High-contrast casino clay chip top face with 6 outer edge spots & brushed cream inlay
 */
export function createChipTopTexture(): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size, size);
  const cx = size / 2;
  const cy = size / 2;

  ctx.fillStyle = '#e6e6e6';
  ctx.fillRect(0, 0, size, size);

  // 6 bold outer edge spots matching side wall stripes
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.fillRect(-15, -cx, 30, 34);
    ctx.restore();
  }

  // Molded clay ring groove
  ctx.strokeStyle = 'rgba(15, 20, 28, 0.45)';
  ctx.lineWidth = 7;
  ctx.setLineDash([14, 10]);
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.37, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Warm cream casino center inlay
  ctx.fillStyle = '#f5efe1';
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.27, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#9e7c38';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Inner rosette dot
  ctx.strokeStyle = 'rgba(20, 24, 34, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.17, 0, Math.PI * 2);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createSeatPlaqueTexture(
  position: Position,
  label: string,
  stackBb: number,
  isHero: boolean,
  isActive: boolean,
  folded: boolean,
  styleTag?: string,
  actionText?: string,
  isWinner?: boolean,
  winnerLabel?: string,
  isAggressiveAction?: boolean,
  actionKind?: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all_in' | 'post_blind',
  isAllIn?: boolean,
  stackText?: string,
  revealedCards?: [Card, Card],
  fourColor = true
): THREE.CanvasTexture {
  const w = 512;
  const h = 220;
  const [canvas, ctx] = makeCanvas(w, h);

  // Luxury dark espresso-obsidian casino nameplate
  ctx.fillStyle = folded
    ? '#0a0c10'
    : isWinner
      ? '#241a09'
      : isHero
        ? '#0c211a'
        : '#101621';
  ctx.fillRect(0, 0, w, h);

  // Brushed brass/emerald border + fine inner pinstripe
  ctx.strokeStyle = isWinner
    ? '#f59e0b'
    : isActive
      ? '#34d399'
      : isHero
        ? '#d4aa4f'
        : '#5a4b32';
  ctx.lineWidth = isActive || isWinner ? 12 : 7;
  ctx.strokeRect(6, 6, w - 12, h - 12);

  ctx.strokeStyle = 'rgba(212, 175, 95, 0.28)';
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, w - 32, h - 32);

  // High-contrast position pill (top-left)
  const posPillBg = folded
    ? 'rgba(100, 116, 139, 0.16)'
    : isWinner
      ? 'rgba(251, 191, 36, 0.22)'
      : 'rgba(52, 211, 153, 0.2)';
  ctx.fillStyle = posPillBg;
  ctx.fillRect(26, 24, 128, 60);
  ctx.fillStyle = folded ? '#64748b' : isWinner ? '#fbbf24' : '#34d399';
  ctx.font = 'bold 46px "JetBrains Mono", monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(position, 90, 55);

  // Crisp mini-card badges in the open top-center slot when an opponent reveals their showdown hand
  if (!isHero && !folded && revealedCards) {
    revealedCards.forEach((rc, idx) => {
      const bx = 166 + idx * 68;
      const by = 22;
      const bw = 60;
      const bh = 78;
      ctx.save();
      ctx.fillStyle = '#f6f2e9';
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 8);
      ctx.fill();
      ctx.strokeStyle = isWinner ? '#f59e0b' : '#cbd5e1';
      ctx.lineWidth = isWinner ? 3.5 : 2;
      ctx.stroke();

      const cHex = suitHex(rc.suit, fourColor);
      const rTxt = rc.rank === 'T' ? '10' : rc.rank;
      ctx.fillStyle = cHex;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.save();
      ctx.translate(bx + bw / 2, by + 24);
      if (rc.rank === 'T') ctx.scale(0.72, 1);
      ctx.font = '800 32px "JetBrains Mono", monospace';
      ctx.fillText(rTxt, 0, 0);
      ctx.restore();

      drawVectorSuitPip(ctx, rc.suit, bx + bw / 2, by + 56, 13, cHex);
      ctx.restore();
    });
  }

  // Player label (top-right)
  ctx.fillStyle = folded ? '#64748b' : '#f8f5ee';
  ctx.font = '700 34px Inter, system-ui, sans-serif';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'right';
  ctx.fillText(label.slice(0, 12), w - 28, 26);

  // Middle style/HUD metadata (right-aligned under name)
  if (styleTag) {
    ctx.textAlign = 'right';
    ctx.fillStyle = folded ? '#475569' : '#d6c49e';
    ctx.font = '600 25px "JetBrains Mono", monospace';
    ctx.fillText(styleTag.slice(0, 16), w - 28, 72);
  }

  // Subtle horizontal divider separating identity from live stack/action
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(26, 118);
  ctx.lineTo(w - 26, 118);
  ctx.stroke();

  // Measure bottom-right live action tag or winner badge first so stack text never collides with it
  const badgeText = isWinner
    ? (winnerLabel ?? 'WINNER').slice(0, 20)
    : actionText
      ? actionText.slice(0, 20)
      : '';
  let badgeLayout: {
    pillX: number;
    pillY: number;
    pillW: number;
    pillH: number;
    padX: number;
    maxTextW: number;
    fontSize: number;
  } | null = null;
  if (badgeText) {
    const maxTextW = 224;
    let fontSize = badgeText.length > 12 ? 24 : 28;
    ctx.font = `bold ${fontSize}px "JetBrains Mono", Inter, system-ui, sans-serif`;
    while (fontSize > 20 && ctx.measureText(badgeText).width > maxTextW) {
      fontSize -= 2;
      ctx.font = `bold ${fontSize}px "JetBrains Mono", Inter, system-ui, sans-serif`;
    }
    const textW = Math.min(maxTextW, ctx.measureText(badgeText).width);
    const padX = 14;
    const pillW = textW + padX * 2;
    const pillH = 48;
    const pillX = w - 26 - pillW;
    const pillY = 140;
    badgeLayout = { pillX, pillY, pillW, pillH, padX, maxTextW, fontSize };
  }

  // Bottom-left stack display (dynamic font-size fit & width clamp so dollar amounts never hit action pill)
  const stackLabel = stackText ?? `${stackBb.toFixed(1)} bb`;
  const maxStackW = badgeLayout ? Math.max(180, badgeLayout.pillX - 28 - 14) : w - 56;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = folded ? '#64748b' : '#ffffff';
  let stackFontSize = 44;
  ctx.font = `bold ${stackFontSize}px "JetBrains Mono", monospace`;
  while (stackFontSize > 24 && ctx.measureText(stackLabel).width > maxStackW) {
    stackFontSize -= 2;
    ctx.font = `bold ${stackFontSize}px "JetBrains Mono", monospace`;
  }
  ctx.fillText(stackLabel, 28, 164, maxStackW);

  // Bottom-right live action tag or winner badge
  if (badgeText && badgeLayout) {
    const isCheck =
      actionKind === 'check' ||
      (!actionKind && (/check/i.test(badgeText) || badgeText.includes('过牌')));
    const isAllInBadge =
      Boolean(isAllIn) ||
      actionKind === 'all_in' ||
      (!actionKind && (/all-?in/i.test(badgeText) || badgeText.includes('全下')));
    const isAgg =
      actionKind === 'bet' ||
      actionKind === 'raise' ||
      (isAggressiveAction ??
        (badgeText.includes('Raise') ||
          badgeText.includes('Bet') ||
          badgeText.includes('加注') ||
          badgeText.includes('下注')));
    const { pillX, pillY, pillW, pillH, padX, maxTextW, fontSize } = badgeLayout;
    ctx.font = `bold ${fontSize}px "JetBrains Mono", Inter, system-ui, sans-serif`;

    ctx.fillStyle = isWinner
      ? 'rgba(245, 158, 11, 0.24)'
      : folded
        ? 'rgba(100, 116, 139, 0.16)'
        : isAllInBadge
          ? 'rgba(244, 63, 94, 0.24)'
          : isCheck
            ? 'rgba(245, 158, 11, 0.22)'
            : isAgg
              ? 'rgba(52, 211, 153, 0.2)'
              : 'rgba(56, 189, 248, 0.18)';
    ctx.fillRect(pillX, pillY, pillW, pillH);

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isWinner
      ? '#fbbf24'
      : folded
        ? '#94a3b8'
        : isAllInBadge
          ? '#fb7185'
          : isCheck
            ? '#f59e0b'
            : isAgg
              ? '#34d399'
              : '#38bdf8';
    ctx.fillText(badgeText, w - 26 - padX, 165, maxTextW);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

const MAX_FELT_BADGE_CACHE = 120;
const feltBadgeCache = new Map<string, THREE.CanvasTexture>();

/**
 * Crisp obsidian-emerald pill with brass/ivory numerals for on-felt pot & bet amounts.
 * Cached by `variant:text` with LRU eviction; cached textures are shared (flagged via userData.sharedFeltBadge) and must not be disposed per-mesh.
 */
export function createFeltBadgeTexture(text: string, variant: 'pot' | 'bet'): THREE.CanvasTexture {
  const key = `${variant}:${text}`;
  const cached = feltBadgeCache.get(key);
  if (cached) {
    feltBadgeCache.delete(key);
    feltBadgeCache.set(key, cached);
    return cached;
  }

  const w = 320;
  const h = 112;
  const [canvas, ctx] = makeCanvas(w, h);
  ctx.clearRect(0, 0, w, h);

  const r = h / 2 - 6;
  const x0 = 6;
  const y0 = 6;
  const pw = w - 12;
  const ph = h - 12;
  ctx.beginPath();
  ctx.moveTo(x0 + r, y0);
  ctx.lineTo(x0 + pw - r, y0);
  ctx.arc(x0 + pw - r, y0 + r, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x0 + r, y0 + ph);
  ctx.arc(x0 + r, y0 + r, r, Math.PI / 2, (Math.PI * 3) / 2);
  ctx.closePath();
  ctx.fillStyle = variant === 'pot' ? '#06140f' : '#0a1812';
  ctx.fill();
  ctx.lineWidth = variant === 'pot' ? 6 : 5;
  ctx.strokeStyle = variant === 'pot' ? '#d4aa4f' : '#2f9e78';
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = variant === 'pot' ? '#f6e3b0' : '#f8f5ee';
  let fontSize = variant === 'pot' ? 50 : 56;
  ctx.font = `bold ${fontSize}px "JetBrains Mono", monospace`;
  while (fontSize > 24 && ctx.measureText(text).width > w - 56) {
    fontSize -= 2;
    ctx.font = `bold ${fontSize}px "JetBrains Mono", monospace`;
  }
  ctx.fillText(text, w / 2, h / 2 + 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.userData.sharedFeltBadge = true;
  feltBadgeCache.set(key, tex);
  while (feltBadgeCache.size > MAX_FELT_BADGE_CACHE) {
    const oldestKey = feltBadgeCache.keys().next().value;
    if (oldestKey === undefined) break;
    feltBadgeCache.get(oldestKey)?.dispose();
    feltBadgeCache.delete(oldestKey);
  }
  return tex;
}

export function disposeFeltBadgeTextures() {
  for (const tex of feltBadgeCache.values()) tex.dispose();
  feltBadgeCache.clear();
}
