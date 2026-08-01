<?php

namespace App\Action;

use App\Data\V1\Project\ProjectSettingsData;
use App\Enums\EnvKey;
use App\Support\Project;
use Lorisleiva\Actions\Concerns\AsAction;

class UpdateProjectSettings
{
    use AsAction;

    /**
     * A URL base vive no .env do projeto: o playwright.config.ts já a lê de process.env.BASE_URL e
     * o runner já carrega o .env antes de executar. É config de ambiente (homolog ≠ produção), por
     * isso não é versionada.
     */
    public function handle(string $slug, ProjectSettingsData $data): string
    {
        Project::make($slug)->env()->set(EnvKey::BASE_URL, $data->baseUrl);

        return $data->baseUrl;
    }
}
