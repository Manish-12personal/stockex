import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 3000,
      proxy: {
        '/api': {
          // Use API base for HTTP proxy; do not use ws/wss URLs here (breaks /api calls)
          target: env.VITE_API_URL || 'http://localhost:5001',
          changeOrigin: true
        }
      }
    }
  }
})
