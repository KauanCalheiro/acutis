# Acutis

Grava, gera e roda testes Playwright a partir do navegador.

Você navega pela aplicação que quer testar, o Acutis registra o que aconteceu e escreve o spec Playwright correspondente. Depois roda esse teste quando você pedir, mostrando cada passo em tempo real e gravando o vídeo da execução.

## Trabalho de conclusão de curso

O Acutis é o objeto do Trabalho de Conclusão de Curso *Acutis: plataforma local-first de testes automatizados*, do curso de Engenharia de Software da Universidade do Vale do Taquari (Univates).

O trabalho é uma pesquisa aplicada: o produto é uma ferramenta funcional que ataca um problema concreto. O teste automatizado de ponta a ponta esbarra em três obstáculos:

- **Barreira técnica:** exige domínio de framework, linguagem e estratégia de seletores.
- **Dados fora de casa:** as soluções prontas costumam ser SaaS e enviam dados sensíveis a servidores externos.
- **Artefatos presos:** os testes ficam em repositórios proprietários, longe do Git e do pipeline.

O Acutis responde aos três: roda na máquina de quem testa, grava o fluxo no navegador, escreve o teste (e, com IA ligada, a documentação em Gherkin) e salva tudo no repositório do projeto.

## Validação com usuários

A etapa final do trabalho verifica se a ferramenta cumpre essa proposta nas mãos de quem não a construiu. Cada participante usa o Acutis contra um sistema web real que já conheça e percorre o roteiro abaixo sem ajuda do autor:

1. **Criar o projeto** do sistema que vai ser testado.
2. **Gravar a autenticação**, para que todos os cenários partam logados.
3. **Gravar os cenários** dos fluxos principais do sistema, que viram a suíte de testes automatizados.
4. **Gerar os relatórios** das execuções e interpretar o resultado.
5. **Enquadrar a suíte em um CI/CD**, rodando os mesmos testes no pipeline do sistema (opcional).

Ao fim, o participante responde um formulário de satisfação e sugestões. As respostas medem onde o roteiro travou e orientam as próximas iterações da ferramenta.

As orientações de uso de cada passo estão no guia rápido, logo abaixo.

## Usar

```sh
npx @acutis/cli@latest
```

Sobe a interface em `http://localhost:1991` e abre o navegador. Precisa de Node 22+; o Chromium do Playwright é baixado na primeira execução. Nada a aprovar, nada a configurar.

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
