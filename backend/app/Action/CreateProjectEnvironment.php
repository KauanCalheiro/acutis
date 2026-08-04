<?php

namespace App\Action;

use App\Data\V1\Project\EnvironmentVarData;
use App\Enums\EnvKey;
use App\Support\Project;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Lorisleiva\Actions\Concerns\AsAction;

class CreateProjectEnvironment
{
    use AsAction;

    public function handle(string $slug, string $name): array
    {
        $project = Project::make($slug);
        $environments = $project->environments();
        $environmentSlug = Str::slug($name);

        if (filled($environments->find($environmentSlug))) {
            throw ValidationException::withMessages(['name' => 'Já existe um ambiente com esse nome.']);
        }

        $first = blank($environments->all());

        $environments->put($environmentSlug, $name, $first ? $this->seededFrom($project) : []);

        if ($first) {
            $environments->activate($environmentSlug);
        }

        return $environments->masked($environmentSlug);
    }

    /** @return list<EnvironmentVarData> */
    private function seededFrom(Project $project): array
    {
        $dotenv = $project->env()->all();
        $vars = [];

        foreach ([EnvKey::BASE_URL, EnvKey::AUTH_USER] as $key) {
            if (filled($dotenv[$key->value] ?? null)) {
                $vars[] = new EnvironmentVarData($key->value, $dotenv[$key->value]);
            }
        }

        if (filled($dotenv[EnvKey::AUTH_PASSWORD->value] ?? null)) {
            $vars[] = new EnvironmentVarData(
                key: EnvKey::AUTH_PASSWORD->value,
                value: EnvironmentVarData::pointerTo(EnvKey::AUTH_PASSWORD->value),
                secret: true,
            );
        }

        return $vars;
    }
}
