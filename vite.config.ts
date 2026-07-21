import fs from 'fs';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      preview: {
        host: '0.0.0.0',
        allowedHosts: true,
      },
      plugins: [
        react(),
        {
          name: 'log-writer',
          configureServer(server) {
            server.middlewares.use((req, res, next) => {
              if (req.url === '/api/log' && req.method === 'POST') {
                let body = '';
                req.on('data', chunk => {
                  body += chunk.toString();
                });
                req.on('end', () => {
                  try {
                    const data = JSON.parse(body);
                    const logDir = path.resolve(__dirname, 'logs');
                    if (!fs.existsSync(logDir)) {
                      fs.mkdirSync(logDir);
                    }
                    
                    const sessionId = data.sessionId || 'default_session';
                    const logPath = path.join(logDir, `${sessionId}.txt`);
                    
                    const logEntry = `[${data.timestamp || new Date().toLocaleTimeString()}] [${(data.type || 'INFO').toUpperCase()}] ${data.message}\n` +
                      (data.details ? `  -> Detalles: ${JSON.stringify(data.details, null, 2)}\n` : '');
                      
                    fs.appendFileSync(logPath, logEntry, 'utf8');
                    
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ status: 'ok' }));
                  } catch (error) {
                    res.statusCode = 500;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: 'Failed to write log' }));
                  }
                });
              } else {
                next();
              }
            });
          }
        }
      ],
      define: {
        'import.meta.env.VITE_PRIVATE_KEY': JSON.stringify(process.env.PRIVATE_KEY || process.env.VITE_PRIVATE_KEY || env.PRIVATE_KEY || env.VITE_PRIVATE_KEY || ''),
        'import.meta.env.VITE_RPC_URL': JSON.stringify(process.env.RPC_URL || process.env.VITE_RPC_URL || env.RPC_URL || env.VITE_RPC_URL || ''),
        'import.meta.env.VITE_ARBITRUM_RPC_URL': JSON.stringify(process.env.ARBITRUM_RPC_URL || process.env.VITE_ARBITRUM_RPC_URL || env.ARBITRUM_RPC_URL || env.VITE_ARBITRUM_RPC_URL || ''),
        'process.env': {},
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || '')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
