<?php

namespace App\Action\Scenario;

use App\Data\V1\Project\ScenarioShowData;
use App\Data\V1\Project\UpdateScenarioData;
use App\Support\Project;
use App\Support\Scenario;
use App\Support\TestArtifact;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Lorisleiva\Actions\Concerns\AsAction;

class UpdateProjectScenario
{
    use AsAction;

    /**
     * O setup de autenticação mora num caminho fixo, então segue lá mesmo quando o título muda:
     * renomeá-lo pelo título quebraria a execução, que o procura pelo caminho.
     */
    public function handle(string $slug, string $scenarioId, UpdateScenarioData $data): ScenarioShowData
    {
        $project = Project::make($slug);
        $path = $project->path();
        $auth = $project->scenario($scenarioId)->isAuth();
        $scenario = $project->scenario($scenarioId)->data();

        $domain = Str::slug($data->domain ?? '') ?: null;
        $name = Str::slug($data->path) ?: 'teste';

        $newSpecRelative = match (true) {
            $auth => Scenario::AUTH_SPEC,
            (bool) $domain => "tests/{$domain}/{$name}.spec.ts",
            default => "tests/{$name}.spec.ts",
        };
        $newFeatureRelative = match (true) {
            $auth => Scenario::AUTH_FEATURE,
            (bool) $domain => "features/{$domain}/{$name}.feature",
            default => "features/{$name}.feature",
        };

        if ($newSpecRelative !== $scenario->spec && File::exists("{$path}/{$newSpecRelative}")) {
            throw ValidationException::withMessages([
                'path' => 'Já existe um cenário com este nome neste domínio.',
            ]);
        }

        // Campo em branco é ordem de apagar: a tela devolve o Gherkin guardado, e mantê-lo faria a
        // aba voltar com o texto que o usuário acabou de limpar.
        $gherkin = blank($data->gherkin) ? null : TestArtifact::stampGherkinTags(
            TestArtifact::stampTitle($data->gherkin, $data->title),
            $data->tags,
        );
        $playwright = TestArtifact::stampPlaywrightTags(
            TestArtifact::stampPlaywrightTitle($data->playwright, $data->title),
            $data->tags,
        );

        File::ensureDirectoryExists(dirname("{$path}/{$newSpecRelative}"));
        File::put("{$path}/{$newSpecRelative}", $playwright."\n");

        if ($gherkin === null) {
            File::delete("{$path}/{$newFeatureRelative}");
        } else {
            File::ensureDirectoryExists(dirname("{$path}/{$newFeatureRelative}"));
            File::put("{$path}/{$newFeatureRelative}", $gherkin."\n");
        }

        if ($newSpecRelative !== $scenario->spec) {
            File::delete("{$path}/{$scenario->spec}");

            if ($scenario->feature) {
                File::delete("{$path}/{$scenario->feature}");
            }

            $oldEvents = Str::replaceLast('.spec.ts', '.events.json', "{$path}/{$scenario->spec}");

            if (File::exists($oldEvents)) {
                File::move($oldEvents, Str::replaceLast('.spec.ts', '.events.json', "{$path}/{$newSpecRelative}"));
            }
        }

        $newScenarioId = match (true) {
            $auth => Scenario::AUTH_ID,
            (bool) $domain => "{$domain}/{$name}",
            default => $name,
        };

        return ShowProjectScenario::run($slug, $newScenarioId);
    }
}
