import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // pnpm workbench sets this when the gateway is not on its usual port.
        target: process.env['GATEWAY_URL'] ?? 'http://localhost:3456',
        changeOrigin: true,
      },
    },
  },
});
