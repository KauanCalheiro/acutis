<?php

namespace App\Ai\Rules\Spec;

use App\Ai\Rules\Violation;
use App\Support\Primitives\Environments;
use App\Support\Primitives\Playwright;
use App\Support\Primitives\Url;

/** O projeto gerado só tem o Playwright instalado; qualquer outro import quebra na execução. */
final class ForeignImport
{
    /** @var list<string> */
    private const ALLOWED = ['@playwright/test'];

    /** @return list<Violation> */
    public static function check(Playwright $playwright, Url $base, Environments $environments): array
    {
        $foreign = array_values(array_filter(
            $playwright->imports(),
            fn (string $from): bool => ! in_array($from, self::ALLOWED, true),
        ));

        if ($foreign === []) {
            return [];
        }

        return [new Violation(
            'import-externo',
            'Import de '.implode(', ', $foreign).'; importe apenas de '.implode(', ', self::ALLOWED).'.',
        )];
    }
}
