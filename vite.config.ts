import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// The default build is the ordinary multi-file `dist/`. `--mode standalone` builds
// a single self-contained `dist-standalone/index.html` instead: JS, CSS and every
// asset (portraits, map) inlined, no network, no sibling files — it plays by double
// -click on file:// and it also drops straight onto a static host such as itch.io.
export default defineConfig(({ mode }) => {
  const standalone = mode === 'standalone'
  return {
    base: process.env.VITE_BASE_PATH ?? './',
    plugins: [react(), ...(standalone ? [viteSingleFile()] : [])],
    build: standalone
      ? {
          outDir: 'dist-standalone',
          assetsInlineLimit: 100_000_000,
          chunkSizeWarningLimit: 100_000,
        }
      : {},
    test: {
      environment: 'node',
      include: ['tests/**/*.test.ts'],
    },
  }
})
