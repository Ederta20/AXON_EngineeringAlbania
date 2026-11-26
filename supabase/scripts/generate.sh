#!/usr/bin/env bash
# Regenerates supabase/seed.sql, supabase/data/csv/*.csv and supabase/data/axon_seed.json.
# Needs the front end's dependencies installed (cd axon_initial_template_front && npm ci).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BUILD="$(mktemp -d)"
trap 'rm -rf "$BUILD"' EXIT
"$ROOT/axon_initial_template_front/node_modules/.bin/tsc" \
  --outDir "$BUILD" --rootDir "$ROOT" --module commonjs --target es2022 --moduleResolution node \
  --strict --skipLibCheck --esModuleInterop --types node \
  --typeRoots "$ROOT/axon_initial_template_front/node_modules/@types" \
  "$ROOT/supabase/scripts/generate-seed.ts"
node "$BUILD/supabase/scripts/generate-seed.js" "$ROOT/supabase"
