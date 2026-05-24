import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  Object.assign(process.env, env)
  return {
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/xlsx')) return 'vendor-xlsx';
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) return 'vendor-react';
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'logo.jpg', 'icons.svg'],
      manifest: {
        id: '/',
        name: 'TS Electronics - ระบบจัดการสต็อก',
        short_name: 'TS Stock',
        description: 'ระบบจัดการสต็อกสินค้า TS Electronics',
        theme_color: '#0071e3',
        background_color: '#f5f5f7',
        display: 'standalone',
        orientation: 'any',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        screenshots: [
          { src: 'icons/screenshot-desktop.png', sizes: '1280x720', type: 'image/png', form_factor: 'wide', label: 'TS Electronics Dashboard' },
          { src: 'icons/screenshot-mobile.png', sizes: '390x844', type: 'image/png', form_factor: 'narrow', label: 'TS Electronics Mobile' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,woff2}'],
      },
    }),
    {
      name: 'ai-chat-dev-proxy',
      configureServer(server) {
        server.middlewares.use('/api/ai-chat', async (req, res) => {
          if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
          if (req.method !== 'POST') { res.writeHead(405); res.end('Method not allowed'); return; }

          const apiKey = env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
          if (!apiKey) { res.writeHead(500); res.end(JSON.stringify({ error: 'Set ANTHROPIC_API_KEY in .env' })); return; }

          let body = '';
          req.on('data', c => body += c);
          req.on('end', async () => {
            try {
              const parsed = JSON.parse(body);
              const { default: handler } = await import('./api/ai-chat.js');

              const mockReq = { method: 'POST', body: parsed };
              const mockRes = {
                statusCode: 200,
                headers: {},
                body: null,
                setHeader(k, v) { this.headers[k] = v; },
                status(code) { this.statusCode = code; return this; },
                json(data) {
                  res.writeHead(this.statusCode, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify(data));
                },
                end() { res.writeHead(this.statusCode); res.end(); }
              };
              await handler(mockReq, mockRes);
            } catch (e) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: e.message }));
            }
          });
        });

        server.middlewares.use('/api/tts', async (req, res) => {
          if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
          if (req.method !== 'POST') { res.writeHead(405); res.end('Method not allowed'); return; }

          let body = '';
          req.on('data', c => body += c);
          req.on('end', async () => {
            try {
              const parsed = JSON.parse(body);
              const { default: handler } = await import('./api/tts.js');
              const mockReq = { method: 'POST', body: parsed };
              const mockRes = {
                statusCode: 200,
                headers: {},
                setHeader(k, v) { this.headers[k] = v; },
                status(code) { this.statusCode = code; return this; },
                json(data) {
                  res.writeHead(this.statusCode, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify(data));
                },
                end() { res.writeHead(this.statusCode); res.end(); }
              };
              await handler(mockReq, mockRes);
            } catch (e) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: e.message }));
            }
          });
        });
      }
    }
  ],
}})
