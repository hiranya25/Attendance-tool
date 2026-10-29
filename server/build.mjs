// Bundles the server into three self-contained files (dist/app.cjs, dist/cron.cjs, dist/cli.cjs),
// so the cPanel server does not need to run npm install.
import { build } from 'esbuild';

const optional = ['better-sqlite3', 'sqlite3', 'pg-query-stream', 'oracledb', 'tedious', 'mysql', 'pg-native'];
for (const name of ['app', 'cron', 'cli']) {
  await build({
    entryPoints: [`src/${name}.ts`],
    outfile: `dist/${name}.cjs`,
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    external: optional,
    logLevel: 'warning',
    banner: { js: '/* Attendance Desk server. Built file: edit src/ and run npm run build. */' },
    define: { 'import.meta.url': '__importMetaUrl' },
    inject: ['./build-shim.mjs'],
  });
}
console.log('Built dist/app.cjs, dist/cron.cjs, dist/cli.cjs');
