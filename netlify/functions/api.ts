import 'dotenv/config';
import serverless from 'serverless-http';
import { createExpressApp } from '../../src/server/createApp.js';

let serverlessHandler: any = null;

export const handler = async (event: any, context: any) => {
  if (context) {
    context.callbackWaitsForEmptyEventLoop = false;
  }

  try {
    if (!serverlessHandler) {
      const app = await createExpressApp({ includeStatic: false });
      serverlessHandler = serverless(app, {
        request(req: any) {
          if (req.url && req.url.startsWith('/.netlify/functions/api')) {
            req.url = req.url.replace('/.netlify/functions/api', '/api');
          }
        },
      });
    }

    return await serverlessHandler(event, context);
  } catch (err: any) {
    console.error('[Netlify Function Error]:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: err?.message || 'Internal serverless execution error',
      }),
    };
  }
};
