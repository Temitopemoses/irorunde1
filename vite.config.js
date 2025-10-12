import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Add any path aliases you need
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
    esbuildOptions: {
      // Add this
      target: 'es2020',
      supported: {
        'top-level-await': true
      }
    }
  },
  esbuild: {
    // Add this section
    target: 'es2020'
  },
  server: {
    port: 3000,
    open: true // Optional: opens browser automatically
  },
  build: {
    target: 'es2020'
  }
})