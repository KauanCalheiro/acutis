#!/bin/sh
#
# O que a suíte precisa de pé antes de rodar: o build do frontend, que o `webServer` do Playwright
# serve em modo preview.
set -e

cd "$(dirname "$0")/../../frontend"

pnpm build
