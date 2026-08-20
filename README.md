# Acutis

Grava, gera e roda testes Playwright a partir do navegador.

Você navega pela aplicação que quer testar, o Acutis registra o que aconteceu e escreve o spec Playwright correspondente. Depois roda esse teste quando você pedir, mostrando cada passo em tempo real e gravando o vídeo da execução.

## Usar

```sh
pnpm dlx @acutis/cli
```

Sobe a interface numa porta livre e abre o navegador. Precisa de Node 22+; o Chromium do Playwright é baixado na primeira execução.

Os projetos ficam em `~/.acutis/<projeto>`: os specs em `tests/`, os cenários em Gherkin em `features/`, os ambientes em `environments/`, os segredos no `.env`.

## O que ele faz

- **Grava** um fluxo no navegador e emite o spec Playwright, com os passos nomeados como você os descreveu. Com IA ligada, escreve também o cenário em Gherkin.
- **Autentica** uma vez e reaproveita a sessão nos outros cenários, por `storageState`.
- **Executa** cenário por cenário, com a timeline de passos ao vivo, vídeo e o HTML da página quando o teste fecha vermelho.
- **Ambientes** trocam URL, credenciais e variáveis sem tocar no spec.
- **IA opcional** para gerar e corrigir cenários. Nasce desligada: você escolhe o provedor (Anthropic, Claude Agent, Codex, Google Gemini, Ollama, OpenAI, OpenRouter) na tela de configurações.

## Desenvolver

```sh
pnpm install   # uma vez, na raiz
./dev.sh       # aplicação completa em :3000
```

Um único processo Nuxt/Nitro serve interface, API, gravador e runner.

## Documentação

- [Casos de uso](docs/USE-CASES.md): o que a ferramenta faz, caso a caso
- [Rodar o Acutis](docs/RUN.md): como subir a aplicação
  - [Local](docs/LOCAL.md): o processo Nitro direto no host
  - [Testes](docs/TESTS.md): testes unitários, de integração e E2E
  - [Publicar](docs/DEPLOY.md): distribuir o CLI pelo npm
