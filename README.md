# Acutis

Grava, gera e roda testes Playwright a partir do navegador.

Você navega pela aplicação que quer testar, o Acutis registra o que aconteceu e escreve o spec Playwright correspondente. Depois roda esse teste quando você pedir, mostrando cada passo em tempo real e gravando o vídeo da execução.

## Usar

```sh
npx @acutis/cli
```

Sobe a interface numa porta livre e abre o navegador. Precisa de Node 22+; o Chromium do Playwright é baixado na primeira execução. Nada a aprovar, nada a configurar.

Os projetos ficam em `~/.acutis/<projeto>`: os specs em `tests/`, os cenários em Gherkin em `features/`, os ambientes em `environments/`, os segredos no `.env`.

> ### 📖 [Guia rápido: do primeiro comando ao primeiro relatório](docs/QUICK-START.md)
>
> O manual do Acutis, passo a passo: subir a ferramenta, ligar a IA (ou não), criar o projeto, gravar o login, gravar e rodar o primeiro cenário, ler os relatórios e resolver o que costuma dar errado.
>
> **Comece por aqui.**

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

- **[Guia rápido](docs/QUICK-START.md): o manual de quem usa, do primeiro comando ao primeiro relatório**
- [Diagramas de casos de uso](docs/DIAGRAMS/USE-CASE-DIAGRAMS.md): o panorama por pacote, os estados e o que cada ação escreve
- [Diagramas de sequência](docs/DIAGRAMS/SEQUENCE-DIAGRAMS.md): cada fluxo, do clique ao arquivo em disco
- [Rodar o Acutis](docs/RUN.md): como subir a aplicação
  - [Desenvolvimento](docs/DEVELOPMENT.md): o processo Nitro direto no host
  - [Testes](docs/TESTS.md): testes unitários, de integração e E2E
  - [Publicar](docs/DEPLOY.md): distribuir o CLI pelo npm
