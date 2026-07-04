<?php

namespace App\Ai\Tools;

final class PlaywrightRunResult
{
    public function __construct(
        public readonly bool $passed,
        public readonly string $output,
        public readonly mixed $storageState = null,
    ) {}
}
