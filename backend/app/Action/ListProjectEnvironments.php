<?php

namespace App\Action;

use App\Data\V1\Project\EnvironmentVarData;
use App\Support\Project;
use Lorisleiva\Actions\Concerns\AsAction;

class ListProjectEnvironments
{
    use AsAction;

    public function handle(string $slug): array
    {
        $project = Project::make($slug);
        $environments = $project->environments()->ensure();
        $environmentKeys = [];

        foreach ($environments->all() as $environment) {
            $environmentKeys = array_merge(
                $environmentKeys,
                array_map(fn (EnvironmentVarData $var): string => $var->key, $environment['vars']),
            );
        }

        return [
            'active' => $environments->activeSlug(),
            'environments' => $environments->displayedAll(),
            'known_keys' => array_values(array_unique(array_merge(
                $project->env()->exampleKeys(),
                $environmentKeys,
            ))),
        ];
    }
}
