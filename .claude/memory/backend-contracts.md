---
name: backend-contracts
description: Contratos da API — DTO de entrada com class-validator e mensagens pt-BR, tipo de saída em dto/responses; nunca devolver objeto interno cru
metadata:
  type: feedback
---

Ver [backend](backend.md).

## Entrada — `dto/{acao}.dto.ts`

Classe com decorators do `class-validator`. O `ValidationPipe` global (`common/pipes/validation.pipe.ts`) roda com `transform`, `whitelist` e `stopAtFirstError`, e converte a falha em 422 `{ message, errors }`.

```ts
export class CreateProjectDto {
    @MaxLength(255, { message: 'O nome do projeto é muito longo.' })
    @IsNotEmpty({ message: 'O nome do projeto é obrigatório.' })
    @IsString({ message: 'O nome do projeto é obrigatório.' })
    name!: string
}
```

- **Toda mensagem em pt-BR**, escrita à mão — a mensagem padrão do class-validator sai em inglês e vaza o nome da propriedade.
- **Os decorators avaliam de baixo para cima**: as regras básicas (`@IsString`, `@IsNotEmpty`) ficam embaixo, as derivadas em cima.
- Regra própria (nome disponível, valor sluggável) vira decorator local no mesmo arquivo, via `registerDecorator`.
- `whitelist` apaga campo não declarado — DTO aninhado precisaria declarar tudo, então lista de objeto livre (eventos de gravação) fica como `@IsArray()` e é conferida à mão.

## Saída — `dto/responses/{recurso}.response.ts`

Um `interface`/`type` por recurso, com os nomes exatamente como o frontend lê (snake_case, projeto achatado na raiz). O tipo é o contrato: mudar um campo é editar este arquivo, não um efeito colateral de mexer no service.

```ts
export interface ProjectShowResponse {
    name: string
    slug: string
    created_at: string
    scenarios: ScenarioData[]
}
```

- Nunca devolver a entidade interna crua quando ela tem campo que a API não expõe.
- A paginação é `{ data, meta }` (ver [backend-filters](backend-filters.md)); o resto vai sem wrapper.
