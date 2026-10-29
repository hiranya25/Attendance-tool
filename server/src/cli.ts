// Small admin commands for the server's terminal:
//   node dist/cli.cjs import <file.xls>         import a punch file
//   node dist/cli.cjs add-user <email> <name> <admin|viewer> <password>
//   node dist/cli.cjs run                       run the automatic jobs once
import fs from 'node:fs';
import path from 'node:path';
import { importPunchFile } from './import/importer.ts';
import { createUser } from './api/auth.ts';
import { runAll } from './jobs.ts';
import { closeDb } from './db.ts';

const [cmd, ...args] = process.argv.slice(2);

async function main() {
try {
  if (cmd === 'import' && args[0]) {
    const r = await importPunchFile(fs.readFileSync(args[0]), path.basename(args[0]), 'upload', 'Command line');
    console.log(`Imported ${r.months.join(', ')}: ${r.people} people, ${r.days} days.${r.newPeople.length ? ` New: ${r.newPeople.join(', ')}` : ''}`);
  } else if (cmd === 'add-user' && args.length >= 4) {
    await createUser(args[1], args[0], args[3], args[2]);
    console.log(`Added ${args[0]}.`);
  } else if (cmd === 'run') {
    for (const line of await runAll()) console.log(line);
  } else {
    console.log('Commands: import <file>, add-user <email> <name> <admin|viewer> <password>, run');
  }
} catch (e) {
  console.error((e as Error).message);
  process.exitCode = 1;
} finally {
  await closeDb();
}
}

void main();
