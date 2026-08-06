<?php

namespace App\Ai\Rules\Spec;

use App\Ai\Rules\Violation;
use App\Support\Primitives\Environments;
use App\Support\Primitives\Playwright;
use App\Support\Primitives\Url;

/** Sem await o passo roda em paralelo com o resto do teste e a execução quebra. */
final class StepAwait
{
    /** @return list<Violation> */
    public static function check(Playwright $playwright, Url $base, Environments $environments): array
    {
        // Captura o await de cada step, ou vazio quando não há: é o vazio que acusa.
        preg_match_all(
            '/(?:^|[^\w.])((?:await\s+)?)(?:test|setup)\.step\s*\(/m',
            $playwright->value,
            $matches,
        );

        if (! in_array('', $matches[1], true)) {
            return [];
        }

        return [new Violation(
            'step-sem-await',
            'test.step sem await; sem ele o passo roda em paralelo e a execução quebra.',
        )];
    }
}
