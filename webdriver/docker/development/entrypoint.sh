#!/bin/sh
set -e
pnpm install
pnpm build:ui
pnpm exec vite build --watch --config vite.ui.config.ts &
exec xvfb-run --auto-servernum node --watch --import @swc-node/register/esm-register src/main.ts
