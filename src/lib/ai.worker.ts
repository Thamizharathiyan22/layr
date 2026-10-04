/// <reference lib="webworker" />
// Runs the subject-cutout AI off the main thread so the UI never freezes.
// Model: IS-Net (general objects: people, cars, products, animals).
import { pipeline, RawImage, env } from '@huggingface/transformers';
import { goodGpu } from './device';

const MODEL_ID = 'onnx-community/ISNet-ONNX';

env.allowLocalModels = false;
env.useBrowserCache = true; // model downloads once, then loads from cache

export type Device = 'webgpu' | 'wasm';

let current: { device: Device; seg: Promise<any> } | null = null;

async function getSegmenter(want: Device | 'auto', onProgress: (p: any) => void, onDevice: (d: Device) => void) {
  // GPU only if it supports half precision (88 MB model). Otherwise the CPU model (44 MB) is
  // smaller and more reliable than the 176 MB full-precision GPU model, especially on phones.
  const device: Device = want === 'wasm' ? 'wasm' : (await goodGpu()) ? 'webgpu' : 'wasm';
  onDevice(device);
  if (current?.device === device) return current;

  const dtype = device === 'webgpu' ? 'fp16' : 'uint8';
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
    const s = await getSegmenter(w, (p) => post({ type: 'progress', p }), (d) => post({ type: 'device', device: d }));
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
