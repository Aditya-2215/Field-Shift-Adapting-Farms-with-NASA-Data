import 'dotenv/config';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/routes/api';

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT || 3000);
  const isProd = process.env.NODE_ENV === 'production';

  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      frameguard: false
    })
  );

  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || true,
      credentials: true
    })
  );

  app.use(cookieParser());
  app.use(express.json({ limit: '2mb' }));

  app.use('/api', apiRouter);

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  // Centralized error handler
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      const msg = err instanceof Error ? err.message : 'Internal server error';
      res.status(500).json({ success: false, error: msg });
    }
  );

  app.listen(port, '0.0.0.0', () => {
    console.log(`AgriShift AI server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup failure:', err);
  process.exit(1);
});
