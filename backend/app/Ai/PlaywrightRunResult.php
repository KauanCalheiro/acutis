<?php

namespace App\Ai;

final class PlaywrightRunResult
{
    public function __construct(
        public readonly bool $passed,
        public readonly string $output,
        public readonly mixed $storageState = null,
        /** O HTML da página no instante da falha, capturado de dentro da própria execução. */
        public readonly ?string $html = null,
    ) {}
}
