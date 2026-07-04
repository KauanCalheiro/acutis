<?php

namespace App\Data\V1\Recording;

use Spatie\LaravelData\Data;

class GeneratedTestsData extends Data
{
    public function __construct(
        public string $gherkin,
        public string $playwright,
        public ?TestRunData $testRun = null,
    ) {}
}
