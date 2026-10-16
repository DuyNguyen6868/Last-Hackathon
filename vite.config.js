import { defineConfig } from 'vite';

export default defineConfig({
  // Đường dẫn tương đối để chạy được ở thư mục con (GitHub Pages: /Last-Hackathon/)
  base: './',
  server: {
    port: 5173,
    // Gọi /api/... từ frontend sẽ được chuyển sang server Express (npm run server)
    proxy: { '/api': 'http://localhost:8787' },
  },
});
