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
            $captured = $this->hasSession($result->storageState);

            if ($result->passed && $captured) {
                return new GeneratedAuthSetupData(
                    authSetup: $authSetup,
                    storageCaptured: true,
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
                        error: $result->passed
                            ? 'O login executou sem erro mas nenhum estado de sessão (cookie ou localStorage) foi capturado.'
                            : $result->output,
                    ),
                );
            }

            $feedback = $result->passed
                ? 'O teste passou mas nenhum cookie ou localStorage de sessão foi salvo — o login provavelmente não ocorreu. '
                    .'Não use page.context().storageState como checagem de existência nem retorne cedo: esse método sempre grava, mesmo sem login. '
                    .'Execute o login completo e só então salve o estado.'
                : $this->executionFeedback($result->output);

            $authSetup = StructuredOutput::field(app(AuthSetupWriter::class)->prompt(
                "O setup de autenticação abaixo não autenticou. Corrija-o."
                    ."\n\nURL de login: {$input->loginUrl}"
                    ."\n\n{$feedback}"
                    ."\n\nSetup com falha:\n{$authSetup}"
                    ."\n\nSnapshot da página de login:\n{$snapshot}",
            ), 'authSetup');
        }
    }

    private function executionFeedback(string $output): string
    {
        $feedback = "Erro da execução:\n{$output}";

        if (str_contains($output, 'strict mode violation')) {
            $feedback .= "\n\nO seletor usado bateu em mais de um elemento (strict mode violation) — o erro acima lista cada elemento "
                .'encontrado com seu texto. Não corrija com .first() ou :nth-child (frágil, quebra se a ordem mudar). Em vez disso, '
                .'identifique qual dos elementos listados é o certo e escreva getByRole(\'button\', { name: \'<texto exato>\', exact: true }), '
                .'ou use um seletor mais específico do snapshot (id, data-test) que não bata em outros elementos da página.';
        }

        return $feedback;
    }

    private function hasSession(mixed $state): bool
    {
        if (! is_array($state)) {
            return false;
        }

        if (! empty($state['cookies'])) {
            return true;
        }

        foreach ($state['origins'] ?? [] as $origin) {
            if (! empty($origin['localStorage'])) {
                return true;
            }
        }

        return false;
    }
}
