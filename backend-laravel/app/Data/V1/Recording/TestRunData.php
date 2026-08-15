<?php

namespace App\Data\V1\Recording;

use Spatie\LaravelData\Data;

class TestRunData extends Data
{
    public function __construct(
        public bool $executed,
        public bool $passed,
        public int $attempts,
        public ?string $error = null,
    ) {}
}
