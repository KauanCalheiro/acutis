---
name: backend-contracts
description: Contratos de entrada e saída no backend — {Resource}Data (Spatie Data) e {Resource}Resource, nunca parent::toArray()
metadata:
  type: feedback
---

Ver [backend](backend.md).

## Entrada — `{Resource}Data`

Caminho: `app/Data/V1/{Resource}/{Resource}Data.php`. Spatie Data valida e tipifica automaticamente. Campos obrigatórios sem default; opcionais com `= default` ou `?Type = null`.

```php
class {Resource}Data extends Data {
    public function __construct(
        public readonly string $campo,          // obrigatório
        public readonly bool $fl_flag = false,  // opcional com default
        public readonly ?string $outro = null,  // nullable opcional
    ) {}
}
```

### Método `fromX` num Data

`Data::from()` despacha pelo tipo do argumento procurando um `fromString`/`fromArray`/`fromInt` etc. Parser próprio que possa devolver `null` (linha de comentário, entrada inválida) **não** pode usar esses nomes — bate no despacho e estoura. Nomear fora do padrão (`fromLine`, `fromHeader`) mantém o método um static comum.

## Saída — `{Resource}Resource`

Caminho: `app/Http/Resources/V1/{Resource}Resource.php`. **Nunca** `parent::toArray()` — expor só campos necessários.

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
