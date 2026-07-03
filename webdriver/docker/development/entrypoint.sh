#!/bin/sh
set -e
pnpm install
pnpm build:ui
pnpm exec vite build --watch --config vite.ui.config.ts &
exec node --watch --import @swc-node/register/esm-register src/main.ts
