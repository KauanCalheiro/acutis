# TODO

## Valor preenchido pode ser dinâmico, não só o que foi gravado

- [ ] Levantar os eventos `fill` de uma gravação (o "Preenche X com Y" da timeline) e decidir quais valores fazem sentido variar por execução (ex.: e-mail único a cada run, CPF válido gerado, data relativa a hoje).
- [ ] Desenhar como o usuário declara isso: formulário dinâmico montado a partir dos `fill` do rascunho, um campo por valor, escolhendo entre fixo, variável de ambiente e gerado.
- [ ] Ver o que o `SpecEmitter::value` já resolve (marcador `{{VAR}}` → `process.env.X`) e o que falta pra emitir um valor gerado em vez de literal.
- [ ] Definir onde o gerado é executado: no spec (helper importado) ou no runner, e como isso aparece no histórico de execuções.

## Rodar todos os testes de um projeto respeitando o filtro de busca

- [ ] Na listagem de testes do projeto (`frontend/app/pages/projects/[slug].vue`), adicionar botão "Rodar filtrados" ao lado da busca.
- [ ] O botão dispara a run passando o texto da busca como filtro (ex.: `@tag` roda só os testes com essa tag), reaproveitando o matching que a busca já usa para exibir os testes.
- [ ] Backend/runner precisa aceitar filtro por tag/texto na chamada que dispara a execução em lote (checar `webdriver/src/runner`).

## Empacotar a stack (webdriver + frontend + PHP + Git) num instalável

**Implementado em 14/08/2026.** Tauri 2 subindo os três serviços como processos filhos, com os
runtimes vendorizados. Como funciona e como construir: [docs/DESKTOP.md](docs/DESKTOP.md); o desenho
e o que mudou nele: [a spec](docs/superpowers/specs/2026-08-14-empacotamento-desktop-design.md).
Fecha o [#56](https://github.com/KauanCalheiro/acutis/issues/56) — nativo, o gravador abre o próprio
Chromium e o Chrome com `:9222` some.

Verificado no macOS (Apple Silicon): `.dmg` de 373 MB, os três serviços de pé, um teste Playwright
executado pelo runner do app com o node e o Chromium do bundle.

Falta:

- [ ] Rodar o workflow e validar os instaladores de **Windows** e **Linux** — foram escritos mas nunca executados; só o macOS foi construído e testado de verdade.
- [ ] Assinar (conta paga da Apple para notarizar; certificado EV para o SmartScreen). Sem isso o updater do Tauri também não entra: atualizar é baixar a versão nova.
- [ ] Janela de progresso na extração do payload: o primeiro boot fica alguns minutos em silêncio.
- [ ] `kill -9` no app ainda deixa os três filhos vivos até o boot seguinte, que os limpa pelo arquivo `pids`. Fechar a janela derruba tudo normalmente.

Alternativas levantadas e não descartadas, caso o Tauri incomode:

- **Electron + `electron-builder`** — mesmo resultado, tudo em Node, zero Rust no CI; mais gordo e mais RAM. É o plano B natural.
- **Launcher puro + navegador padrão** — um binário sobe os processos e abre `localhost` no Chrome do usuário. Menos maquinaria, mas `.dmg`/`.msi`/`.AppImage` e assinatura na mão, e binário solto tromba no Gatekeeper do macOS.
- **Binário único por serviço** (FrankenPHP `embed`, SEA/`bun compile`) — descartado: FrankenPHP no Windows é imaturo e o requisito é um download, não um arquivo.

## Testar modelo de IA 100% local

- [ ] Subir um modelo pequeno (1-3B, ex.: Llama 3.2 3B ou Qwen2.5 3B) via Ollama/llama.cpp pra análise de intenção, título e nome de arquivo.
- [ ] Testar também um 7-8B quantizado numa máquina com 16GB de RAM e comparar qualidade.
- [ ] Comparar qualidade e latência contra o Gemma via Gemini API (pipeline atual) nas mesmas entradas.
- [ ] Decidir se entra como fallback offline ou fica só de referência.

## Gravação gerar Playwright executável direto, sem IA corrigindo

- [ ] Revisar o gerador de código a partir dos eventos gravados (`webdriver/src/recorder`) e listar os casos que hoje dependem da IA pra corrigir o código gerado.
- [ ] Fechar os seletores/esperas desses casos na gravação (ex.: aguardar navegação, seletor estável) pra o código sair correto na primeira, sem passe de IA.
- [ ] Rodar o código gerado direto no Playwright (sem o passo de IA) como critério de aceite pra fechar o item.
