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

const SUIT_GLYPH: Record<Suit, string> = {
  s: '♠',
  h: '♥',
  d: '♦',
  c: '♣',
};

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
  return suit === 'h' || suit === 'd' ? '#a80f24' : '#0a0e16';
}

export function createCardFaceTexture(card: Card, fourColor: boolean): THREE.CanvasTexture {
  const w = 512;
  const h = 720;
  const [canvas, ctx] = makeCanvas(w, h);

  // Calibrated warm matte casino parchment cardstock (crisp readability without spotlight glare)
  const paperGrad = ctx.createRadialGradient(w * 0.45, h * 0.35, 30, w / 2, h / 2, w * 0.9);
  paperGrad.addColorStop(0, '#ece6d8');
  paperGrad.addColorStop(0.7, '#e4dccb');
  paperGrad.addColorStop(1, '#dcd3be');
  ctx.fillStyle = paperGrad;
  ctx.fillRect(0, 0, w, h);

  // Subtle embossed linen cardstock cross-hatch micro-texture
  ctx.fillStyle = 'rgba(130, 118, 96, 0.035)';
  for (let y = 0; y < h; y += 6) {
    ctx.fillRect(0, y, w, 1);
  }
  for (let x = 0; x < w; x += 6) {
    ctx.fillRect(x, 0, 1, h);
  }

  // Crisp rounded inner casino card border
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

  drawRoundedRect(18, 18, w - 36, h - 36, 28);
  ctx.strokeStyle = 'rgba(178, 165, 140, 0.72)';
  ctx.lineWidth = 4;
  ctx.stroke();

  const color = suitHex(card.suit, fourColor);
  const rankDisplay = card.rank === 'T' ? '10' : card.rank;
  const glyph = SUIT_GLYPH[card.suit];
  const isCourt = card.rank === 'J' || card.rank === 'Q' || card.rank === 'K';
  const isAce = card.rank === 'A';

  // Royal court portrait frame (J/Q/K) vs clean gilded Ace medallion
  if (isCourt) {
    const fx = 122;
    const fy = 104;
    const fw = w - fx * 2;
    const fh = h - fy * 2;

    // Rich royal parchment court card field so face cards read unmistakably from any 3D angle
    const courtGrad = ctx.createLinearGradient(fx, fy, fx + fw, fy + fh);
    courtGrad.addColorStop(0, '#eee4cc');
    courtGrad.addColorStop(0.5, '#e2d2b0');
    courtGrad.addColorStop(1, '#d6c39b');
    drawRoundedRect(fx, fy, fw, fh, 16);
    ctx.fillStyle = courtGrad;
    ctx.fill();

    // Clipped subtle royal sash & diamond lattice inside court frame
    ctx.save();
    drawRoundedRect(fx, fy, fw, fh, 16);
    ctx.clip();

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.13;
    ctx.beginPath();
    ctx.moveTo(fx - 20, fy + fh * 0.72);
    ctx.lineTo(fx + fw + 20, fy + fh * 0.14);
    ctx.lineTo(fx + fw + 20, fy + fh * 0.34);
    ctx.lineTo(fx - 20, fy + fh * 0.92);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#9c7426';
    ctx.globalAlpha = 0.14;
    ctx.lineWidth = 2;
    for (let y = fy + 24; y < fy + fh; y += 44) {
      for (let x = fx + 24; x < fx + fw; x += 44) {
        ctx.beginPath();
        ctx.moveTo(x, y - 10);
        ctx.lineTo(x + 10, y);
        ctx.lineTo(x, y + 10);
        ctx.lineTo(x - 10, y);
        ctx.closePath();
        ctx.stroke();
      }
    }
    ctx.restore();

    // Bold gilded outer court border + suit-tinted inner hairline
    drawRoundedRect(fx, fy, fw, fh, 16);
    ctx.strokeStyle = '#a87d28';
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.save();
    ctx.globalAlpha = 0.58;
    drawRoundedRect(fx + 10, fy + 10, fw - 20, fh - 20, 10);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }

  ctx.fillStyle = color;
  ctx.textBaseline = 'top';

  // Top-left ultra-crisp bold corner index
  ctx.font = '800 124px "JetBrains Mono", ui-monospace, sans-serif';
  ctx.fillText(rankDisplay, 34, 28);
  ctx.font = 'bold 100px Georgia, serif';
  ctx.fillText(glyph, 38, 152);

  // Helper to draw crisp vector royal emblems (King crown, Queen tiara, Jack heraldic shield)
  const drawRoyalCrest = (cx: number, cy: number, inverted: boolean) => {
    ctx.save();
    ctx.translate(cx, cy);
    if (inverted) ctx.rotate(Math.PI);

    if (card.rank === 'K') {
      // 5-point royal King crown
      ctx.beginPath();
      ctx.moveTo(-48, 22);
      ctx.lineTo(-54, -18);
      ctx.lineTo(-28, 2);
      ctx.lineTo(0, -28);
      ctx.lineTo(28, 2);
      ctx.lineTo(54, -18);
      ctx.lineTo(48, 22);
      ctx.closePath();
      ctx.fillStyle = '#d4a135';
      ctx.fill();
      ctx.strokeStyle = '#3b2809';
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // Crown base band + jewels
      ctx.fillStyle = '#b48220';
      ctx.fillRect(-48, 16, 96, 10);
      ctx.strokeRect(-48, 16, 96, 10);
      ctx.fillStyle = color;
      for (const jx of [-26, 0, 26]) {
        ctx.beginPath();
        ctx.arc(jx, 21, 4.2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (card.rank === 'Q') {
      // Regal 3-peak Queen tiara / diadem with pearl tips
      ctx.beginPath();
      ctx.moveTo(-44, 20);
      ctx.quadraticCurveTo(-40, -14, -22, 4);
      ctx.quadraticCurveTo(0, -34, 22, 4);
      ctx.quadraticCurveTo(40, -14, 44, 20);
      ctx.closePath();
      ctx.fillStyle = '#dbb04a';
      ctx.fill();
      ctx.strokeStyle = '#3b2809';
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // Pearl finials + central suit jewel
      ctx.fillStyle = '#faf3e0';
      for (const [px, py] of [[-40, -10], [0, -26], [40, -10]] as Array<[number, number]>) {
        ctx.beginPath();
        ctx.arc(px, py, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(7, 4);
      ctx.lineTo(0, 14);
      ctx.lineTo(-7, 4);
      ctx.closePath();
      ctx.fill();
    } else {
      // Jack heraldic knight's shield with gold trim & center chevron
      ctx.beginPath();
      ctx.moveTo(-34, -22);
      ctx.lineTo(34, -22);
      ctx.lineTo(34, 2);
      ctx.quadraticCurveTo(30, 22, 0, 32);
      ctx.quadraticCurveTo(-30, 22, -34, 2);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#d4a135';
      ctx.lineWidth = 5;
      ctx.stroke();

      // Gold heraldic chevron across shield
      ctx.beginPath();
      ctx.moveTo(-26, 2);
      ctx.lineTo(0, -14);
      ctx.lineTo(26, 2);
      ctx.strokeStyle = '#f4d98b';
      ctx.lineWidth = 6;
      ctx.stroke();
    }

    ctx.restore();
  };

  // Center emblem (ornate single pip for Ace ONLY, royal court medallion for J/Q/K, multi-pip grid for 2–10)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (isAce) {
    ctx.strokeStyle = 'rgba(182, 144, 66, 0.42)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2 + 8, 122, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = '265px Georgia, serif';
    ctx.fillText(glyph, w / 2, h / 2 + 16);
  } else if (isCourt) {
    // Double-headed royal crests (top upright, bottom inverted)
    drawRoyalCrest(w / 2, h / 2 - 154, false);
    drawRoyalCrest(w / 2, h / 2 + 154, true);

    // Opposite-corner court suit pips inside the royal frame (classic Kem/Bicycle layout)
    ctx.fillStyle = color;
    ctx.font = 'bold 74px Georgia, serif';
    ctx.fillText(glyph, w - 166, 166);
    ctx.save();
    ctx.translate(166, h - 166);
    ctx.rotate(Math.PI);
    ctx.fillText(glyph, 0, 0);
    ctx.restore();

    // Central royal court medallion with bold serif K / Q / J
    ctx.fillStyle = '#f5eedc';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 92, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b48426';
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.font = 'bold 148px Georgia, serif';
    ctx.fillText(card.rank, w / 2, h / 2 + 6);
  } else {
    // Authentic casino pip layouts for 2–10 so number cards never look like single-pip Aces
    const PIP_LAYOUTS: Record<string, Array<[number, number, boolean?]>> = {
      '2': [[0.5, 0.24], [0.5, 0.76, true]],
      '3': [[0.5, 0.22], [0.5, 0.5], [0.5, 0.78, true]],
      '4': [[0.34, 0.24], [0.66, 0.24], [0.34, 0.76, true], [0.66, 0.76, true]],
      '5': [[0.34, 0.24], [0.66, 0.24], [0.5, 0.5], [0.34, 0.76, true], [0.66, 0.76, true]],
      '6': [[0.34, 0.22], [0.66, 0.22], [0.34, 0.5], [0.66, 0.5], [0.34, 0.78, true], [0.66, 0.78, true]],
      '7': [[0.34, 0.22], [0.66, 0.22], [0.5, 0.36], [0.34, 0.5], [0.66, 0.5], [0.34, 0.78, true], [0.66, 0.78, true]],
      '8': [[0.34, 0.22], [0.66, 0.22], [0.5, 0.36], [0.34, 0.5], [0.66, 0.5], [0.5, 0.64, true], [0.34, 0.78, true], [0.66, 0.78, true]],
      '9': [[0.34, 0.2], [0.66, 0.2], [0.34, 0.4], [0.66, 0.4], [0.5, 0.5], [0.34, 0.6, true], [0.66, 0.6, true], [0.34, 0.8, true], [0.66, 0.8, true]],
      'T': [[0.34, 0.19], [0.66, 0.19], [0.5, 0.31], [0.34, 0.41], [0.66, 0.41], [0.34, 0.59, true], [0.66, 0.59, true], [0.5, 0.69, true], [0.34, 0.81, true], [0.66, 0.81, true]],
    };
    const pips = PIP_LAYOUTS[card.rank] ?? [[0.5, 0.5]];
    const pipFontSize = pips.length >= 9 ? 94 : pips.length >= 6 ? 104 : 118;
    ctx.font = `${pipFontSize}px Georgia, serif`;
    for (const [nx, ny, inverted] of pips) {
      const px = nx * w;
      const py = ny * h;
      if (inverted) {
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(Math.PI);
        ctx.fillText(glyph, 0, 0);
        ctx.restore();
      } else {
        ctx.fillText(glyph, px, py);
      }
    }
  }

  // Bottom-right inverted corner index
  ctx.save();
  ctx.translate(w, h);
  ctx.rotate(Math.PI);
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = '800 124px "JetBrains Mono", ui-monospace, sans-serif';
  ctx.fillText(rankDisplay, 34, 28);
  ctx.font = 'bold 100px Georgia, serif';
  ctx.fillText(glyph, 38, 152);
  ctx.restore();

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
  isAllIn?: boolean
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

  // Bottom-left stack bb (large, unmistakable tabular numerals)
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = folded ? '#64748b' : '#ffffff';
  ctx.font = 'bold 44px "JetBrains Mono", monospace';
  ctx.fillText(`${stackBb.toFixed(1)} bb`, 28, 164);

  // Bottom-right live action tag or winner badge
  const badgeText = isWinner
    ? (winnerLabel ?? 'WINNER').slice(0, 16)
    : actionText
      ? actionText.slice(0, 16)
      : '';
  if (badgeText) {
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
    const fontSize = badgeText.length > 12 ? 24 : 28;
    ctx.font = `bold ${fontSize}px "JetBrains Mono", Inter, system-ui, sans-serif`;
    const maxTextW = 228;
    const textW = Math.min(maxTextW, ctx.measureText(badgeText).width);
    const padX = 14;
    const pillW = textW + padX * 2;
    const pillH = 48;
    const pillX = w - 26 - pillW;
    const pillY = 140;

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

const feltBadgeCache = new Map<string, THREE.CanvasTexture>();

/**
 * Crisp obsidian-emerald pill with brass/ivory numerals for on-felt pot & bet amounts.
 * Cached by `variant:text`; cached textures are shared (flagged via userData.sharedFeltBadge) and must not be disposed per-mesh.
 */
export function createFeltBadgeTexture(text: string, variant: 'pot' | 'bet'): THREE.CanvasTexture {
  const key = `${variant}:${text}`;
  const cached = feltBadgeCache.get(key);
  if (cached) return cached;

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
  return tex;
}

export function disposeFeltBadgeTextures() {
  for (const tex of feltBadgeCache.values()) tex.dispose();
  feltBadgeCache.clear();
}
