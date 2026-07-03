---
name: branches
description: Limpeza de branches — apagar branch local/remota assim que o PR é mergeado; nunca deixar branches órfãs acumulando
metadata:
  type: feedback
---

Depois que um PR é mergeado em `main`, apagar **todas** as branches que não são `main` (local e remota) — não só a que acabou de ser mergeada. Não deixar acumular branch morta.

**Why:** branch órfã confunde qual é o trabalho ativo e polui `git branch -a`.

**How to apply:** todo merge em `main` termina com uma varredura: `git branch --merged main` (local) e checar branches remotas mergeadas, apagando todas as que já estão incorporadas em `main` — não só a branch do PR atual. Nunca apagar uma branch com trabalho não mergeado sem confirmar antes.
