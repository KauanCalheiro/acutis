<?php

namespace App\Data\V1\Project;

use Spatie\LaravelData\Data;

class ScenarioRunData extends Data
{
    /** @param  list<array{title: string, status: string, duration_ms: int, error: ?string}>  $steps */
    public function __construct(
        public string $startedAt,
        public int $durationMs,
        public bool $passed,
        public ?string $branch,
        public ?string $author,
        public array $steps,
        public string $playwright,
        public ?string $videoPath,
    ) {}
}
