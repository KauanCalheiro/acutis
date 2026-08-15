---
name: tdd
description: Convenções universais de TDD — red/green/refactor, aplica-se a qualquer stack do projeto
metadata:
  type: feedback
---

Testes SEMPRE antes do código de produção. Sem exceção. Aplica-se ao backend.

**Why:** Garante testabilidade por design, cobertura obrigatória em código novo e contrato claro antes da implementação.

## Ciclo

1. Escrever o teste — deve falhar **(red)**
2. Implementar o mínimo para passar **(green)**
3. Refatorar sem quebrar **(refactor)**

## Bloqueio absoluto

**NUNCA apagar um teste sem solicitação explícita do usuário.** Teste que falha = sinal de regressão ou contrato quebrado — investigar e corrigir o código, não remover o teste. Ignorar, comentar ou desabilitar tem o mesmo peso que apagar: proibido sem autorização direta.

## Convenções

- Teste cobre o comportamento externo (HTTP), não a implementação interna
- Um teste por cenário — não agrupar casos distintos no mesmo `it()`
- Factories/fixtures para dados, nunca fixtures hardcoded compartilhadas entre testes
- Teste de validação obrigatório para qualquer entrada de dados

## Stack

Backend (NestJS): Vitest + o harness `startApi` → [backend-tdd](backend-tdd.md)
