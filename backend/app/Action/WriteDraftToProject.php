<?php

namespace App\Action;

use App\Data\V1\Recording\ProjectTestData;
use App\Data\V1\Recording\WriteTestData;
use App\Support\Primitives\Environments;
use App\Support\Project;
use App\Support\Recording;
use App\Support\TestArtifact;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Lorisleiva\Actions\Concerns\AsAction;

class WriteDraftToProject
{
    use AsAction;

    public function handle(string $slug, WriteTestData $data): ProjectTestData
    {
        $path = Project::make($slug)->path();
        $domain = Str::slug($data->domain) ?: 'outros';

        $name = TestArtifact::uniquePath("{$path}/tests/{$domain}", Str::slug($data->path) ?: 'teste');
        $spec = "tests/{$domain}/{$name}.spec.ts";
        $feature = "features/{$domain}/{$name}.feature";

        $gherkin = TestArtifact::stampGherkinTags(
            TestArtifact::stampTitle($data->gherkin, $data->title),
            $data->tags,
        );
        $playwright = TestArtifact::stampPlaywrightTags($data->playwright, $data->tags);

        File::ensureDirectoryExists("{$path}/tests/{$domain}");
        File::ensureDirectoryExists("{$path}/features/{$domain}");
        File::put("{$path}/{$spec}", $playwright."\n");
        File::put("{$path}/{$feature}", $gherkin."\n");

        if ($data->events !== null) {
            $recording = Recording::make($data->events);
            $environments = new Environments(Project::make($slug)->environments()->activeVars());

            $names = $this->markedNames($data->envVars);

            if ($warning = $recording->unmatchedEnvWarning($names)) {
                Log::warning($warning);
            }

            $envValues = $recording->envValues($names);

            if ($envValues !== []) {
                Project::make($slug)->environments()->merge($envValues);
            }

            File::put(
                "{$path}/tests/{$domain}/{$name}.events.json",
                json_encode($recording->redacted($environments), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            );
        }

        return new ProjectTestData(
            gherkin: $gherkin,
            playwright: $playwright,
            spec: $spec,
            feature: $feature,
        );
    }

    /**
     * Os nomes que a IA escolheu chegam pelo rascunho na ordem dos marcadores, porque é assim que
     * o contrato HTTP os carrega. Aqui voltam a ser mapa, que é o que resolve o valor por chave.
     *
     * @param  list<string>  $envVars
     * @return array<string, string>
     */
    private function markedNames(array $envVars): array
    {
        $names = [];

        foreach (array_values($envVars) as $position => $name) {
            $names[Recording::SENSITIVE.($position + 1)] = $name;
        }

        return $names;
    }
}
