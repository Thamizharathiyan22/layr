// Main-thread wrapper around the AI worker: progress, GPU→CPU fallback, timeouts.
export type Mask = { width: number; height: number; data: Uint8Array };
export type SegmentProgress =
  | { stage: 'download'; percent: number; loadedMB: number; totalMB: number }
  | { stage: 'detect'; device: string }
  | { stage: 'fallback' };

type Device = 'webgpu' | 'wasm' | 'auto';
const PREF_KEY = 'layr.device';
const DETECT_TIMEOUT_MS = 90_000;

let worker: Worker | null = null;
let nextId = 1;
// Every in-flight request can be cancelled by resetAI()
const pending = new Set<(err: Error) => void>();
export const CANCELLED = 'cancelled';

function pref(): Device {
  try { return (localStorage.getItem(PREF_KEY) as Device) || 'auto'; } catch { return 'auto'; }
}
function setPref(d: Device) {
  try { localStorage.setItem(PREF_KEY, d); } catch { /* private mode */ }
}

function getWorker() {
  if (!worker) worker = new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' });
  return worker;
}
function killWorker() {
  worker?.terminate();
  worker = null;
}

function runOnce(blob: Blob, device: Device, onProgress: (p: SegmentProgress) => void): Promise<Mask & { device: string }> {
  const w = getWorker();
  const id = nextId++;
  const files = new Map<string, { loaded: number; total: number }>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  return new Promise((resolve, reject) => {
    const cancel = (err: Error) => { cleanup(); reject(err); };
    pending.add(cancel);
    const cleanup = () => {
      pending.delete(cancel);
      clearTimeout(timer);
      w.removeEventListener('message', onMsg);
      w.removeEventListener('error', onErr);
    };
    const onMsg = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.id !== id) return;
      if (msg.type === 'progress') {
        const p = msg.p;
        if (p.status === 'progress' && p.file && p.total) {
          files.set(p.file, { loaded: p.loaded, total: p.total });
          let loaded = 0, total = 0;
          files.forEach((f) => { loaded += f.loaded; total += f.total; });
          onProgress({ stage: 'download', percent: total ? (loaded / total) * 100 : 0, loadedMB: loaded / 1048576, totalMB: total / 1048576 });
        }
      } else if (msg.type === 'stage') {
        onProgress({ stage: 'detect', device: msg.device });
        clearTimeout(timer);
        timer = setTimeout(() => { cleanup(); reject(new Error('timeout')); }, DETECT_TIMEOUT_MS);
      } else if (msg.type === 'fallback') {
        setPref('wasm');
        onProgress({ stage: 'fallback' });
      } else if (msg.type === 'done') {
        cleanup();
        resolve({ width: msg.width, height: msg.height, data: msg.data, device: msg.device });
      } else if (msg.type === 'error') {
        cleanup();
        reject(new Error(msg.message));
      }
    };
    const onErr = (e: ErrorEvent) => { cleanup(); reject(new Error(e.message || 'AI worker crashed')); };
    w.addEventListener('message', onMsg);
    w.addEventListener('error', onErr);
    w.postMessage({ id, blob, device });
  });
}

export async function segment(blob: Blob, onProgress: (p: SegmentProgress) => void): Promise<Mask> {
  const device = pref();
  try {
    return await runOnce(blob, device, onProgress);
  } catch (err) {
    if ((err as Error).message === CANCELLED || device === 'wasm') throw err;
    // GPU hung or crashed: restart the worker on CPU and remember for next time
    killWorker();
    setPref('wasm');
    onProgress({ stage: 'fallback' });
    return await runOnce(blob, 'wasm', onProgress);
  }
}


/**
 * "Try again": stop whatever the AI is doing and start fresh.
 * useCpu = true when the GPU looked like the problem, so the next run (and later visits) use the CPU.
 */
export function resetAI(useCpu: boolean) {
  pending.forEach((cancel) => cancel(new Error(CANCELLED)));
  pending.clear();
  killWorker();
  if (useCpu) setPref('wasm');
}
