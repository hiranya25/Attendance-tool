#!/usr/bin/env bash
# Same as: node deploy/build.mjs  (which also works on Windows)
set -euo pipefail
cd "$(dirname "$0")/.."
node deploy/build.mjs
