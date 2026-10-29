// Start file. On cPanel, "Setup Node.js App" runs the built dist/app.cjs through Passenger. Locally: npm run dev.
import { createApp } from './server.ts';
import { db } from './db.ts';

const app = createApp();
db().then(() => {
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => console.log(`Attendance Desk on port ${port}`));
}).catch((e) => {
  console.error('Could not start:', e.message);
  process.exit(1);
});
