<?php

namespace App\Action;

use App\Data\V1\Project\EnvironmentData;
use App\Data\V1\Project\EnvironmentVarData;
use App\Support\Project;
use Lorisleiva\Actions\Concerns\AsAction;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class UpdateProjectEnvironment
{
    use AsAction;

    public function handle(string $slug, string $environmentSlug, EnvironmentData $data): array
    {
        $project = Project::make($slug);
        $environments = $project->environments();
        $current = $environments->find($environmentSlug);

        if (blank($current)) {
            throw new NotFoundHttpException('Ambiente não encontrado.');
        }

        $vars = array_map(
            fn (EnvironmentVarData $var): EnvironmentVarData => new EnvironmentVarData(
                key: $var->key,
                value: $var->value ?? '',
                secret: $var->secret,
            ),
            $data->vars,
        );

        $environments->put($environmentSlug, $data->name, $vars)->ensure()->alignTo($environmentSlug);

        return $environments->displayed($environmentSlug);
    }
}
