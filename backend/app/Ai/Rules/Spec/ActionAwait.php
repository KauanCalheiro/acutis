<?php

namespace App\Ai\Rules\Spec;

use App\Ai\Rules\Violation;
use App\Support\Primitives\Environments;
use App\Support\Primitives\Playwright;
use App\Support\Primitives\Url;

/** Ação de página sem await segue o teste adiante antes da página responder. */
final class ActionAwait
{
    private const ASYNC = 'goto|click|dblclick|fill|press|check|uncheck|selectOption|hover|setInputFiles|waitForURL|waitForSelector|waitForLoadState|storageState|screenshot';

    /** @return list<Violation> */
    public static function check(Playwright $playwright, Url $base, Environments $environments): array
    {
        // ponytail: checagem por linha; ação quebrada em várias linhas escapa, e aí só a execução real pega
        foreach ($playwright->lines() as $line) {
            if (preg_match('/\.(?:'.self::ASYNC.')\s*\(/', $line) === 1 && ! str_contains($line, 'await')) {
                return [new Violation('acao-sem-await', 'Ação assíncrona sem await: '.trim($line))];
            }
        }

        return [];
    }
}
