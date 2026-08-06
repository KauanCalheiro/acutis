<?php

namespace App\Ai\Rules\Spec;

use App\Ai\Rules\Violation;
use App\Support\Primitives\Environments;
use App\Support\Primitives\Playwright;
use App\Support\Primitives\Url;

/**
 * Quem explica o passo é o título do test.step, então o arquivo gerado não leva comentário. O
 * padrão exige início de linha ou espaço antes, senão as duas barras de https:// virariam um.
 */
final class Comment
{
    /** @return list<Violation> */
    public static function check(Playwright $playwright, Url $base, Environments $environments): array
    {
        if (! $playwright->matches('/(^|\s)(\/\/|\/\*)/m')) {
            return [];
        }

        return [new Violation(
            'comentario-inline',
            'Comentário no arquivo gerado; quem explica o passo é o título do test.step.',
        )];
    }
}
