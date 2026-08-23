**Commitar só quando o usuário pedir explicitamente.** Terminar de implementar não autoriza commit. Deixar no working tree é o estado padrão de entrega, e vale igual para `git add`, `commit`, `push`, abrir PR e mergear.

**Autorização é pontual, nunca permanente.** "pode commitar" vale para aquele pedido e acaba ali; o trabalho seguinte precisa de um novo "pode".

**Única exceção:** pedido de análise ou revisão já autoriza commitar os testes antes, mesmo vermelhos ou com a implementação pela metade. O usuário revisa pelo painel de Source Control do VS Code, e separar por commit é o único jeito de o diff de implementação chegar sem os arquivos de teste junto.

O fluxo inteiro (branch, dois commits, push, PR, squash, limpeza de branch) é do subagente `commit`. Um hook `PreToolUse` recusa o `git commit` fora do padrão e devolve o motivo. Recusado: corrigir a mensagem e rodar de novo, nunca contornar com `--no-verify` nem mexer no hook.
