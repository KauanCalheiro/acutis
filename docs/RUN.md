# Rodar o Acutis

O Acutis roda diretamente no host. Um único processo Nuxt/Nitro serve a interface, a API, o WebSocket do gravador e o runner.

| Documento | Assunto |
|-----------|---------|
| [LOCAL.md](LOCAL.md) | Subir o app com Node 22+ e pnpm |
| [TESTS.md](TESTS.md) | Testes Vitest e Playwright |
| [DEPLOY.md](DEPLOY.md) | Empacotar e publicar o CLI |

## Portas

| Execução | Porta |
|----------|-------|
| desenvolvimento | 3000 |
| E2E | 4400 |

Todos os caminhos HTTP e WebSocket usam a mesma origem.
