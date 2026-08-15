<?php

namespace App\Ai\Rules\Spec;

use App\Ai\Rules\Violation;
use App\Enums\EnvKey;
use App\Support\Primitives\Environments;
use App\Support\Primitives\Playwright;
use App\Support\Primitives\Url;

/** Nenhuma URL absoluta no arquivo: toda navegação sai da variável do ambiente. */
final class Scheme
{
    private const ABSOLUTE = '#https?://#';

    /** @return list<Violation> */
    public static function check(Playwright $playwright, Url $base, Environments $environments): array
    {
        if (! $playwright->matches(self::ABSOLUTE)) {
            return [];
        }

        return [new Violation(
            'url-absoluta',
            'O arquivo monta uma URL absoluta. Toda navegação sai de process.env.'.EnvKey::URL->value
                .', inclusive a primeira. Sistema com SSO redireciona sozinho para a tela de login e traz o '
                .'callback de volta; abrir o host do SSO direto perde esse retorno e a sessão não se forma.',
        )];
    }
}
