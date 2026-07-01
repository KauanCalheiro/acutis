---
name: backend-patterns
description: Criar recurso/CRUD V1 no backend — camadas migration, model, Data (entrada), Resource (saída), Controller, Rota
metadata:
  type: feedback
---

Detalhe de cada artefato no fluxo. Ver [[backend]] para o diagrama e ordem de criação.

---

## Schema — fonte de verdade

Consultar `database/schema/schema.dbml` (ver [[schema]]) antes de criar qualquer artefato. A migration deve refletir exatamente colunas, tipos, defaults e FKs definidos lá.

```
php artisan make:migration create_ptc_{resources}_table --no-interaction
```
- Tabela com prefixo `ptc_`
- Sempre `$table->softDeletes()`

---

## Entrada — `{Resource}Data`

Caminho: `app/Data/V1/{Resource}/{Resource}Data.php`

Contrato do que entra na API. Spatie Data valida e tipifica automaticamente. Campos obrigatórios sem default; opcionais com `= default` ou `?Type = null`.

```php
class {Resource}Data extends Data {
    public function __construct(
        public readonly string $campo,          // obrigatório
        public readonly bool $fl_flag = false,  // opcional com default
        public readonly ?string $outro = null,  // nullable opcional
    ) {}
}
```

---

## Persistência — Model + Factory

```
php artisan make:model {Resource} --factory --no-interaction
```

**Model** (`app/Models/{Resource}.php`):

Usar PHP attributes (Laravel 13.x) — **nunca** propriedades `$table`/`$fillable`.

```php
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Table('ptc_{resources}')]
#[Fillable(['campo1', 'campo2', 'fl_flag'])]
class {Resource} extends Model
{
    use SoftDeletes;

    protected $attributes = ['fl_flag' => false]; // defaults de booleanos — sem attribute PHP equivalente

    protected function casts(): array
    {
        return [
            'fl_flag' => 'boolean',
        ];
    }
}
```

Attributes PHP disponíveis no Model:

| Attribute | Substitui | Exemplo |
|-----------|-----------|---------|
| `#[Table('ptc_x')]` | `$table` | `#[Table('ptc_voos')]` |
| `#[Table(key: 'id_voo')]` | `$primaryKey` | chave primária customizada |
| `#[Fillable([...])]` | `$fillable` | `#[Fillable(['nome', 'fl_ativo'])]` |
| `#[Hidden([...])]` | `$hidden` | `#[Hidden(['senha'])]` |
| `#[Visible([...])]` | `$visible` | `#[Visible(['nome'])]` |
| `#[WithoutTimestamps]` | `$timestamps = false` | sem `created_at`/`updated_at` |
| `#[WithoutIncrementing]` | `$incrementing = false` | PKs não auto-increment |
| `#[ObservedBy([XObserver::class])]` | `observe()` no AppServiceProvider | |
| `#[ScopedBy([XScope::class])]` | `addGlobalScope()` no boot | |
| `#[UseFactory(XFactory::class)]` | convenção de namespace | factory fora do padrão |

**Factory** (`database/factories/{Resource}Factory.php`):
- `fake()` representativo para cada campo
- Nullable/opcionais com `fake()->optional()` ou `null` direto

---

## Saída — `{Resource}Resource`

Caminho: `app/Http/Resources/V1/{Resource}Resource.php`

Contrato do que sai da API. **Nunca** `parent::toArray()` — expor só campos necessários.

```php
public function toArray(Request $request): array {
    return [
        'id'         => $this->id,
        'campo'      => $this->campo,
        'created_at' => $this->created_at,
        'updated_at' => $this->updated_at,
    ];
}
```

`JsonResource::withoutWrapping()` ativo globalmente — resposta sem `data` wrapper (exceto paginação).

---

## Ação — lógica de negócio

Toda lógica de negócio vive numa Action em `app/Action/`, via `lorisleiva/laravel-actions` (trait `AsAction`). Controller **não** implementa regra — só orquestra.

```php
use Lorisleiva\Actions\Concerns\AsAction;

class CreateProjectFromTemplate
{
    use AsAction;

    public function handle(string $name): ProjectData { /* ... */ }
}
```

- `Action::run(...)` → executa (`make()->handle()` por baixo)
- `Action::make()` → instância resolvida do container
- **Throws/exceptions e mensagens de erro sempre em pt-BR** (idem mensagens de validação em `Data::messages()`)

## Orquestrador — Controller

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

---

## Exposição — Rota

Em `routes/api/v1.php`:
```php
Route::apiResource('{resources}', {Resource}Controller::class);
```

**Gotcha PT-BR:** plurais singularizam errado (`setores`→`setore`, `perfis`→`perfi`). Corrigir com:
```php
->parameters(['{resources}' => '{resource}'])
```

Entry point `routes/api.php` aplica prefixo; rotas v1 ficam em `routes/api/v1.php` com prefixo `/api/v1/`.
