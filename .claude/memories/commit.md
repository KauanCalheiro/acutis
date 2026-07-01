---
name: commit
description: Fazer git commit — mensagem semântica, 1 linha ≤72, inglês, sem conjunção (and/e/&) nem Co-Author; nunca na main
metadata:
  type: feedback
---

**BLOQUEIO ABSOLUTO: NUNCA commitar diretamente em `main`.** Todo trabalho em branch dedicada → PR/MR → merge. Sem exceção, nem para docs, nem para hotfix.

Commits devem ser semânticos e de uma única linha curta. Sem co-author do Claude.

**Why:** Histórico limpo e legível. Co-author do Claude polui o git log.

**How to apply:** Sempre que criar um commit neste projeto:
- Usar prefixo semântico: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`, `style:`
- Máximo uma frase, uma linha (≤72 chars)
- **Nunca** incluir `Co-Authored-By: Claude` ou similar
- **Nunca** usar conjunção (`and`/`e`/`&`) na mensagem — se precisar, são dois commits separados (commit unitário por coisa feita)
- **Sempre** em inglês — mensagem, prefixo e descrição
