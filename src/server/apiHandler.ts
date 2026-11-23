import 'dotenv/config';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createExpressApp } from './createApp.js';

let appPromise: ReturnType<typeof createExpressApp> | null = null;

async function getExpressApp() {
  if (!appPromise) {
    appPromise = createExpressApp({ includeStatic: false });
  }
  return appPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    // 1. Mark pre-parsed body so express.json() does not hang or fail on consumed streams
    if ((req as any).body && typeof (req as any).body === 'object' && !(req as any)._body) {
      (req as any)._body = true;
    }

    // 2. Normalize rewritten URLs from Vercel so Express routes match correctly
    const matchedPath = (req.headers['x-matched-path'] || req.headers['x-forwarded-uri'] || '') as string;
    if (matchedPath && matchedPath.startsWith('/api') && (req.url === '/api' || req.url === '/api/')) {
      req.url = matchedPath;
    } else if (req.url && !req.url.startsWith('/api')) {
      req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
    }

    const app = await getExpressApp();

    return await new Promise<void>((resolve, reject) => {
      res.on('finish', () => resolve());
      res.on('close', () => resolve());
      res.on('error', (err) => reject(err));

      app(req as any, res as any, (err: any) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  } catch (err: any) {
    console.error('[Vercel Serverless Invocation Error]:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err?.message || 'Internal server error' }));
    }
  }
}
