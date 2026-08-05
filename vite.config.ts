import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Доступ с телефона по IP в той же Wi‑Fi сети.
    // На телефоне: http://<IP-мака>:5173 — не localhost и не https.
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // Vite 6+ иногда режет запросы с телефона по Host — разрешаем LAN.
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
