import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Pull configuration directly from the single backend/.env file
  envDir: path.resolve(__dirname, '../backend'),
  // Expose both KS_* and VITE_* prefixed variables to client code
  envPrefix: ['VITE_', 'KS_'],
  resolve: {
    alias: {
      'react-native': 'react-native-web'
    }
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/v1': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      }
    }
  }
})

