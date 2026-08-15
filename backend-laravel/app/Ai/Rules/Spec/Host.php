<?php

namespace App\Ai\Rules\Spec;

use App\Ai\Rules\Violation;
use App\Enums\EnvKey;
use App\Support\Primitives\Environments;
use App\Support\Primitives\Playwright;
use App\Support\Primitives\Url;

/** O host do sistema nunca vai literal no arquivo: a URL se monta a partir da variável. */
final class Host
{
    /** @return list<Violation> */
    public static function check(Playwright $playwright, Url $base, Environments $environments): array
    {
        if (! $playwright->has($base->host())) {
            return [];
        }

        return [new Violation(
            'host-literal',
            "O host {$base->host()} está escrito no arquivo; monte a URL a partir de process.env.".EnvKey::URL->value.'.',
        )];
    }
}
