<?php

namespace App\Data\V1\Project;

use Spatie\LaravelData\Data;

class FixedSpecData extends Data
{
    public function __construct(
        public string $playwright,
        public string $summary,
    ) {}
}
