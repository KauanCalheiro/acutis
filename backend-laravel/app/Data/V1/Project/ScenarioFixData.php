<?php

namespace App\Data\V1\Project;

use Spatie\LaravelData\Data;

class ScenarioFixData extends Data
{
    public function __construct(
        public string $step,
        public string $error,
    ) {}

    public static function rules(): array
    {
        return [
            'step' => ['required', 'string'],
            'error' => ['required', 'string'],
        ];
    }
}
