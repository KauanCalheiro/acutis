---
name: backend-action
description: Orquestração no backend — Action (AsAction) com a lógica de negócio, Controller magro, Rota com gotcha de plural PT-BR
metadata:
  type: feedback
---

Ver [backend](backend.md).

## Ação — lógica de negócio

Toda lógica de negócio vive numa Action em `app/Action/`, via `lorisleiva/laravel-actions` (trait `AsAction`). Controller **não** implementa regra — só orquestra.

**Uma pasta por domínio**, como o resto do backend (`app/Ai/Agents/`, `app/Data/V1/`): `Auth/`, `Environment/`, `Project/`, `Recording/`, `Scenario/`, `Settings/`. Action nova entra na pasta do domínio dela; nome da classe **não** encolhe por causa da pasta (`Project\DeleteProject`, não `Project\Delete`) — encurtar estraga o grep pelo nome.

```php
use Lorisleiva\Actions\Concerns\AsAction;

class CreateProjectFromTemplate
{
    use AsAction;
    public function handle(string $name): ProjectData { /* ... */ }
}
```

- `Action::run(...)` → executa (`make()->handle()` por baixo); `Action::make()` → instância resolvida do container
- **Throws/exceptions e mensagens de erro sempre em pt-BR** (idem `Data::messages()`)

## Controller

```
php artisan make:controller V1/{Resource}Controller --resource --model={Resource} --no-interaction
```
Caminho: `app/Http/Controllers/V1/{Resource}Controller.php`

| Ação | Entrada | Saída | Status |
|------|---------|-------|--------|
| `index` | query params | `AnonymousResourceCollection` (QueryBuilder + jsonPaginate) | 200 |
| `store` | `{Resource}Data` | `JsonResponse` wrapping Resource | 201 |
| `show` | model binding | `{Resource}Resource` | 200 |
| `update` | `{Resource}Data` + model binding | `{Resource}Resource` | 200 |
| `destroy` | model binding | `response()->noContent()` (soft delete) | 204 |

## Rota

Em `routes/api/v1.php`:
```php
Route::apiResource('{resources}', {Resource}Controller::class);
```

**Gotcha PT-BR:** plurais singularizam errado (`setores`→`setore`, `perfis`→`perfi`). Corrigir com `->parameters(['{resources}' => '{resource}'])`.
