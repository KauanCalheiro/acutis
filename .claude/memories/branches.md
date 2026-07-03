---
name: branches
description: Limpeza de branches — apagar branch local/remota assim que o PR é mergeado; nunca deixar branches órfãs acumulando
metadata:
  type: feedback
---

Depois que um PR é mergeado em `main`, apagar a branch de origem (local e remota) — não deixar acumular branch morta.

**Why:** branch órfã confunde qual é o trabalho ativo e polui `git branch -a`.

**How to apply:** ao finalizar um PR (ou quando pedido pra limpar branches), rodar `git branch --merged main` / checar branches remotas mergeadas e apagar as que já foram incorporadas — nunca apagar uma branch com trabalho não mergeado sem confirmar antes.
