// Main-thread side of "tap to select".
import type { Mask } from './segment';

let worker: Worker | null = null;
let nextId = 1;
let preparedKey = -1;
let preparing: Promise<void> | null = null;

function getWorker() {
  if (!worker) worker = new Worker(new URL('./sam.worker.ts', import.meta.url), { type: 'module' });
  return worker;
}

function devicePref() {
  try { return localStorage.getItem('layr.device') || 'auto'; } catch { return 'auto'; }
}

function call<T>(msg: any, onProgress?: (p: any) => void): Promise<T> {
  const w = getWorker();
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const onMsg = (e: MessageEvent) => {
      const m = e.data;
      if (m.id !== id) return;
      if (m.type === 'progress') return onProgress?.(m.p);
      w.removeEventListener('message', onMsg);
      if (m.type === 'error') reject(new Error(m.message));
      else resolve(m as T);
    };
    w.addEventListener('message', onMsg);
    w.postMessage({ id, ...msg });
  });
}

/** Read the photo once (≈1–3 s on GPU). `key` identifies the photo. */
export function prepare(key: number, blob: Blob, onPercent?: (pct: number) => void): Promise<void> {
  if (preparedKey === key) return Promise.resolve();
  if (preparing) return preparing;
  const files = new Map<string, { loaded: number; total: number }>();
  preparing = call<void>({ type: 'embed', key, blob, device: devicePref() }, (p) => {
    if (p.status !== 'progress' || !p.total) return;
    files.set(p.file, { loaded: p.loaded, total: p.total });
    let l = 0, t = 0;
    files.forEach((f) => { l += f.loaded; t += f.total; });
    onPercent?.(t ? (l / t) * 100 : 0);
  })
    .then(() => { preparedKey = key; })
    .finally(() => { preparing = null; });
  return preparing;
}

/** Tap point in 0–1 photo coordinates → mask of the object there. */
export async function selectAt(x: number, y: number): Promise<Mask> {
  const m = await call<{ width: number; height: number; data: Uint8Array }>({ type: 'select', x, y });
  return { width: m.width, height: m.height, data: m.data };
}
