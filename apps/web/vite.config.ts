import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig } from 'vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

export default defineConfig({
  server: { port: 3000 },
  resolve: { tsconfigPaths: true },
  plugins: [
    tailwindcss(),
    tanstackStart({ srcDirectory: 'src' }),
    nitro(),
    // React's vite plugin MUST come after Start's vite plugin
    viteReact(),
  ],
  optimizeDeps: {
    exclude: ['playwright-core', 'playwright'],
  },
  nitro: {
    rollupConfig: {
      external: ['playwright', 'playwright-core', 'playwright/index.mjs'],
      onwarn(warning, defaultHandler) {
        if (
          warning.code === 'MODULE_LEVEL_DIRECTIVE' &&
          warning.message.includes('"use client"')
        ) {
          return
        }
        defaultHandler(warning)
      },
    },
  },
})
