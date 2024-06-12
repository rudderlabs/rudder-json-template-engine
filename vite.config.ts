import { defineConfig } from 'vite';
import { resolve } from 'path';
import { version } from './package.json';

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: () => `rudder-json-template-engine.${version}.js`,
    },
  },
  resolve: { alias: { src: resolve('src/') } },
});
