import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    // Gọi /api/... từ frontend sẽ được chuyển sang server Express (npm run server)
    proxy: { '/api': 'http://localhost:8787' },
  },
});
