import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // transformers.js ships its own WASM loader; let Vite leave it alone.
  optimizeDeps: { exclude: ['@huggingface/transformers'] },
  worker: { format: 'es' },
  server: { port: 5173, open: true },
});
