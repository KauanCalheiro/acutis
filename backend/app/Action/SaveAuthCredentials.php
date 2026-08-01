<?php

namespace App\Action;

use App\Data\V1\Auth\AuthCredentialsData;
use App\Enums\EnvKey;
use App\Support\Project;
use Lorisleiva\Actions\Concerns\AsAction;

class SaveAuthCredentials
{
    use AsAction;

    public function handle(string $slug, AuthCredentialsData $data): void
    {
        $env = Project::make($slug)->env();

        $env->set(EnvKey::AUTH_USER, $data->username);
        $env->set(EnvKey::AUTH_PASSWORD, $data->password);
    }
}
