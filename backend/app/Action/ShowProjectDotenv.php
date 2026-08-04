<?php

namespace App\Action;

use App\Data\V1\Project\EnvironmentVarData;
use App\Enums\EnvKey;
use App\Support\Project;
use Lorisleiva\Actions\Concerns\AsAction;

class ShowProjectDotenv
{
    use AsAction;

    /** @return list<EnvironmentVarData> */
    public function handle(string $slug): array
    {
        $project = Project::make($slug);
        $values = $project->env()->all();
        $secretKeys = $project->environments()->secretKeys();

        unset($values[EnvKey::ACTIVE_ENVIRONMENT->value]);

        $vars = [];

        foreach ($values as $key => $value) {
            $secret = in_array($key, $secretKeys, true);

            $vars[] = new EnvironmentVarData(
                key: $key,
                value: $secret ? null : $value,
                secret: $secret,
                pending: blank($value),
            );
        }

        foreach (array_diff($secretKeys, array_keys($values)) as $key) {
            $vars[] = new EnvironmentVarData($key, secret: true, pending: true);
        }

        return $vars;
    }
}
