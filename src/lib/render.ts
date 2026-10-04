// The core effect: photo → text → cut-out subject, stacked on one canvas.
import type { Mask } from './segment';
import { isLowMemoryDevice } from './device';

export type Blend = 'source-over' | 'overlay' | 'soft-light' | 'screen' | 'multiply' | 'difference' | 'color-dodge';
export type Align = 'left' | 'center' | 'right';

export type TextLayer = {
  id: string;
  text: string;
  // typography
  font: string;
  weight: number;
  italic: boolean;
  uppercase: boolean;
  align: Align;
  size: number; // font size as a fraction of image width
  letterSpacing: number; // em
  lineHeight: number; // multiple of font size
  // fill
  fillOn: boolean; // false = outline only
  color: string;
  gradient: boolean;
  color2: string;
  gradAngle: number; // degrees, 90 = top→bottom
  opacity: number; // 0–1
  blend: Blend;
  // effects
  strokeWidth: number; // fraction of font size
  strokeColor: string;
  shadow: number; // 0–1 soft drop shadow
  shadowColor: string;
  glow: number; // 0–1
  glowColor: string;
  extrude: number; // 0–1 → 3D depth / long shadow
  extrudeColor: string;
  extrudeAngle: number; // degrees, 45 = down-right
  box: number; // 0–1 opacity of a label box behind the text
  boxColor: string;
  skew: number; // degrees, lean like italics
  // transform
  rotation: number; // degrees
  x: number; // centre, 0–1 of image width
  y: number; // centre, 0–1 of image height
  behind: boolean; // true = subject covers the text
};

export type StyleFields = Omit<TextLayer, 'id' | 'text' | 'x' | 'y' | 'size' | 'rotation' | 'behind'>;

/** Neutral look. Presets start from this so switching presets never leaves old effects behind. */
export const BASE_STYLE: StyleFields = {
  font: 'Anton',
  weight: 400,
  italic: false,
  uppercase: true,
  align: 'center',
  letterSpacing: 0.02,
  lineHeight: 1,
  fillOn: true,
  color: '#ffffff',
  gradient: false,
  color2: '#f472b6',
  gradAngle: 90,
  opacity: 1,
  blend: 'source-over',
  strokeWidth: 0,
  strokeColor: '#000000',
  shadow: 0.25,
  shadowColor: '#000000',
  glow: 0,
  glowColor: '#ec4899',
  extrude: 0,
  extrudeColor: '#1e1b4b',
  extrudeAngle: 45,
  box: 0,
  boxColor: '#facc15',
  skew: 0,
};

// Working photo size: phones have tight canvas memory limits, so they get a smaller copy.
export const MAX_SIDE = isLowMemoryDevice() ? 1600 : 2560;

let seq = 0;
export function newLayer(partial: Partial<TextLayer> = {}): TextLayer {
  return {
    ...BASE_STYLE,
    id: `t${Date.now().toString(36)}${seq++}`,
    text: 'BRAND',
    size: 0.28,
    rotation: 0,
    x: 0.5,
    y: 0.38,
    behind: true,
    ...partial,
  };
}

/** Load a file, downscale if huge, return a canvas we own. */
export async function loadImage(file: Blob): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c;
}

export function canvasToBlob(c: HTMLCanvasElement, type = 'image/png', q?: number): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Export failed'))), type, q));
}

/** Photo pixels kept only where the AI mask says "subject". */
export function makeForeground(img: HTMLCanvasElement, mask: Mask): HTMLCanvasElement {
  // Scale the mask to the photo with smooth filtering (soft, clean edges)
  const mc = document.createElement('canvas');
  mc.width = mask.width;
  mc.height = mask.height;
  const md = mc.getContext('2d')!.createImageData(mask.width, mask.height);
  for (let i = 0; i < mask.data.length; i++) {
    md.data[i * 4 + 3] = mask.data[i];
  }
  mc.getContext('2d')!.putImageData(md, 0, 0);

  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(mc, 0, 0, c.width, c.height);
  ctx.globalCompositeOperation = 'source-in';
  ctx.drawImage(img, 0, 0);
  return c;
}

export function fontString(l: Pick<TextLayer, 'italic' | 'weight' | 'font'>, px: number) {
  return `${l.italic ? 'italic ' : ''}${l.weight} ${px}px "${l.font}", sans-serif`;
}

function lines(l: TextLayer) {
  return (l.uppercase ? l.text.toUpperCase() : l.text).split('\n');
}

/** Width/height of a layer's text block in image pixels (unrotated). */
export function measureLayer(ctx: CanvasRenderingContext2D, l: TextLayer, W: number) {
  const px = l.size * W;
  ctx.save();
  ctx.font = fontString(l, px);
  (ctx as any).letterSpacing = `${l.letterSpacing * px}px`;
  const ls = lines(l);
  const widths = ls.map((t) => ctx.measureText(t).width);
  ctx.restore();
  const w = Math.max(1, ...widths);
  return { w, h: ls.length * px * l.lineHeight, px, lines: ls, widths };
}

