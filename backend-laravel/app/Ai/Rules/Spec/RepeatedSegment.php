<?php

namespace App\Ai\Rules\Spec;

use App\Ai\Rules\Violation;
use App\Support\Primitives\Environments;
use App\Support\Primitives\Playwright;
use App\Support\Primitives\Url;

/**
 * O caminho concatenado é só o que sobra depois da URL base. Base https://sistema.test/intranet
 * com o evento em /intranet/produtos vira `${base}/produtos`, nunca `${base}/intranet/produtos`.
 * O padrão procura o caminho colado logo depois da variável, em template string ou concatenação.
 */
final class RepeatedSegment
{
    /** @return list<Violation> */
    public static function check(Playwright $playwright, Url $base, Environments $environments): array
    {
        $path = $base->path();

        if ($path === '' || ! $playwright->matches('/(\}|\+\s*[\'"`])'.preg_quote($path, '/').'\b/')) {
            return [];
        }

        return [new Violation(
            'segmento-repetido',
            "A URL base já traz {$path}; o caminho concatenado é só o que sobra depois dela.",
        )];
    }
}
