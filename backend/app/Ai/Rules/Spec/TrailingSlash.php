<?php

namespace App\Ai\Rules\Spec;

use App\Ai\Rules\Violation;
use App\Support\Primitives\Environments;
use App\Support\Primitives\Playwright;
use App\Support\Primitives\Url;

/**
 * Regex que termina em barra escapada exige a barra final: o sistema responde /produtos e o
 * teste esperava /produtos/, e quebra sem nada ter falhado.
 */
final class TrailingSlash
{
    /** @return list<Violation> */
    public static function check(Playwright $playwright, Url $base, Environments $environments): array
    {
        if (! $playwright->matches('~toHaveURL\s*\(\s*/.*\\\\/\s*/[a-z]*\s*\)~')) {
            return [];
        }

        return [new Violation(
            'barra-final',
            'A regex exige a barra final; o caminho vale com e sem ela, então feche em toHaveURL(/segmento/).',
        )];
    }
}
