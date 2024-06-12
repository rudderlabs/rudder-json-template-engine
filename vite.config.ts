import { defineConfig } from 'vite';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'json-template',
    },
    outDir: 'build',
  },
  resolve: { alias: { src: resolve('src/') } },
});
