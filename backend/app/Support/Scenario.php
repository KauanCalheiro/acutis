<?php

namespace App\Support;

use App\Action\ListProjectScenarios;
use App\Data\V1\Project\ScenarioData;
use Illuminate\Support\Facades\File;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

final class Scenario
{
    private const RUNNER_WRAPPER_IMPORT = '/(from\s+[\'"])(?:\.\.?\/)+acutis-run([\'"])/';

    /** Conteúdo do spec como o usuário escreveu — sem o wrapper que o runner injeta. */
    public static function source(string $file): string
    {
        return preg_replace(self::RUNNER_WRAPPER_IMPORT, '${1}@playwright/test${2}', File::get($file));
    }

    /** Cenário do projeto pelo id (spec sem "tests/" nem ".spec.ts"); 404 se não existir. */
    public static function find(string $path, string $scenarioId): ScenarioData
    {
        $specRelative = "tests/{$scenarioId}.spec.ts";

        $scenario = collect(ListProjectScenarios::run($path))
            ->first(fn (ScenarioData $candidate): bool => $candidate->spec === $specRelative);

        if (! $scenario) {
            throw new NotFoundHttpException('Cenário não encontrado.');
        }

        return $scenario;
    }
}
