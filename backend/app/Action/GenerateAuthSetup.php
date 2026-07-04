<?php

namespace App\Action;

use App\Ai\Agents\AuthSetupWriter;
use App\Ai\Tools\CaptureSnapshot;
use App\Ai\Tools\RunPlaywrightTest;
use App\Ai\StructuredOutput;
use App\Data\V1\Auth\AuthSetupData;
use App\Data\V1\Auth\GeneratedAuthSetupData;
use App\Data\V1\Recording\TestRunData;
use Lorisleiva\Actions\Concerns\AsAction;

class GenerateAuthSetup
{
    use AsAction;

    private const MAX_RUN_ATTEMPTS = 3;

    public function handle(AuthSetupData $input): GeneratedAuthSetupData
    {
        $snapshot = app(CaptureSnapshot::class)->capture($input->loginUrl);

        $authSetup = StructuredOutput::field(app(AuthSetupWriter::class)->prompt(
            "URL de login: {$input->loginUrl}\n\nSnapshot da página de login:\n{$snapshot}",
        ), 'authSetup');

        $env = ['AUTH_USER' => $input->username, 'AUTH_PASSWORD' => $input->password];
        $attempts = 0;

        while (true) {
            $attempts++;

            $result = app(RunPlaywrightTest::class)->run($authSetup, $input->executionUrl, $env);

            if ($result->passed) {
                return new GeneratedAuthSetupData(
                    authSetup: $authSetup,
                    storageCaptured: $result->storageState !== null,
                    testRun: new TestRunData(executed: true, passed: true, attempts: $attempts),
                );
            }

            if ($attempts >= self::MAX_RUN_ATTEMPTS) {
                return new GeneratedAuthSetupData(
                    authSetup: $authSetup,
                    storageCaptured: false,
                    testRun: new TestRunData(
                        executed: true,
                        passed: false,
                        attempts: $attempts,
                        error: $result->output,
                    ),
                );
            }

            $authSetup = StructuredOutput::field(app(AuthSetupWriter::class)->prompt(
                "O setup de autenticação abaixo falhou ao executar. Corrija-o."
                    ."\n\nURL de login: {$input->loginUrl}"
                    ."\n\nErro da execução:\n{$result->output}"
                    ."\n\nSetup com falha:\n{$authSetup}"
                    ."\n\nSnapshot da página de login:\n{$snapshot}",
            ), 'authSetup');
        }
    }
}
