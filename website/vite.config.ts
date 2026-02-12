import { defineConfig } from 'vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { fileURLToPath, URL } from 'node:url'

// Serve game assets (pk3 files) from game-assets/ during dev.
// Production fetches these from R2 via VITE_ASSETS_URL.
function serveGameAssets() {
  const assetsDir = resolve(__dirname, 'game-assets')
  return {
    name: 'serve-game-assets',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.url?.endsWith('.pk3')) {
          const filePath = resolve(assetsDir, req.url.slice(1))
          if (existsSync(filePath)) {
            return res.end(readFileSync(filePath))
          }
        }
        next()
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    serveGameAssets(),
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    viteReact({
      babel: {
        plugins: ['babel-plugin-react-compiler'],
      },
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
