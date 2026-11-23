import 'dotenv/config';
import serverless from 'serverless-http';
import { createExpressApp } from '../../server';

let serverlessHandler: any = null;

export const handler = async (event: any, context: any) => {
  // Prevent Lambda from waiting for idle PostgreSQL connections in event loop
  if (context) {
    context.callbackWaitsForEmptyEventLoop = false;
  }

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

  return serverlessHandler(event, context);
};
