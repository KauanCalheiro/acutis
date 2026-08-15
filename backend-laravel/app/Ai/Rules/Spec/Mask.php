<?php

namespace App\Ai\Rules\Spec;

use App\Ai\Rules\Violation;
use App\Support\Primitives\Environments;
use App\Support\Primitives\Playwright;
use App\Support\Primitives\Url;
use App\Support\Recording;

/** A máscara copiada para o arquivo digitaria bolinhas no campo em vez do valor real. */
final class Mask
{
    /** @return list<Violation> */
    public static function check(Playwright $playwright, Url $base, Environments $environments): array
    {
        if (! $playwright->has(Recording::MASK)) {
            return [];
        }

        return [new Violation(
            'mascara-no-spec',
            'A máscara '.Recording::MASK.' foi copiada para o arquivo; o valor vem de process.env.<CHAVE>.',
        )];
    }
}
