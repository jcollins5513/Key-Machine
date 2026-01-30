import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  main: {
    entry: 'src/main/main.ts',
    build: {
      rollupOptions: {
        external: [
          'nfc-pcsc',
          'pcsclite',
          'bindings',
          'ref-napi',
          'ref-struct-di',
          'better-sqlite3',
        ],
      },
    },
  },
  preload: {
    entry: 'src/preload/preload.ts',
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
      },
    },
    plugins: [react()],
  },
});
