import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Как 432 на 8000 (--host 0.0.0.0): доступ с телефона по IP в той же Wi‑Fi сети.
    // На телефоне открывай http://<IP-мака>:5173 — не localhost (это сам телефон).
    host: true,
    port: 5173,
    strictPort: true,
  },
})
