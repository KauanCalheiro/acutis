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
        $environments = Project::make($slug)->environments();

        $environments->set(EnvKey::AUTH_USER, $data->username);
        $environments->set(EnvKey::AUTH_PASSWORD, $data->password, secret: true);
    }
}
