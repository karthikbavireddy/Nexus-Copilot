import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    proxy: {
      '/acp-api': {
        target: 'https://api.nexusai.dev',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/acp-api/, '')
      }
    }
  }
});
