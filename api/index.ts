import 'dotenv/config';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createExpressApp } from '../src/server/createApp.js';

let appPromise: ReturnType<typeof createExpressApp> | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!appPromise) {
    appPromise = createExpressApp({ includeStatic: false });
  }
  const app = await appPromise;
  return app(req, res);
}
