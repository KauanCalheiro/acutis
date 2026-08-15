<?php

namespace App\Ai\Rules\Spec;

use App\Ai\Rules\Violation;
use App\Support\Primitives\Environments;
use App\Support\Primitives\Playwright;
use App\Support\Primitives\Url;

/**
 * O valor da variável vai ao modelo para ele decidir qual usar, não para copiar. É esta regra que
 * torna seguro mandar o valor: se o modelo cair na tentação do literal, a violação pega antes.
 */
final class LiteralValue
{
    /** Valor curto casa em qualquer lugar por acidente, então não vira acusação. */
    private const SHORT = 4;

    /** @return list<Violation> */
    public static function check(Playwright $playwright, Url $base, Environments $environments): array
    {
        $violations = [];

        foreach ($environments->exposed() as $var) {
            if (strlen((string) $var->value) < self::SHORT || ! $playwright->has((string) $var->value)) {
                continue;
            }

            $violations[] = new Violation(
                'valor-literal',
                "O valor de {$var->key} está escrito no arquivo; use process.env.{$var->key}.",
            );
        }

        return $violations;
    }
}
