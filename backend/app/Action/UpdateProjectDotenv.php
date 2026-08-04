<?php

namespace App\Action;

use App\Data\V1\Project\DotenvData;
use App\Data\V1\Project\EnvironmentVarData;
use App\Enums\EnvKey;
use App\Support\Project;
use Lorisleiva\Actions\Concerns\AsAction;

class UpdateProjectDotenv
{
    use AsAction;

    /** @return list<EnvironmentVarData> */
    public function handle(string $slug, DotenvData $data): array
    {
        $project = Project::make($slug);
        $env = $project->env();
        $existing = $env->all();
        $secretKeys = $project->environments()->secretKeys();

        $values = [];

        foreach ($data->vars as $var) {
            $keepsStoredSecret = blank($var->value)
                && in_array($var->key, $secretKeys, true)
                && filled($existing[$var->key] ?? null);

            if (! $keepsStoredSecret) {
                $values[$var->key] = $var->value ?? '';
            }
        }

        $env->merge($values);
        $env->remove(array_values(array_diff(
            array_keys($existing),
            array_map(fn (EnvironmentVarData $var): string => $var->key, $data->vars),
            [EnvKey::ACTIVE_ENVIRONMENT->value],
        )));

        return ShowProjectDotenv::run($slug);
    }
}
