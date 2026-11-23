import 'dotenv/config';
import { createExpressApp } from './src/server/createApp.js';

const PORT = Number(process.env.PORT) || 3000;

createExpressApp({ includeStatic: true })
  .then((app) => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`VidhiOS server listening on http://0.0.0.0:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Fatal server startup error:', err);
    process.exit(1);
  });
