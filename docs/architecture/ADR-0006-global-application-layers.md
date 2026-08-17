# ADR 0006: camadas globais da aplicação

## Status

Aceita em 2026-08-16.

## Contexto

Controllers, DTOs e casos de uso ficavam aninhados em cada módulo Nest. Essa organização privilegiava a descoberta por domínio, mas dificultava encontrar todas as operações oferecidas pela aplicação e fazia o diretório `modules` parecer o centro da arquitetura.

## Decisão

Controllers ficam em `src/controllers/<domínio>`, casos de uso em `src/use-cases/<domínio>` e DTOs em `src/dto/<domínio>`. Os módulos Nest continuam em `src/modules/<domínio>` como pontos de composição e registro de dependências.

Services e providers existentes permanecem nos domínios até que cada acesso físico tenha uma porta adequada. Eles não serão movidos apenas para produzir uma aparência de arquitetura limpa.

## Consequências

As operações da aplicação são encontradas pela camada e pelo domínio. Controllers dependem de casos de uso. Testes arquiteturais impedem o retorno das três camadas para dentro de `modules`.
