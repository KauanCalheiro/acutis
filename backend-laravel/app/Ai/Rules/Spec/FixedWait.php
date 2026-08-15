<?php

namespace App\Ai\Rules\Spec;

use App\Ai\Rules\Violation;
use App\Support\Primitives\Environments;
use App\Support\Primitives\Playwright;
use App\Support\Primitives\Url;

/** Espera de tempo fixo passa na máquina rápida e falha na lenta; espere a condição. */
final class FixedWait
{
    /** @return list<Violation> */
    public static function check(Playwright $playwright, Url $base, Environments $environments): array
    {
        if (! $playwright->matches('/waitForTimeout|setTimeout/')) {
            return [];
        }

        return [new Violation(
            'espera-fixa',
            'Espera de tempo fixo; espere uma condição, com expect(...).toBeVisible() ou waitForURL.',
        )];
    }
}
