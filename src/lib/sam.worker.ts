/// <reference lib="webworker" />
// "Tap to select": SlimSAM (Segment Anything, Apache-2.0) cuts out exactly the object the user taps.
// Step 1 (slow, once per photo): read the whole photo → "image embeddings".
// Step 2 (fast, per tap):       embeddings + tap point → mask of that object.
import { AutoProcessor, RawImage, SamModel, Tensor, env } from '@huggingface/transformers';

const MODEL_ID = 'Xenova/slimsam-77-uniform';
env.allowLocalModels = false;
env.useBrowserCache = true;

type Device = 'webgpu' | 'wasm';
let loaded: { device: Device; model: any; processor: any } | null = null;
let current: { key: number; inputs: any; embeddings: any; W: number; H: number } | null = null;

async function hasGpu() {
  try {
    const gpu = (navigator as any).gpu;
    return !!gpu && !!(await gpu.requestAdapter());
  } catch {
    return false;
  }
}

async function load(want: Device | 'auto', onProgress: (p: any) => void) {
  const device: Device = want === 'wasm' ? 'wasm' : (await hasGpu()) ? 'webgpu' : 'wasm';
  if (loaded?.device === device) return loaded;
  const dtype = device === 'webgpu' ? 'fp32' : 'q8';
  const [model, processor] = await Promise.all([
    SamModel.from_pretrained(MODEL_ID, { device, dtype, progress_callback: onProgress } as any),
    AutoProcessor.from_pretrained(MODEL_ID, {}),
  ]);
  loaded = { device, model, processor };
  return loaded;
}

async function embed(key: number, blob: Blob, want: Device | 'auto', onProgress: (p: any) => void) {
  if (current?.key === key) return;
  const run = async (w: Device | 'auto') => {
    const { model, processor } = await load(w, onProgress);
    const image = await RawImage.fromBlob(blob);
    const inputs = await processor(image);
    const embeddings = await model.get_image_embeddings(inputs);
    current = { key, inputs, embeddings, W: image.width, H: image.height };
  };
  try {
    await run(want);
  } catch (err) {
    if (loaded?.device !== 'webgpu') throw err;
    loaded = null; // GPU trouble → retry on CPU
    await run('wasm');
  }
}

/** Tap at (x, y) in 0–1 coords → the whole object under the tap. */
async function select(x: number, y: number) {
  if (!current || !loaded) throw new Error('Photo not prepared');
  const { model, processor } = loaded;
  const { inputs, embeddings, W, H } = current;
  const [rh, rw] = inputs.reshaped_input_sizes[0];
  const input_points = new Tensor('float32', [x * rw, y * rh], [1, 1, 1, 2]);
  const input_labels = new Tensor('int64', [1n], [1, 1, 1]);
  const out = await model({ ...embeddings, input_points, input_labels });
  const masks = await processor.post_process_masks(out.pred_masks, inputs.original_sizes, inputs.reshaped_input_sizes);
  const data = masks[0].data as Uint8Array | boolean[]; // [1, 3, H, W]: 3 guesses, small → whole
  const scores = Array.from(out.iou_scores.data as Float32Array);
  const HW = W * H;

  // Among the confident guesses, take the biggest: that is the whole object, not just a piece of it
  const best = Math.max(...scores);
  let pick = scores.indexOf(best), pickArea = -1;
  for (let k = 0; k < scores.length; k++) {
    if (scores[k] < best - 0.15) continue;
    let area = 0;
    for (let i = k * HW, e = i + HW; i < e; i++) if (data[i]) area++;
    if (area > pickArea) { pick = k; pickArea = area; }
  }
  const mask = new Uint8Array(HW);
  for (let i = 0, o = pick * HW; i < HW; i++) mask[i] = data[o + i] ? 255 : 0;
  return { width: W, height: H, data: mask };
}

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data;
  const post = (m: any, t?: Transferable[]) => (self as unknown as Worker).postMessage({ id: msg.id, ...m }, t ?? []);
  try {
    if (msg.type === 'embed') {
      await embed(msg.key, msg.blob, msg.device, (p) => post({ type: 'progress', p }));
      post({ type: 'ready', device: loaded?.device });
    } else if (msg.type === 'select') {
      const m = await select(msg.x, msg.y);
      post({ type: 'mask', width: m.width, height: m.height, data: m.data }, [m.data.buffer]);
    }
  } catch (err: any) {
    post({ type: 'error', message: err?.message ?? String(err) });
  }
};
