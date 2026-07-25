<?php

namespace App\Action;

use App\Data\V1\Project\ScenarioShowData;
use App\Support\Project;
use App\Support\Scenario;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Lorisleiva\Actions\Concerns\AsAction;

class ShowProjectScenario
{
    use AsAction;

    public function handle(string $slug, string $scenarioId): ScenarioShowData
    {
        $path = Project::path($slug);
        $scenario = Scenario::find($path, $scenarioId);

        $spec = "{$path}/{$scenario->spec}";
        $feature = $scenario->feature ? "{$path}/{$scenario->feature}" : null;
        $eventsFile = Str::replaceLast('.spec.ts', '.events.json', $spec);

        return new ScenarioShowData(
            title: $scenario->title,
            spec: $scenario->spec,
            feature: $scenario->feature,
            tags: $scenario->tags,
            domain: $scenario->domain,
            playwright: Scenario::source($spec),
            gherkin: $feature ? File::get($feature) : null,
            events: File::exists($eventsFile) ? json_decode(File::get($eventsFile), true) : [],
            updatedAt: Carbon::createFromTimestamp(File::lastModified($spec))->toIso8601String(),
        );
    }
}
