import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      usePolling: true,
      interval: 100
    },
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://backend:3000',
        changeOrigin: true
      }
    }
  }
});
