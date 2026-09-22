/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  // Backend chỉ cho đúng 1 origin (CORS_ORIGIN trong backend/.env, mặc định cổng 5173).
  // Không có strictPort, Vite thấy 5173 bận sẽ lặng lẽ nhảy 5174 → app mở được nhưng mọi
  // request bị CORS chặn, FE chỉ hiện "Không kết nối được máy chủ". Thà không khởi động.
  server: { port: 5173, strictPort: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Node ≥ 25 bật sẵn localStorage toàn cục (hỏng khi thiếu --localstorage-file), che mất bản của jsdom.
    poolOptions: { forks: { execArgv: ['--no-experimental-webstorage'] } },
  },
});
