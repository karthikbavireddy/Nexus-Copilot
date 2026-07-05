import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/acp-api': {
        target: 'https://api.nexusai.dev',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/acp-api/, '')
      }
    }
  }
});
