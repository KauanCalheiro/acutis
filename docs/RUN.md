# Rodar o Acutis

A stack roda como processos diretos no host — é o único modo. O gravador precisa de um navegador
com janela e o produto final é um CLI npm que o usuário instala na própria máquina: containerizar o
desenvolvimento simulava um cenário que não existe em produção.

| Documento | Assunto |
|-----------|---------|
| [LOCAL.md](LOCAL.md) | Subir a stack — precisa de Node 22+ e pnpm instalados |
| [TESTS.md](TESTS.md) | As três suítes de teste (backend, frontend, e2e): comandos e peculiaridades |
| [DEPLOY.md](DEPLOY.md) | Publicar o CLI no npm — o que vai no pacote e como testar antes |

## Portas

Os dois conjuntos são disjuntos de propósito: a suíte E2E roda com a stack de desenvolvimento de
pé, sem derrubar nada.

| Serviço | Dev | E2E |
|---------|-----|-----|
| frontend (Nuxt) | 3000 | 4300 |
| backend (NestJS) | 4000 | 4400 |

O backend serve a API `/api/v1`, o gravador e o runner no mesmo processo desde a migração para Node.
