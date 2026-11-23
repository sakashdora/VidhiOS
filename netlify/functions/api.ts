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
    serverlessHandler = serverless(app);
  }

  return serverlessHandler(event, context);
};
