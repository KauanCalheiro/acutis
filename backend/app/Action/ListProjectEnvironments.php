<?php

namespace App\Action;

use App\Data\V1\Project\EnvironmentVarData;
use App\Enums\EnvKey;
use App\Support\Project;
use Lorisleiva\Actions\Concerns\AsAction;

class ListProjectEnvironments
{
    use AsAction;

    public function handle(string $slug): array
    {
        $project = Project::make($slug);
        $environments = $project->environments();
        $dotenvKeys = array_values(array_diff(
            array_keys($project->env()->all()),
            [EnvKey::ACTIVE_ENVIRONMENT->value],
        ));

        $environmentKeys = [];

        foreach ($environments->all() as $environment) {
            $environmentKeys = array_merge(
                $environmentKeys,
                array_map(fn (EnvironmentVarData $var): string => $var->key, $environment['vars']),
            );
        }

        return [
            'active' => $environments->activeSlug(),
            'environments' => $environments->maskedAll(),
            'known_keys' => array_values(array_unique(array_merge(
                $dotenvKeys,
                $project->env()->exampleKeys(),
                $environmentKeys,
            ))),
            'dotenv_keys' => $dotenvKeys,
        ];
    }
}
