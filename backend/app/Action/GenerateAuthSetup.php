<?php

namespace App\Action;

use App\Ai\Agents\AuthSetupWriter;
use App\Ai\Tools\CaptureSnapshot;
use App\Ai\Tools\RunPlaywrightTest;
use App\Ai\StructuredOutput;
use App\Data\V1\Auth\AuthSetupData;
use App\Data\V1\Auth\GeneratedAuthSetupData;
use App\Data\V1\Recording\TestRunData;
use App\Support\SessionState;
use Lorisleiva\Actions\Concerns\AsAction;

class GenerateAuthSetup
{
    use AsAction;

    private const MAX_RUN_ATTEMPTS = 3;

    private const NO_SESSION_ERROR = 'O login executou sem erro mas nenhum estado de sessão (cookie ou localStorage) foi capturado.';

    public function handle(AuthSetupData $input): GeneratedAuthSetupData
    {
        $snapshot = app(CaptureSnapshot::class)->capture($input->loginUrl);

        $authSetup = $this->write($input, $snapshot);

        return $this->tryOnce($input, $snapshot, $authSetup, attempt: 1);
    }

    /**
     * Executa e valida um authSetup já escrito por outra fonte (ex.: gerado a partir de uma gravação),
     * em vez de escrever um novo a partir do snapshot da URL de login.
     */
    public function verify(AuthSetupData $input, string $authSetup): GeneratedAuthSetupData
    {
        $snapshot = app(CaptureSnapshot::class)->capture($input->loginUrl);

        return $this->tryOnce($input, $snapshot, $authSetup, attempt: 1);
    }

    /**
     * Continua o loop de autocorreção a partir de uma primeira tentativa que falhou.
     * Chamado em background (dispatch(...)->afterResponse()) para não bloquear a resposta HTTP.
     */
    public function retry(AuthSetupData $input, GeneratedAuthSetupData $failed): GeneratedAuthSetupData
    {
        while ($failed->testRun->attempts < self::MAX_RUN_ATTEMPTS) {
            $authSetup = $this->correct($input, $failed);

            $failed = $this->tryOnce($input, $failed->snapshot, $authSetup, $failed->testRun->attempts + 1);

            if ($failed->testRun->passed) {
                return $failed;
            }
        }

        return $failed;
    }

    private function write(AuthSetupData $input, string $snapshot): string
    {
        return StructuredOutput::field(app(AuthSetupWriter::class)->prompt(
            "URL de login: {$input->loginUrl}\n\nSnapshot da página de login:\n{$snapshot}",
        ), 'authSetup');
    }

    private function correct(AuthSetupData $input, GeneratedAuthSetupData $failed): string
    {
        $feedback = $failed->testRun->error === self::NO_SESSION_ERROR
            ? 'O teste passou mas nenhum cookie ou localStorage de sessão foi salvo — o login provavelmente não ocorreu. '
                .'Não use page.context().storageState como checagem de existência nem retorne cedo: esse método sempre grava, mesmo sem login. '
                .'Execute o login completo e só então salve o estado.'
            : $this->executionFeedback($failed->testRun->error);

        return StructuredOutput::field(app(AuthSetupWriter::class)->prompt(
            "O setup de autenticação abaixo não autenticou. Corrija-o."
                ."\n\nURL de login: {$input->loginUrl}"
                ."\n\n{$feedback}"
                ."\n\nSetup com falha:\n{$failed->authSetup}"
                ."\n\nSnapshot da página de login:\n{$failed->snapshot}",
        ), 'authSetup');
    }

    private function tryOnce(AuthSetupData $input, string $snapshot, string $authSetup, int $attempt): GeneratedAuthSetupData
    {
        $env = ['AUTH_USER' => $input->username, 'AUTH_PASSWORD' => $input->password];

        $result = app(RunPlaywrightTest::class)->run($authSetup, $input->executionUrl, $env);
        $captured = SessionState::hasSession($result->storageState);

        if ($result->passed && $captured) {
            return new GeneratedAuthSetupData(
                authSetup: $authSetup,
                storageCaptured: true,
                testRun: new TestRunData(executed: true, passed: true, attempts: $attempt),
                snapshot: $snapshot,
            );
        }

        return new GeneratedAuthSetupData(
            authSetup: $authSetup,
            storageCaptured: false,
            testRun: new TestRunData(
                executed: true,
                passed: false,
                attempts: $attempt,
                error: $result->passed ? self::NO_SESSION_ERROR : $result->output,
            ),
            snapshot: $snapshot,
        );
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
}
