#!/usr/bin/env bash
# Builds the upload package for cPanel: deploy/out/attendance-desk.zip
# Run from anywhere: bash deploy/build.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Building the screens..."
(cd frontend && npm ci --silent && npm run build --silent)
echo "Building the server..."
(cd server && npm ci --silent && npm run build --silent)

OUT=deploy/out/attendance-desk
rm -rf deploy/out
mkdir -p "$OUT/public"
cp server/dist/app.cjs server/dist/cron.cjs server/dist/cli.cjs "$OUT/"
cp -r frontend/dist/. "$OUT/public/"
cp server/config.sample.json docs/DEPLOY.md "$OUT/"
cat > "$OUT/package.json" <<'JSON'
{
  "name": "attendance-desk",
  "private": true,
  "description": "Attendance Desk. Everything is bundled: no npm install needed.",
  "main": "app.cjs",
  "engines": { "node": ">=18.17" }
}
JSON
(cd deploy/out && zip -qr attendance-desk.zip attendance-desk)
echo "Done: deploy/out/attendance-desk.zip"
