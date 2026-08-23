---
paths:
  - "core/webdriver/**"
  - "server/routes/**"
---

**Não implementar geração automática de espera ou asserção de rede a partir da gravação.** Foi construído por inteiro, verificado contra sistema real e removido no mesmo dia.

## O que foi construído

O gravador capturava resposta de rede por `page.on('response')` como evento `request`, filtrada a `xhr` e `fetch`. O `SpecEmitter` atribuía a cada passo a primeira resposta cumprida entre ele e o passo seguinte, e emitia `page.waitForResponse` declarado antes da ação, mais `expect((await resposta).status()).toBe(...)` quando a resposta era escrita.

Funcionava. O `auth.setup.ts` gerado do login da Univates passou contra o sistema real em 6.6s, esperando o `POST /univates-api/ldap` e conferindo o 200. Trocando a expectativa para 418 o teste falhava, então a asserção era real.

## Por que foi removido

A ideia inteira depende de inferir causalidade de carimbo de tempo, e o tráfego não carrega causalidade. Três medições da gravação real da Plataforma Univates:

1. **Terceiro é indistinguível de API legítima.** A primeira captura trouxe 42 respostas, com `m.clarity.ms/collect`, `api64.ipify.org`, `plugin.handtalk.me` e `cdn.jsdelivr.net`. O passo "Preenche Senha" virava conferência de status de um beacon do Clarity. Filtro de mesmo site resolveu esse caso e criou outro: aplicação com API em domínio separado deixa de funcionar em silêncio.
2. **Analítica mora no domínio da própria aplicação.** Das 7 escritas de mesmo site da gravação, 5 eram `POST /univates-api/analytics 201`. Nenhum filtro de host pega isso. O login só foi atribuído certo porque o `ldap` chegou antes das analíticas, o que é sorte de ordenação.
3. **Verbo HTTP não indica intenção.** `POST /meilisearch/indexes/.../search` é busca, e viraria conferência de status de escrita.

Cada filtro acrescentado estreitou a falha sem eliminá-la. Isso é sinal de abordagem errada, não de implementação incompleta.

## O que o ecossistema faz

Nenhuma ferramenta madura gera espera de rede a partir de gravação. O `playwright codegen` não emite espera nenhuma: locator tem auto-waiting (anexado, visível, estável, habilitado, recebendo ponteiro) e `expect` repete a checagem até passar, então o `expect(alvo).toBeVisible()` que o Acutis já gera **é** a espera. O Playwright desaconselha `networkidle` pelo mesmo motivo que derrubou isto aqui: página com analítica ou polling nunca fica ociosa. No Cypress o padrão existe (`cy.intercept` com alias e `cy.wait('@alias')`) mas é escrito à mão, e o Cypress Studio não o gera.

O consenso: quem nomeia a requisição que importa é a pessoa, não a gravação.

## Reabrir só com

Caso concreto de projeto real em que o auto-waiting não baste, e com a requisição relevante declarada por quem conhece o sistema, nunca inferida. Serve de material para a seção de abordagens descartadas do TCC.
