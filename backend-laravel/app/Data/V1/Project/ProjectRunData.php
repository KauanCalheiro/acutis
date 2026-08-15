<?php

namespace App\Data\V1\Project;

use Spatie\LaravelData\Data;

class ProjectRunData extends Data
{
    public function __construct(
        public bool $passed,
        public string $output,
    ) {}
}
