# TODO

## Envio de logs em caso de erro...

## Revinar gravação de teste para gerar codigo mais inteligente, com esperas inteligentes.

## Valor preenchido pode ser dinâmico, não só o que foi gravado

- [ ] Levantar os eventos `fill` de uma gravação (o "Preenche X com Y" da timeline) e decidir quais valores fazem sentido variar por execução (ex.: e-mail único a cada run, CPF válido gerado, data relativa a hoje).
- [ ] Desenhar como o usuário declara isso: formulário dinâmico montado a partir dos `fill` do rascunho, um campo por valor, escolhendo entre fixo, variável de ambiente e gerado.
- [ ] Ver o que o `SpecEmitter::value` já resolve (marcador `{{VAR}}` → `process.env.X`) e o que falta pra emitir um valor gerado em vez de literal.
- [ ] Definir onde o gerado é executado: no spec (helper importado) ou no runner, e como isso aparece no histórico de execuções.

## Testar modelo de IA 100% local

- [ ] Subir um modelo pequeno (1-3B, ex.: Llama 3.2 3B ou Qwen2.5 3B) via Ollama/llama.cpp pra análise de intenção, título e nome de arquivo.
- [ ] Testar também um 7-8B quantizado numa máquina com 16GB de RAM e comparar qualidade.
- [ ] Comparar qualidade e latência contra o provedor remoto configurado nas mesmas entradas.
- [ ] Decidir se entra como fallback offline ou fica só de referência.
