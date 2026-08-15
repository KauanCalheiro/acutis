<?php

namespace App\Data\V1\Recording;

use Spatie\LaravelData\Data;

class ProjectTestData extends Data
{
    public function __construct(
        public ?string $gherkin,
        public string $playwright,
        public string $spec,
        public ?string $feature,
        public ?TestRunData $testRun = null,
    ) {}
}
