<?php

namespace App\Action;

use App\Data\V1\Project\ScenarioShowData;
use App\Support\Project;
use App\Support\Scenario;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\File;
use Lorisleiva\Actions\Concerns\AsAction;

class ShowProjectScenario
{
    use AsAction;

    public function handle(string $slug, string $scenarioId): ScenarioShowData
    {
        $project = Project::make($slug);
        $path = $project->path();
        $scenario = $project->scenario($scenarioId);
        $data = $scenario->data();

        $spec = "{$path}/{$data->spec}";
        $feature = $data->feature ? "{$path}/{$data->feature}" : null;
        $eventsFile = "{$path}/".Scenario::eventsPathOf($data->spec);

        // O cenário de autenticação existe antes do arquivo: é a tela dele que oferece a gravação.
        $written = File::exists($spec);

        return new ScenarioShowData(
            title: $data->title,
            spec: $data->spec,
            feature: $data->feature,
            tags: $data->tags,
            domain: $data->domain,
            playwright: $written ? Scenario::sourceOf($spec) : '',
            gherkin: $feature ? File::get($feature) : null,
            events: File::exists($eventsFile) ? json_decode(File::get($eventsFile), true) : [],
            updatedAt: ($written ? Carbon::createFromTimestamp(File::lastModified($spec)) : Carbon::now())->toIso8601String(),
            runs: ListScenarioRuns::run($path, $scenarioId),
            isAuth: $scenario->isAuth(),
        );
    }
}
