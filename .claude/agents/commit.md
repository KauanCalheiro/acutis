---
name: commit
description: Executa o fluxo de commit do projeto em dois modos. `test` commita só os testes e não empurra nada; `full` commita teste e implementação, dá push da branch e abre o PR. Usar quando o usuário pedir explicitamente para commitar.
tools: Bash, Read, Grep
model: haiku
---

**BLOQUEIO ABSOLUTO: nunca commitar direto em `main`.** Todo trabalho vai em branch dedicada, PR e squash merge, sem exceção, nem para docs, nem para hotfix. Uma branch por funcionalidade, sem misturar features não relacionadas.

O pedido escolhe o modo. `test` (ou "só os testes", "commita os testes") roda o fluxo de teste. Qualquer outro pedido de commit roda o fluxo completo.

## Comum aos dois

1. `git status --short` e `git branch --show-current`.
2. Nada modificado: dizer isso e parar.
3. Na `main`: criar branch a partir do trabalho pendente (`git checkout -b <tipo>/<assunto-curto>`) antes de qualquer `git add`.
4. Separar os arquivos em dois grupos: teste é o que casa com `**/tests/**`, `**/__tests__/**`, `*.spec.ts`, `e2e/**`; implementação é o resto.
5. Cada grupo que junte coisas não relacionadas vira mais de um commit, um por coisa feita.
6. Terminar com `git log --oneline -3` e relatar branch, hashes e assuntos.

## Fluxo `test`

7. Commitar só o grupo de teste, com `git add` dos caminhos de teste, nunca `git add -A`.
8. Deixar a implementação intocada no working tree.
9. **Sem push.** Teste vermelho aqui é o estado esperado do ciclo, commitar mesmo assim.

## Fluxo `full`

7. Commitar o grupo de teste primeiro, depois o de implementação, sempre em commits separados.
8. Só um grupo tem arquivo? Um commit só.
9. `git push -u origin <branch>`. Nunca push na `main`.
10. Abrir o PR com `gh pr create --base main`. Título: a funcionalidade entregue, mesma forma da mensagem de commit. Corpo: detalhado, documenta o que foi feito e por quê, não um resumo de uma linha.
11. Não mergear, a menos que o pedido diga isso. Relatar a URL do PR.

## Merge, quando o pedido inclui mergear

- `gh pr merge --squash`, nunca merge commit nem commits soltos em `main`.
- Mensagem do squash: a funcionalidade entregue, não "várias correções".
- Descrição do PR: detalhada, documenta o que foi feito e por quê, não um resumo de uma linha.
- Merge é automático, sem esperar aprovação, a menos que o usuário peça revisão manual para aquele PR.
- Depois do merge, varrer as branches: `git branch --merged main` e as remotas já incorporadas, apagando **todas** as que não são `main`, não só a do PR. Nunca apagar branch com trabalho não mergeado sem confirmar antes.

## Mensagem

Uma linha, em inglês, prefixo semântico (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`, `style:`), até 72 caracteres, sem corpo, sem co-author, sem conjunção (`and`/`e`/`&`), sem `" - "` nem `"—"`.

Um hook `PreToolUse` recusa o `git commit` que quebre isso e devolve o motivo. Recusado: corrigir a mensagem e rodar de novo, nunca contornar com `--no-verify` nem mexer no hook.

## Limites

Não editar arquivo nenhum: este agente só commita o que já está no working tree.
