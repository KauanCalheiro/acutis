<?php

namespace App\Action;

use App\Data\V1\Auth\AuthRecordingData;
use App\Data\V1\Auth\GeneratedAuthSetupData;
use App\Enums\EnvKey;
use App\Support\Project;
use App\Support\Recording;
use App\Support\Scenario;
use Illuminate\Support\Facades\File;
use Lorisleiva\Actions\Concerns\AsAction;

class WriteAuthRecordingToProject
{
    use AsAction;

    /**
     * Converte o login gravado num auth.setup.ts e deixa o projeto pronto para executá-lo.
     * Não executa nada: quem chamou roda o setup pelo mesmo streaming dos cenários, e é essa
     * execução que decide se a autenticação está configurada ou falhando.
     */
    public function handle(string $slug, AuthRecordingData $data): GeneratedAuthSetupData
    {
        $project = Project::make($slug);
        $path = $project->path();
        $auth = $project->auth();

        $authSetup = GenerateAuthSetupFromRecording::run($data);
        $recording = Recording::make($data->events);
        $credentials = $recording->credentials();

        $auth->ensureConfig();
        File::put("{$path}/".Scenario::AUTH_SPEC, $authSetup."\n");
        File::put(
            "{$path}/".Scenario::eventsPathOf(Scenario::AUTH_SPEC),
            json_encode($recording->withoutPasswords(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        );

        if (! $credentials) {
            return new GeneratedAuthSetupData(authSetup: $authSetup, credentialsNeeded: true);
        }

        $env = $project->env();

        $env->set(EnvKey::AUTH_USER, $credentials->username);
        $env->set(EnvKey::AUTH_PASSWORD, $credentials->password);

        return new GeneratedAuthSetupData(authSetup: $authSetup, credentialsNeeded: false);
    }
}
