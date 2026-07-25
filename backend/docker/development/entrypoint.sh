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
    exec gosu "$HOST_UID:$HOST_GID" "$@"
  fi
fi

exec "$@"
