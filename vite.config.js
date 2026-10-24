import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load VITE_* vars from .env files AND the shell environment
  const env = loadEnv(mode, process.cwd(), '');
  return {
    // Deploy under a subpath when VITE_BASE_PATH is set (e.g. /doc-library-pro-v1/)
    base: env.VITE_BASE_PATH || '/',
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
  };
});