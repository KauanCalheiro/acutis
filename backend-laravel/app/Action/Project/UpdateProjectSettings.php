<?php

namespace App\Action\Project;

use App\Data\V1\Project\ProjectSettingsData;
use App\Enums\EnvKey;
use App\Support\Project;
use Lorisleiva\Actions\Concerns\AsAction;

class UpdateProjectSettings
{
    use AsAction;

    public function handle(string $slug, ProjectSettingsData $data): string
    {
        Project::make($slug)->environments()->set(EnvKey::URL, $data->baseUrl);

        return $data->baseUrl;
    }
}
