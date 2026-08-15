#!/bin/sh
#
# O que a suíte precisa de pé antes de rodar.
#
# O passo do Laravel saiu com a migração: não há mais banco a migrar nem semear — o SQLite das
# configurações nasce vazio a cada execução, dentro do diretório de projetos temporário que cada
# spec cria. Sobrou o build do frontend, que o `webServer` do Playwright serve em modo preview.
set -e

cd "$(dirname "$0")/../../frontend"

pnpm build
