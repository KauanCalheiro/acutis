---
name: backend-model
description: Schema e Model no backend — migration a partir do DBML, PHP attributes Laravel 13 (nunca $table/$fillable), Factory
metadata:
  type: feedback
---

Ver [backend](backend.md).

## Schema — fonte de verdade

Consultar [schema](schema.md) (`docs/database/schema.dbml`) antes de criar qualquer artefato. Migration reflete exatamente colunas, tipos, defaults e FKs de lá.

```
php artisan make:migration create_ptc_{resources}_table --no-interaction
```
- Tabela com prefixo `ptc_`
- Sempre `$table->softDeletes()`

## Model + Factory

```
php artisan make:model {Resource} --factory --no-interaction
```

PHP attributes (Laravel 13.x) — **nunca** propriedades `$table`/`$fillable`:

```php
#[Table('ptc_{resources}')]
#[Fillable(['campo1', 'campo2', 'fl_flag'])]
class {Resource} extends Model
{
    use SoftDeletes;

    protected $attributes = ['fl_flag' => false]; // default de boolean, sem attribute equivalente

    protected function casts(): array
    {
        return ['fl_flag' => 'boolean'];
    }
}
```

Outros attributes: `#[Hidden([...])]` (`$hidden`), `#[Visible([...])]` (`$visible`), `#[WithoutTimestamps]`, `#[WithoutIncrementing]`, `#[ObservedBy([...])]`, `#[ScopedBy([...])]`, `#[UseFactory(...)]` (namespace fora do padrão), `#[Table(key: 'id_x')]` (`$primaryKey`).

Factory: `fake()` representativo por campo; opcionais com `fake()->optional()` ou `null` direto.
