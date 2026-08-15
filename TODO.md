# TODO

## Valor preenchido pode ser dinâmico, não só o que foi gravado

- [ ] Levantar os eventos `fill` de uma gravação (o "Preenche X com Y" da timeline) e decidir quais valores fazem sentido variar por execução (ex.: e-mail único a cada run, CPF válido gerado, data relativa a hoje).
- [ ] Desenhar como o usuário declara isso: formulário dinâmico montado a partir dos `fill` do rascunho, um campo por valor, escolhendo entre fixo, variável de ambiente e gerado.
- [ ] Ver o que o `SpecEmitter::value` já resolve (marcador `{{VAR}}` → `process.env.X`) e o que falta pra emitir um valor gerado em vez de literal.
- [ ] Definir onde o gerado é executado: no spec (helper importado) ou no runner, e como isso aparece no histórico de execuções.

## Rodar todos os testes de um projeto respeitando o filtro de busca

- [ ] Na listagem de testes do projeto (`frontend/app/pages/projects/[slug].vue`), adicionar botão "Rodar filtrados" ao lado da busca.
- [ ] O botão dispara a run passando o texto da busca como filtro (ex.: `@tag` roda só os testes com essa tag), reaproveitando o matching que a busca já usa para exibir os testes.
- [ ] Backend/runner precisa aceitar filtro por tag/texto na chamada que dispara a execução em lote (checar `backend/src/webdriver/runner`).

## Empacotar a stack (webdriver + frontend + PHP + Git) num instalável

- [ ] Decidir abordagem: Electron empacotando os serviços, binário único (ex.: via `pkg`/Bun compile) ou instalador batch que baixa/configura as dependências.
- [ ] Levantar todas as dependências externas hoje assumidas no host (PHP, Composer, Node, Git, Playwright browsers) e o que falta vendorizar/embutir.
- [ ] Prototipar um build mínimo (um serviço só) pra validar a abordagem escolhida antes de estender pros três.
- [ ] Definir como o instalador provê/atualiza os binários do Playwright sem exigir `npx playwright install` manual do usuário final.

## Testar modelo de IA 100% local

- [ ] Subir um modelo pequeno (1-3B, ex.: Llama 3.2 3B ou Qwen2.5 3B) via Ollama/llama.cpp pra análise de intenção, título e nome de arquivo.
- [ ] Testar também um 7-8B quantizado numa máquina com 16GB de RAM e comparar qualidade.
- [ ] Comparar qualidade e latência contra o Gemma via Gemini API (pipeline atual) nas mesmas entradas.
- [ ] Decidir se entra como fallback offline ou fica só de referência.

## Gravação gerar Playwright executável direto, sem IA corrigindo

- [ ] Revisar o gerador de código a partir dos eventos gravados (`backend/src/webdriver/recorder`) e listar os casos que hoje dependem da IA pra corrigir o código gerado.
- [ ] Fechar os seletores/esperas desses casos na gravação (ex.: aguardar navegação, seletor estável) pra o código sair correto na primeira, sem passe de IA.
- [ ] Rodar o código gerado direto no Playwright (sem o passo de IA) como critério de aceite pra fechar o item.
