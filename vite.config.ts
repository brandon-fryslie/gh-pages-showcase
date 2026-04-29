import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    dts({ rollupTypes: true, include: ['src'] }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      // Peer deps stay external — consumers bring their own copy.
      external: [
        'react',
        'react/jsx-runtime',
        'react-dom',
        'gsap',
        'gsap/ScrollTrigger',
        'lenis',
      ],
      output: {
        assetFileNames: (asset) => {
          if (asset.name === 'style.css') return 'showcase-kit.css';
          return asset.name ?? 'asset';
        },
      },
    },
    sourcemap: true,
  },
});
