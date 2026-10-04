/// <reference lib="webworker" />
// Runs the subject-cutout AI off the main thread so the UI never freezes.
// Model: IS-Net (general objects: people, cars, products, animals).
import { pipeline, RawImage, env } from '@huggingface/transformers';

const MODEL_ID = 'onnx-community/ISNet-ONNX';

env.allowLocalModels = false;
env.useBrowserCache = true; // model downloads once, then loads from cache

export type Device = 'webgpu' | 'wasm';

let current: { device: Device; seg: Promise<any> } | null = null;

async function gpuInfo() {
  try {
    const gpu = (navigator as any).gpu;
    const adapter = gpu && (await gpu.requestAdapter());
    return adapter ? { ok: true, f16: adapter.features.has('shader-f16') } : { ok: false, f16: false };
  } catch {
    return { ok: false, f16: false };
  }
}

async function getSegmenter(want: Device | 'auto', onProgress: (p: any) => void) {
  let device: Device = want === 'auto' ? ((await gpuInfo()).ok ? 'webgpu' : 'wasm') : want;
  if (want === 'webgpu' && !(await gpuInfo()).ok) device = 'wasm';
  if (current?.device === device) return current;

  // GPU: half precision (88 MB) when supported, else full. CPU: 8-bit (44 MB), fastest on CPU.
  const dtype = device === 'webgpu' ? ((await gpuInfo()).f16 ? 'fp16' : 'fp32') : 'uint8';
  const seg = pipeline('background-removal', MODEL_ID, { device, dtype, progress_callback: onProgress } as any);
  current = { device, seg };
  seg.catch(() => { if (current?.seg === seg) current = null; });
  return current;
}

function alphaOf(img: any): { width: number; height: number; data: Uint8Array } {
  const { width, height, channels, data } = img;
  const out = new Uint8Array(width * height);
  if (channels === 1) out.set(data);
  else for (let i = 0; i < out.length; i++) out[i] = data[i * channels + channels - 1];
  return { width, height, data: out };
}

self.onmessage = async (e: MessageEvent<{ id: number; blob: Blob; device: Device | 'auto' }>) => {
  const { id, blob, device: want } = e.data;
  const post = (msg: any, transfer?: Transferable[]) =>
    (self as unknown as Worker).postMessage({ id, ...msg }, transfer ?? []);

  const run = async (w: Device | 'auto') => {
    const s = await getSegmenter(w, (p) => post({ type: 'progress', p }));
    const seg = await s.seg;
    post({ type: 'stage', stage: 'detect', device: s.device });
    const image = await RawImage.fromBlob(blob);
    const res = await seg(image);
    const out = Array.isArray(res) ? res[0] : res;
    const mask = alphaOf(out);
    // Sanity check: an all-empty or all-full mask usually means a broken GPU run
    let sum = 0;
    for (let i = 0; i < mask.data.length; i += 16) sum += mask.data[i];
    const mean = sum / Math.ceil(mask.data.length / 16);
    return { mask, device: s.device, mean };
  };

  try {
    let r;
    try {
      r = await run(want);
      if (r.device === 'webgpu' && (r.mean < 0.5 || Number.isNaN(r.mean))) throw new Error('Empty GPU result');
    } catch (err) {
      if (want === 'wasm') throw err;
      // GPU failed on this computer → fall back to CPU
      post({ type: 'fallback', reason: String((err as any)?.message ?? err) });
      current = null;
      r = await run('wasm');
    }
    post(
      { type: 'done', width: r.mask.width, height: r.mask.height, data: r.mask.data, device: r.device },
      [r.mask.data.buffer],
    );
  } catch (err: any) {
    post({ type: 'error', message: err?.message ?? String(err) });
  }
};
