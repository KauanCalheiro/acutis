#!/bin/sh
set -e

if [ "$(id -u)" = "0" ]; then
  HOST_UID=$(stat -c '%u' /app)
  HOST_GID=$(stat -c '%g' /app)
  if [ "$HOST_UID" != "0" ]; then
    getent group "$HOST_GID" >/dev/null || groupadd -g "$HOST_GID" dev
    getent passwd "$HOST_UID" >/dev/null || useradd -u "$HOST_UID" -g "$HOST_GID" -s /bin/sh -M dev
    export HOME=/home/dev
    mkdir -p "$HOME"
    chown "$HOST_UID:$HOST_GID" "$HOME"
    if [ -d /app/node_modules ] && [ "$(stat -c '%u' /app/node_modules)" != "$HOST_UID" ]; then
      chown -R "$HOST_UID:$HOST_GID" /app/node_modules
    fi
    exec gosu "$HOST_UID:$HOST_GID" "$0" "$@"
  fi
fi

pnpm install
pnpm build:ui
pnpm exec vite build --watch --config vite.ui.config.ts &
exec xvfb-run --auto-servernum node --watch --import @swc-node/register/esm-register src/main.ts
