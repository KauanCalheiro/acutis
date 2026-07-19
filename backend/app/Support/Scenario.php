<?php

namespace App\Support;

use App\Action\ListProjectScenarios;
use App\Data\V1\Project\ScenarioData;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

final class Scenario
{
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
