import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createDataApiMiddleware } from './server/dataApi';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      {
        name: 'dataviewer-data-api',
        configureServer(server) {
          server.middlewares.use('/api/langfuse', createDataApiMiddleware(env));
        },
      },
    ],
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: false,
    },
  };
});
