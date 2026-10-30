// Start file. On cPanel, "Setup Node.js App" runs the built dist/app.cjs through Passenger. Locally: npm run dev.
import { createApp } from './server.ts';
import { db } from './db.ts';
import { logError } from './log.ts';

const app = createApp();
db().then(() => {
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => console.log(`Attendance Desk on port ${port}`));
}).catch((e) => {
  logError('start', e);
  process.exit(1);
});
