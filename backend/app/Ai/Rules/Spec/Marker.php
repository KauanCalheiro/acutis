<?php

namespace App\Ai\Rules\Spec;

use App\Ai\Rules\Violation;
use App\Support\Primitives\Environments;
use App\Support\Primitives\Playwright;
use App\Support\Primitives\Url;

/** O marcador dos eventos é para o modelo ler, não para copiar: no arquivo vira process.env. */
final class Marker
{
    /** @return list<Violation> */
    public static function check(Playwright $playwright, Url $base, Environments $environments): array
    {
        $markers = $playwright->capture('/\{\{([A-Z0-9_]+)\}\}/');

        if ($markers === []) {
            return [];
        }

        return [new Violation(
            'marcador-no-spec',
            'O marcador {{'.$markers[0].'}} foi copiado para o arquivo; escreva process.env.'.$markers[0].'.',
        )];
    }
}
