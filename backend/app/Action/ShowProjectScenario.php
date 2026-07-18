<?php

namespace App\Action;

use App\Data\V1\Project\ScenarioData;
use App\Data\V1\Project\ScenarioShowData;
use App\Support\Project;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Lorisleiva\Actions\Concerns\AsAction;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class ShowProjectScenario
{
    use AsAction;

    public function handle(string $slug, string $scenarioId): ScenarioShowData
    {
        $path = Project::path($slug);
        $specRelative = "tests/{$scenarioId}.spec.ts";

        /** @var ScenarioData|null $scenario */
        $scenario = collect(ListProjectScenarios::run($path))
            ->first(fn (ScenarioData $candidate): bool => $candidate->spec === $specRelative);

        if (! $scenario) {
            throw new NotFoundHttpException('Cenário não encontrado.');
        }

        $spec = "{$path}/{$scenario->spec}";
        $feature = $scenario->feature ? "{$path}/{$scenario->feature}" : null;
        $eventsFile = Str::replaceLast('.spec.ts', '.events.json', $spec);

        return new ScenarioShowData(
            title: $scenario->title,
            spec: $scenario->spec,
            feature: $scenario->feature,
            tags: $scenario->tags,
            domain: $scenario->domain,
            playwright: File::get($spec),
            gherkin: $feature ? File::get($feature) : null,
            events: File::exists($eventsFile) ? json_decode(File::get($eventsFile), true) : [],
            updatedAt: Carbon::createFromTimestamp(File::lastModified($spec))->toIso8601String(),
        );
    }
}
