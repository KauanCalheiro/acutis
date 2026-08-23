Teste SEMPRE antes do código de produção, em qualquer área do projeto. Sem exceção.

**Why:** garante testabilidade por design, cobertura obrigatória em código novo e contrato claro antes da implementação.

## Ciclo

1. Escrever o teste, que deve falhar **(red)**
2. Implementar o mínimo para passar **(green)**
3. Refatorar sem quebrar **(refactor)**

## Bloqueio absoluto

**NUNCA apagar um teste sem solicitação explícita do usuário.** Teste que falha é sinal de regressão ou contrato quebrado: investigar e corrigir o código, não remover o teste. Ignorar, comentar ou desabilitar tem o mesmo peso que apagar, proibido sem autorização direta.

## Convenções

- Teste cobre o comportamento externo (HTTP, tela), não a implementação interna
- Um teste por cenário, sem agrupar casos distintos no mesmo `it()`
- Factories e fixtures para dados, nunca fixture hardcoded compartilhada entre testes
- Teste de validação obrigatório para qualquer entrada de dados

## Onde o teste mora

| Mudança em | Teste em |
|------------|----------|
| `core/`, `server/`, `shared/contracts/` | `__tests__/` mais próximo, ou `tests/server/` |
| `app/` | `tests/` (Vitest + `@nuxt/test-utils`) e `e2e/` quando a mudança é de fluxo |
| `core/webdriver/` | Vitest para UI e pill, Playwright em `e2e/` para o navegador real |
