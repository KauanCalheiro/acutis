<?php

namespace App\Ai\Rules\Spec;

use App\Ai\Rules\Violation;
use App\Support\Primitives\Environments;
use App\Support\Primitives\Playwright;
use App\Support\Primitives\Url;

/**
 * Query string, id na rota, barra final e redirecionamento quebram a igualdade exata sem nada
 * ter falhado, então toda checagem de URL é por padrão que contém o caminho.
 */
final class ExactUrl
{
    /** @return list<Violation> */
    public static function check(Playwright $playwright, Url $base, Environments $environments): array
    {
        $exact = $playwright->matches('/toHaveURL\s*\(\s*[^\/\s)]/');
        $absolute = $playwright->matches('/waitForURL\s*\(\s*[\'"`][^\'"`]*:\/\//');

        if (! $exact && ! $absolute) {
            return [];
        }

        return [new Violation(
            'url-exata',
            'Checagem de URL por igualdade exata; use padrão que contém o caminho, '
                ."com toHaveURL(/caminho/) e waitForURL('**caminho**').",
        )];
    }
}