export type Bounds = { left: number; right: number; top: number; bottom: number };

/**
 * Tight box around the visible letters (ink), relative to the layer centre, before rotation.
 * The em box used for layout is taller than the letters (room for accents and descenders),
 * so the selection frame uses this instead to hug the text exactly.
 */
export function inkBounds(ctx: CanvasRenderingContext2D, l: TextLayer, W: number): Bounds {
  const { w, h, px, lines: ls } = measureLayer(ctx, l, W);
  ctx.save();
  ctx.font = fontString(l, px);
  (ctx as any).letterSpacing = `${l.letterSpacing * px}px`;
  ctx.textAlign = l.align;
  ctx.textBaseline = 'middle';
  const ax = l.align === 'left' ? -w / 2 : l.align === 'right' ? w / 2 : 0;
  const lh = px * l.lineHeight;
  let b: Bounds | null = null;
  ls.forEach((t, i) => {
    if (!t.trim()) return;
    const m = ctx.measureText(t);
    const y = -h / 2 + lh * (i + 0.5);
    const r = {
      left: ax - m.actualBoundingBoxLeft,
      right: ax + m.actualBoundingBoxRight,
      top: y - m.actualBoundingBoxAscent,
      bottom: y + m.actualBoundingBoxDescent,
    };
    b = b ? { left: Math.min(b.left, r.left), right: Math.max(b.right, r.right), top: Math.min(b.top, r.top), bottom: Math.max(b.bottom, r.bottom) } : r;
  });
  ctx.restore();
  const out: Bounds = b ?? { left: -w / 2, right: w / 2, top: -h / 2, bottom: h / 2 };
  // Outline sticks out past the letters; skew leans the top and bottom sideways
  const grow = l.strokeWidth > 0 ? (l.strokeWidth * px) / 2 : 0;
  const lean = Math.abs(Math.tan((l.skew * Math.PI) / 180)) * Math.max(Math.abs(out.top), Math.abs(out.bottom));
  return { left: out.left - grow - lean, right: out.right + grow + lean, top: out.top - grow, bottom: out.bottom + grow };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if ((ctx as any).roundRect) (ctx as any).roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

/** Draw one text layer centred at (l.x, l.y). Exported for style thumbnails. */
export function drawLayer(ctx: CanvasRenderingContext2D, l: TextLayer, W: number, H: number) {
  const { w, h, px, lines: ls } = measureLayer(ctx, l, W);
  ctx.save();
  ctx.translate(l.x * W, l.y * H);
  ctx.rotate((l.rotation * Math.PI) / 180);
  if (l.skew) ctx.transform(1, 0, -Math.tan((l.skew * Math.PI) / 180), 1, 0, 0);
  ctx.globalAlpha = l.opacity;
  ctx.globalCompositeOperation = l.blend;
  ctx.font = fontString(l, px);
  (ctx as any).letterSpacing = `${l.letterSpacing * px}px`;
  ctx.textAlign = l.align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  const ax = l.align === 'left' ? -w / 2 : l.align === 'right' ? w / 2 : 0;
  const lh = px * l.lineHeight;
  const rows = ls.map((t, i) => ({ t, y: -h / 2 + lh * (i + 0.5) }));
  const eachRow = (fn: (t: string, y: number) => void) => rows.forEach((r) => fn(r.t, r.y));
  const noShadow = () => { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; };

  // 1. Label box
  if (l.box > 0) {
    const padX = px * 0.35, padY = px * 0.18;
    ctx.save();
    ctx.globalAlpha = l.opacity * l.box;
    ctx.fillStyle = l.boxColor;
    roundRect(ctx, -w / 2 - padX, -h / 2 - padY, w + padX * 2, h + padY * 2, px * 0.18);
    ctx.fill();
    ctx.restore();
  }

  // 2. 3D extrude / long shadow: stack copies from far to near
  if (l.extrude > 0) {
    const depth = l.extrude * px * 0.22;
    const steps = Math.max(2, Math.min(80, Math.round(depth)));
    const a = (l.extrudeAngle * Math.PI) / 180;
    ctx.fillStyle = l.extrudeColor;
    for (let s = steps; s >= 1; s--) {
      const d = (depth * s) / steps;
      eachRow((t, y) => ctx.fillText(t, ax + Math.cos(a) * d, y + Math.sin(a) * d));
    }
  }

  // Fill style (solid or angled gradient)
  let fill: string | CanvasGradient = l.color;
  if (l.gradient) {
    const a = (l.gradAngle * Math.PI) / 180;
    const rx = (Math.cos(a) * w) / 2, ry = (Math.sin(a) * h) / 2;
    const g = ctx.createLinearGradient(-rx, -ry, rx, ry);
    g.addColorStop(0, l.color);
    g.addColorStop(1, l.color2);
    fill = g;
  }
  const paint = l.fillOn ? fill : 'rgba(0,0,0,0)';

  // 3. Glow: coloured blur, layered for intensity
  if (l.glow > 0) {
    ctx.save();
    ctx.shadowColor = l.glowColor;
    ctx.fillStyle = l.fillOn ? l.glowColor : 'rgba(0,0,0,0)';
    if (!l.fillOn) { ctx.strokeStyle = l.glowColor; ctx.lineWidth = Math.max(1, l.strokeWidth * px); }
    const passes = l.glow > 0.6 ? 3 : 2;
    for (let p = 0; p < passes; p++) {
      ctx.shadowBlur = px * (0.12 + 0.35 * l.glow) * (p + 1) / passes;
      eachRow((t, y) => (l.fillOn ? ctx.fillText(t, ax, y) : ctx.strokeText(t, ax, y)));
    }
    ctx.restore();
  }

  // 4. Soft drop shadow (drawn with the fill)
  const setShadow = () => {
    if (l.shadow > 0) {
      ctx.shadowColor = hexA(l.shadowColor, 0.35 + l.shadow * 0.45);
      ctx.shadowBlur = px * 0.25 * l.shadow;
      ctx.shadowOffsetY = px * 0.06 * l.shadow;
    }
  };

  // 5. Outline, then fill on top
  if (l.strokeWidth > 0) {
    setShadow();
    ctx.lineWidth = l.strokeWidth * px * (l.fillOn ? 2 : 1); // outer half hidden under fill
    ctx.strokeStyle = l.strokeColor;
    eachRow((t, y) => ctx.strokeText(t, ax, y));
    noShadow();
  }
  if (l.fillOn) {
    if (l.strokeWidth <= 0) setShadow();
    ctx.fillStyle = paint;
    eachRow((t, y) => ctx.fillText(t, ax, y));
    noShadow();
  }
  ctx.restore();
  return { w, h };
}

function hexA(hex: string, a: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

export type RenderOpts = {
  img: HTMLCanvasElement;
  fg: HTMLCanvasElement | null;
  layers: TextLayer[];
  peek?: boolean; // show subject semi-transparent to find hidden text
};

/** Draw the full composition. Layer order: photo → behind-text → subject → front-text. */
export function render(ctx: CanvasRenderingContext2D, o: RenderOpts) {
  const { img, fg, layers } = o;
  const W = img.width, H = img.height;
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(img, 0, 0);

  const behind = layers.filter((l) => l.behind && fg);
  const front = layers.filter((l) => !(l.behind && fg));

  behind.forEach((l) => drawLayer(ctx, l, W, H));
  if (fg && behind.length) {
    ctx.globalAlpha = o.peek ? 0.4 : 1;
    ctx.drawImage(fg, 0, 0);
    ctx.globalAlpha = 1;
  }
  front.forEach((l) => drawLayer(ctx, l, W, H));
  ctx.restore();
}

/** Padding around a layer's selection box, in image px. */
export function selectionPad(l: TextLayer, W: number) {
  return l.size * W * 0.04;
}

/** Which layer (topmost first) is under an image-space point? */
export function hitTest(ctx: CanvasRenderingContext2D, layers: TextLayer[], W: number, H: number, px: number, py: number) {
  for (let i = layers.length - 1; i >= 0; i--) {
    const l = layers[i];
    const b = inkBounds(ctx, l, W);
    const pad = selectionPad(l, W);
    const a = (-l.rotation * Math.PI) / 180;
    const dx = px - l.x * W, dy = py - l.y * H;
    const lx = dx * Math.cos(a) - dy * Math.sin(a);
    const ly = dx * Math.sin(a) + dy * Math.cos(a);
    if (lx >= b.left - pad && lx <= b.right + pad && ly >= b.top - pad && ly <= b.bottom + pad) return l;
  }
  return null;
}

/** Font size that makes the text block fill `target` of the image width. */
export function fitSize(ctx: CanvasRenderingContext2D, l: TextLayer, W: number, target = 0.86) {
  const { w } = measureLayer(ctx, l, W);
  return Math.max(0.02, Math.min(0.6, (l.size * target * W) / w));
}

/** Wait for a Google Font to be ready so canvas draws it (not a fallback). */
export async function ensureFont(l: Pick<TextLayer, 'italic' | 'weight' | 'font'>, sample = 'A') {
  try {
    await document.fonts.load(fontString(l, 64), sample);
  } catch {
    /* fallback font is fine */
  }
}
