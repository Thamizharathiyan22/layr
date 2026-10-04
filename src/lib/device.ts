// Small helpers to tell phones/low-memory devices apart from laptops and tablets.

/** Phone-sized touch screen, or a device that reports 4 GB of memory or less. */
export function isLowMemoryDevice(): boolean {
  try {
    const touch = matchMedia('(pointer: coarse)').matches;
    const small = Math.min(screen.width, screen.height) < 700; // phones; iPads are 744+
    const mem = (navigator as any).deviceMemory as number | undefined;
    return (touch && small) || (mem !== undefined && mem <= 4);
  } catch {
    return false;
  }
}

/**
 * Is the graphics chip worth using for the AI?
 * Needs WebGPU *and* half-precision support (shader-f16). Without it the model is twice as big (176 MB)
 * and phone GPUs often hang, so the CPU version (44 MB) is the better choice.
 */
export async function goodGpu(): Promise<boolean> {
  try {
    const gpu = (navigator as any).gpu;
    const adapter = gpu && (await gpu.requestAdapter());
    return !!adapter && adapter.features.has('shader-f16');
  } catch {
    return false;
  }
}
