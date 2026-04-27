import { defineConfig } from 'vite'
import { fileRouteVite } from 'next-file-route/plugin'

export default defineConfig({
  plugins: [fileRouteVite({ root: import.meta.dirname })],
  build: {
    // We're not building a real React app here — just exercising the
    // codegen + alias resolution end-to-end. Library mode keeps the
    // output minimal.
    lib: {
      entry: 'src/main.ts',
      formats: ['es'],
      fileName: 'main',
    },
    rollupOptions: {
      external: ['zod'],
    },
  },
})
