<?php

namespace App\Action;

use App\Ai\Agents\GherkinWriter;
use App\Ai\StructuredOutput;
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

        $this->writeFeature($path, $data, $recording);

        $environments = $project->environments()->ensure();

        if (! $credentials) {
            return new GeneratedAuthSetupData(authSetup: $authSetup, credentialsNeeded: true);
        }

        $environments->set(EnvKey::USER, $credentials->username);
        $environments->set(EnvKey::PASSWORD, $credentials->password, secret: true);

        return new GeneratedAuthSetupData(authSetup: $authSetup, credentialsNeeded: false);
    }

    /**
     * O login também é um cenário, então ganha o Gherkin dos outros — no caminho fixo do auth,
     * porque é o título dele que a tela mostra e o domínio sugerido não move o arquivo.
     */
    private function writeFeature(string $path, AuthRecordingData $data, Recording $recording): void
    {
        $events = json_encode(
            $recording->withoutPasswords(),
            JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
        );

        $gherkin = StructuredOutput::field(
            app(GherkinWriter::class)->prompt("URL base: {$data->baseUrl}\n\nEventos gravados:\n{$events}"),
            'gherkin',
        );

        File::ensureDirectoryExists(dirname("{$path}/".Scenario::AUTH_FEATURE));
        File::put("{$path}/".Scenario::AUTH_FEATURE, $gherkin."\n");
    }
}
