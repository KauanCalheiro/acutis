---
name: trace
description: Nunca editar por achismo — traçar o fluxo real do ponto de entrada até o arquivo que executa, e só então escolher onde mexer
metadata:
  type: feedback
---

Antes de qualquer edição, **traçar o fluxo real** do ponto que o usuário citou (a tela, o botão, o comando) até o código que executa. Nunca escolher arquivo por semelhança de nome nem por parecer o candidato óbvio.

**Why:** o usuário relatou que gerar um cenário de login saía com `process.env.BASE_URL`. Editei quem escreve o spec do cenário, por ser o candidato óbvio. O fluxo de autenticação não passa por ele: entra por `POST /auth/record` e vai pelo módulo de auth até quem escreve o `auth.setup.ts`. A correção foi para o arquivo errado e só não ficou assim porque o usuário perguntou se era mesmo aquele. Neste repo quase todo assunto tem mais de um candidato plausível — dois lugares que escrevem Playwright, dois modais que editam a mesma variável, duas rotas de gravação — e o nome do arquivo nunca é prova de qual roda.

**How to apply:**

- Seguir a cadeia inteira: componente → `$fetch` da rota → `frontend/server/api/` → `backend/src/modules/{domínio}/{domínio}.controller.ts` → service → provider → destino final.
- Antes de mexer em prompt de agente, confirmar qual agente aquele fluxo instancia; `grep` no nome da função a partir do service, não a partir do que o agente parece fazer.
- Havendo variante (cenário vs. autenticação, criar vs. editar, público vs. autenticado), confirmar com o usuário qual ele usou antes de editar.
- Bugfix: `grep` em todos os callers da função antes de corrigir — corrigir só o caminho relatado deixa os irmãos quebrados.
- O trace vem antes de escolher a solução mais curta: encurtar a solução é bom, encurtar a leitura é como se erra o arquivo.
