<?php

namespace App\Support;

use Illuminate\Support\Str;

final class ScenarioRuns
{
    public const VIDEO = 'last.webm';

    public const KEPT = 20;

    public static function scenarioId(string $spec): string
    {
        return Str::of($spec)->after('tests/')->before('.spec.ts')->toString();
    }

    public static function directory(string $path, string $scenarioId): string
    {
        return "{$path}/runs/{$scenarioId}";
    }
}
