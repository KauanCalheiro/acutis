---
name: backend-module
description: Anatomia de um módulo da API — controller magro, service com a regra, providers de domínio, entities; um módulo por domínio em backend/src/modules
metadata:
  type: feedback
---

Ver [backend](backend.md).

## Um módulo por domínio

`backend/src/modules/{dominio}/` — `ai`, `auth`, `environment`, `generation`, `git`, `project`, `recording`, `rules`, `scenario`, `settings`. Dentro dele:

```
{dominio}/
├── {dominio}.module.ts       # @Module — imports, controllers, providers, exports
├── {dominio}.controller.ts   # rotas @Controller('api/v1/...')
├── {dominio}.service.ts      # @Injectable — a regra de negócio
├── dto/                      # entrada (class-validator) + dto/responses/ (saída)
├── entities/                 # o objeto do domínio (Project, AiSettings)
├── providers/                # leitura/escrita do que está em disco (Dotenv, Environments, Git)
└── __tests__/                # os specs do módulo
```

Módulo novo entra em `modules/api.module.ts`, que é a API inteira. O nome do arquivo não encolhe por causa da pasta: `project.service.ts`, não `service.ts`.

## Controller — magro

Só recebe, delega e devolve. Nada de regra dentro dele:

```ts
@Controller('api/v1/projects')
export class ProjectController {
    constructor(private readonly projects: ProjectService) {}

    @Get(':project')
    show(@Param('project') slug: string): Promise<ProjectShowResponse> {
        return this.projects.findOne(slug)
    }
}
```

| Ação | Entrada | Saída | Status |
|------|---------|-------|--------|
| `index` | `@Query()` no formato JSON:API | `PaginatedResponse<T>` | 200 |
| `store` | `@Body() {X}Dto` | a entidade ou o response | 201 (`@HttpCode(201)` quando o Nest não dá) |
| `show` | `@Param()` | `{X}Response` | 200 |
| `update` | `@Param()` + `@Body() {X}Dto` | `{X}Response` | 200 |
| `destroy` | `@Param()` | nada | 204 (`@HttpCode(204)`) |

POST que não cria recurso (rascunho, correção, sondagem) leva `@HttpCode(200)`.

**Id com barra:** cenário em subpasta (`checkout/pagar`) é um id só — a rota usa curinga (`:scenario(*)`).

## Service — a regra

`@Injectable()`, injetado por construtor. Ele quem lança os erros de domínio (`NotFound`, `ValidationFailed` — ver [backend-conventions](backend-conventions.md)) e monta o response.

## Providers — o acesso ao que está fora

Classe ou função em `providers/` para tudo que toca disco, git ou banco: `Environments`, `Dotenv`, `Git`, `Scenario`, `TestArtifact`. O service orquestra, o provider executa — é o que deixa o service testável e o provider reusável entre módulos.

Classe de provider que executa ações usa named constructor e encadeia (`Git.in(path).commit(msg).push()`); método de consulta devolve o valor.

## Dependência entre módulos

Módulo que precisa do service de outro **importa o módulo** (`imports: [GitModule]`), nunca copia o provider. Duas exceções já no código, ambas para não arrastar um controller ou fechar ciclo: `AuthModule` declara `RunnerService` direto e `ScenarioModule` declara `ProjectService`. Repetir o truque só quando o import de verdade quebrar o grafo.
