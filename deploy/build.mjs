// Builds the upload package for cPanel: deploy/out/attendance-desk.zip
// Works on Windows, Mac and Linux. Run from the project folder:  node deploy/build.mjs
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = (cmd, dir) => execSync(cmd, { cwd: path.join(root, dir), stdio: 'inherit' });

console.log('Building the screens...');
run('npm ci --silent', 'frontend');
run('npm run build --silent', 'frontend');
console.log('Building the server...');
run('npm ci --silent', 'server');
run('npm run build --silent', 'server');

const outDir = path.join(root, 'deploy', 'out');
const pkg = path.join(outDir, 'attendance-desk');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(path.join(pkg, 'public'), { recursive: true });
for (const f of ['app.cjs', 'cron.cjs', 'cli.cjs']) fs.copyFileSync(path.join(root, 'server', 'dist', f), path.join(pkg, f));
fs.cpSync(path.join(root, 'frontend', 'dist'), path.join(pkg, 'public'), { recursive: true });
fs.copyFileSync(path.join(root, 'server', 'config.sample.json'), path.join(pkg, 'config.sample.json'));
fs.copyFileSync(path.join(root, 'docs', 'DEPLOY.md'), path.join(pkg, 'DEPLOY.md'));
fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({
  name: 'attendance-desk',
  private: true,
  description: 'Attendance Desk. Everything is bundled: no npm install needed.',
  main: 'app.cjs',
  engines: { node: '>=18.17' },
}, null, 2) + '\n');

// Zip it with the server's own zip library, so no zip program is needed on this computer.
const JSZip = createRequire(path.join(root, 'server', 'package.json'))('jszip');
const zip = new JSZip();
const add = (dir, inZip) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    const name = `${inZip}/${e.name}`;
    if (e.isDirectory()) add(full, name);
    else zip.file(name, fs.readFileSync(full));
  }
};
add(pkg, 'attendance-desk');
const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
fs.writeFileSync(path.join(outDir, 'attendance-desk.zip'), buf);
console.log('Done: deploy/out/attendance-desk.zip');
