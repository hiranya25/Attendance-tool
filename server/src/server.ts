// The web app: the API under /api and the screens (built frontend) from ./public.
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { config } from './config.ts';
import { apiRouter } from './api/routes.ts';

export function createApp() {
  config();
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
  });
  app.use('/api', apiRouter());

  const publicDir = [path.resolve(process.cwd(), 'public'), path.resolve(process.cwd(), '../frontend/dist')].find((d) => fs.existsSync(path.join(d, 'index.html')));
  if (publicDir) {
    app.use(express.static(publicDir, { index: false, maxAge: '1h' }));
    app.get(/.*/, (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));
  } else {
    app.get('/', (_req, res) => res.type('text').send('Attendance Desk server is running, but the screens are not installed. Copy the built frontend into the "public" folder.'));
  }
  return app;
}

