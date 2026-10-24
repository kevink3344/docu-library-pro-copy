import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vite.dev/config/
export default defineConfig({
  // Deploy under a subpath when VITE_BASE_PATH is set (e.g. /oracle-data-v2/)
  base: process.env.VITE_BASE_PATH || '/',
  logLevel: 'error',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [
    react(),
  ],
  server: {
    proxy: {
      '/api-docs': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})