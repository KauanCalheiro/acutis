<?php

namespace App\Action;

use App\Data\V1\Auth\AuthRecordingData;
use App\Data\V1\Auth\AuthSetupData;
use App\Data\V1\Auth\GeneratedAuthSetupData;
use App\Support\AuthProjectFiles;
use App\Support\Project;
use App\Support\RecordingCredentials;
use Illuminate\Support\Facades\File;
use Lorisleiva\Actions\Concerns\AsAction;

class WriteAuthRecordingToProject
{
    use AsAction;

    public function handle(string $slug, AuthRecordingData $data): GeneratedAuthSetupData
    {
        $path = Project::path($slug);

        $generated = GenerateAuthSetupFromRecording::run($data);

        AuthProjectFiles::writeConfig($path, $data->executionUrl ?? $data->baseUrl);
        File::put("{$path}/tests/auth.setup.ts", $generated->authSetup."\n");
        AuthProjectFiles::ensureGitignore($path);

        if ($generated->storageCaptured) {
            File::put("{$path}/storage-state.json", json_encode($generated->storageState));

            return $generated;
        }

        return $this->verifyWithRecordedCredentials($path, $data, $generated);
    }

    /**
     * Sem sessão ao vivo capturada, tenta a segunda estratégia: extrai usuário/senha reais dos
     * eventos gravados e realmente executa o script gerado, autocorrigindo em background se falhar
     * (mesmo loop de GenerateAuthSetup, usado aqui pra validar um script já escrito, não gerar um novo).
     */
    private function verifyWithRecordedCredentials(string $path, AuthRecordingData $data, GeneratedAuthSetupData $generated): GeneratedAuthSetupData
    {
        $credentials = RecordingCredentials::extract($data->events);

        if (! $credentials->username || ! $credentials->password) {
            return $generated;
        }

        File::put("{$path}/.env", "AUTH_USER={$credentials->username}\nAUTH_PASSWORD={$credentials->password}\n");
        AuthProjectFiles::writeEnvExample($path);

        $input = new AuthSetupData(
            loginUrl: $credentials->loginUrl ?? $data->baseUrl,
            username: $credentials->username,
            password: $credentials->password,
            executionUrl: $data->executionUrl ?? $data->baseUrl,
        );

        $verified = app(GenerateAuthSetup::class)->verify($input, $generated->authSetup);

        if (! $verified->testRun?->passed) {
            dispatch(function () use ($path, $input, $verified): void {
                $retried = app(GenerateAuthSetup::class)->retry($input, $verified);

                if ($retried->testRun?->passed) {
                    File::put("{$path}/tests/auth.setup.ts", $retried->authSetup."\n");
                }
            })->afterResponse();
        }

        return new GeneratedAuthSetupData(
            authSetup: $generated->authSetup,
            storageCaptured: $verified->storageCaptured,
            testRun: $verified->testRun,
        );
    }
}
