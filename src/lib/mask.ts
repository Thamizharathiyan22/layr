// Turns the AI's soft mask into a clean cutout, and applies the user's brush fixes.
//
//  AI mask (0–255 "how sure am I this is subject")
//     └─ solidity curve  → unsure pixels pushed to solid or clear
//         ├─ + restore strokes (brush)
//         └─ − erase strokes   (brush)
//              └─ × photo      → foreground layer drawn over the text
import type { Mask } from './segment';

function blank(W: number, H: number) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  return c;
}

/** AI mask scaled smoothly to the photo size, stored as grey levels (R = alpha). */
export function maskToCanvas(mask: Mask, W: number, H: number): HTMLCanvasElement {
  const small = blank(mask.width, mask.height);
  const sctx = small.getContext('2d')!;
  const d = sctx.createImageData(mask.width, mask.height);
  for (let i = 0; i < mask.data.length; i++) {
    const v = mask.data[i];
    d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = v;
    d.data[i * 4 + 3] = 255;
  }
  sctx.putImageData(d, 0, 0);
  const big = blank(W, H);
  const bctx = big.getContext('2d')!;
  bctx.imageSmoothingQuality = 'high';
  bctx.drawImage(small, 0, 0, W, H);
  return big;
}

/**
 * Solidity 0 = use the AI's raw confidence (soft, may look see-through).
 * Solidity 1 = anything the AI is even slightly sure about becomes fully solid.
 */
export function applySolidity(grey: HTMLCanvasElement, solidity: number, out?: HTMLCanvasElement): HTMLCanvasElement {
  const W = grey.width, H = grey.height;
  const src = grey.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, W, H).data;
  const c = out && out.width === W && out.height === H ? out : blank(W, H);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const lut = curve(solidity);
  for (let i = 0, n = W * H; i < n; i++) img.data[i * 4 + 3] = lut[src[i * 4]];
  ctx.putImageData(img, 0, 0);
  return c;
}

function curve(s: number) {
  const lut = new Uint8Array(256);
  const lo = 0.02 + 0.3 * s; // below → clear
  const hi = Math.max(lo + 0.04, 0.98 - 0.72 * s); // above → solid
  for (let i = 0; i < 256; i++) {
    const t = Math.min(1, Math.max(0, (i / 255 - lo) / (hi - lo)));
    lut[i] = Math.round(t * t * (3 - 2 * t) * 255); // smoothstep keeps edges soft, not jagged
  }
  return lut;
}

export class Cutout {
  readonly W: number;
  readonly H: number;
  readonly fg: HTMLCanvasElement; // final foreground, drawn over the text
  readonly restore: HTMLCanvasElement; // brush: force "subject"
  readonly erase: HTMLCanvasElement; // brush: force "background"
  private grey: HTMLCanvasElement | null;
  private solid: HTMLCanvasElement;
  private undoStack: [ImageBitmap, ImageBitmap][] = [];

  constructor(private img: HTMLCanvasElement, mask: Mask | null, solidity: number) {
    this.W = img.width;
    this.H = img.height;
    this.fg = blank(this.W, this.H);
    this.restore = blank(this.W, this.H);
    this.erase = blank(this.W, this.H);
    this.solid = blank(this.W, this.H);
    this.grey = mask ? maskToCanvas(mask, this.W, this.H) : null;
    this.setSolidity(solidity);
  }

  setSolidity(s: number) {
    if (this.grey) applySolidity(this.grey, s, this.solid);
    else this.solid.getContext('2d')!.clearRect(0, 0, this.W, this.H);
    this.compose();
  }

  /** fg = (solid mask + restore − erase) × photo */
  compose() {
    const ctx = this.fg.getContext('2d')!;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, this.W, this.H);
    ctx.drawImage(this.solid, 0, 0);
    ctx.drawImage(this.restore, 0, 0);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(this.erase, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.drawImage(this.img, 0, 0);
    ctx.restore();
  }

  hasSubject() {
    return !!this.grey || this.hasEdits;
  }
  hasEdits = false;

  /** Paint one brush segment in image pixels. */
  stroke(mode: 'restore' | 'erase', x0: number, y0: number, x1: number, y1: number, radius: number) {
    const [on, off] = mode === 'restore' ? [this.restore, this.erase] : [this.erase, this.restore];
    const draw = (c: HTMLCanvasElement, op: GlobalCompositeOperation) => {
      const ctx = c.getContext('2d')!;
      ctx.save();
      ctx.globalCompositeOperation = op;
      ctx.strokeStyle = '#fff';
      ctx.fillStyle = '#fff';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = radius * 2;
      ctx.filter = `blur(${Math.max(0.5, radius * 0.18)}px)`; // soft brush edge
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1 + 0.01, y1);
      ctx.stroke();
      ctx.restore();
    };
    draw(on, 'source-over');
    draw(off, 'destination-out'); // a new stroke overrides the opposite brush
    this.hasEdits = true;
  }

  /** Add (restore) or remove (erase) a whole object mask from tap-to-select. */
  applyMask(mode: 'restore' | 'erase', mask: Mask) {
    const [on, off] = mode === 'restore' ? [this.restore, this.erase] : [this.erase, this.restore];
    const m = blank(mask.width, mask.height);
    const mctx = m.getContext('2d')!;
    const d = mctx.createImageData(mask.width, mask.height);
    for (let i = 0; i < mask.data.length; i++) {
      d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = 255;
      d.data[i * 4 + 3] = mask.data[i];
    }
    mctx.putImageData(d, 0, 0);
    // Grow the object by a hair and soften it, so edges don't show a hard halo
    const grow = Math.max(1, Math.round(Math.max(this.W, this.H) / 900));
    for (const [c, op] of [[on, 'source-over'], [off, 'destination-out']] as const) {
      const ctx = c.getContext('2d')!;
      ctx.save();
      ctx.globalCompositeOperation = op;
      ctx.filter = `blur(${grow}px)`;
      ctx.drawImage(m, 0, 0, this.W, this.H);
      ctx.drawImage(m, 0, 0, this.W, this.H); // second pass keeps the centre fully solid after blur
      ctx.restore();
    }
    this.hasEdits = true;
    this.compose();
  }

  async pushUndo() {
    // Both snapshots are taken right now, before any new paint lands
    const snap = (await Promise.all([createImageBitmap(this.restore), createImageBitmap(this.erase)])) as [ImageBitmap, ImageBitmap];
    this.undoStack.push(snap);
    if (this.undoStack.length > 12) this.undoStack.shift()?.forEach((b) => b.close());
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  undo() {
    const snap = this.undoStack.pop();
    if (!snap) return;
    for (const [c, b] of [[this.restore, snap[0]], [this.erase, snap[1]]] as const) {
      const ctx = c.getContext('2d')!;
      ctx.clearRect(0, 0, this.W, this.H);
      ctx.drawImage(b, 0, 0);
      b.close();
    }
    this.compose();
  }

  resetEdits() {
    this.restore.getContext('2d')!.clearRect(0, 0, this.W, this.H);
    this.erase.getContext('2d')!.clearRect(0, 0, this.W, this.H);
    this.undoStack.forEach((s) => s.forEach((b) => b.close()));
    this.undoStack = [];
    this.hasEdits = false;
    this.compose();
  }
}
