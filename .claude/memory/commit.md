---
name: commit
description: Fazer git commit/branch/PR/merge — nunca commitar na main, branch por funcionalidade, merge sempre via squash com descrição detalhada
metadata:
  type: feedback
---

**Commitar só quando o usuário pedir explicitamente.** Terminar de implementar não autoriza commit; deixar no working tree é o estado padrão de entrega. Vale igual para `git add`, `commit`, `push`, abrir PR e mergear.

**Autorização é pontual, nunca permanente.** "pode commitar", "pode fazer o fluxo de commit" valem para aquele pedido e acabam ali — o trabalho seguinte precisa de um novo "pode".

**BLOQUEIO ABSOLUTO: NUNCA commitar diretamente em `main`.** Todo trabalho em branch dedicada → PR/MR → merge. Sem exceção, nem para docs, nem para hotfix. Depois de mergear, a branch é apagada — conferir em que branch se está **antes** de commitar, senão o próximo commit cai na `main`.

Commits devem ser semânticos e de uma única linha curta. Sem co-author do Claude.

**Why:** Histórico limpo e legível. Co-author do Claude polui o git log.

**How to apply:** Sempre que criar um commit neste projeto:
- Usar prefixo semântico: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`, `style:`
- Máximo uma frase, uma linha (≤72 chars)
- **Nunca** incluir `Co-Authored-By: Claude` ou similar
- **Nunca** usar conjunção (`and`/`e`/`&`) na mensagem — se precisar, são dois commits separados (commit unitário por coisa feita)
- **Sempre** em inglês — mensagem, prefixo e descrição

## Branch e merge

- Uma branch dedicada por funcionalidade (não misturar features não relacionadas na mesma branch).
- Ao concluir, abrir PR e mergear em `main` via **squash** (`gh pr merge --squash`) — não merge commit simples, não commits individuais soltos em `main`.
- Mensagem do squash commit: a funcionalidade/comportamento entregue (não "várias correções").
- Descrição do merge/PR: detalhada, funciona como documentação do que foi feito e por quê — não só um resumo de uma linha.
- Merge é automático (sem esperar aprovação) a menos que o usuário peça revisão manual explicitamente para aquele PR.
- Depois do merge, limpar as branches órfãs — ver [branches](branches.md).
