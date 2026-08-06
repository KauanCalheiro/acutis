<?php

namespace App\Action;

use App\Ai\Agents\Auth\AuthFixer;
use App\Ai\Agents\Auth\AuthValidator;
use App\Ai\Agents\Auth\AuthWriter;
use App\Ai\Prompts\AuthPrompt;
use App\Ai\Prompts\FixPrompt;
use App\Ai\Rules\AuthRules;
use App\Ai\Rules\Violation;
use App\Ai\StructuredOutput;
use App\Ai\Tools\RunSpec;
use App\Data\V1\Auth\AuthRecordingData;
use App\Data\V1\Auth\GeneratedAuthSetupData;
use App\Data\V1\Project\EnvironmentVarData;
use App\Enums\EnvKey;
use App\Support\Primitives\Environments;
use App\Support\Primitives\Playwright;
use App\Support\Primitives\Url;
use App\Support\Project;
use App\Support\Recording;
use Lorisleiva\Actions\Concerns\AsAction;

class GenerateAuthSetupFromRecording
{
    use AsAction;

    /** Rede de segurança: o agente já se corrige por dentro, e o ideal é nunca chegar aqui. */
    private const MAX_FIX_ATTEMPTS = 2;

    /**
     * O arquivo é executado antes de voltar ao usuário. Se o agente já rodou este mesmo conteúdo
     * pela tool, o resultado guardado é reaproveitado em vez de uma segunda execução.
     */
    public function handle(string $slug, AuthRecordingData $input): GeneratedAuthSetupData
    {
        $project = Project::make($slug);
        $recording = Recording::make($input->events);
        $base = new Url($input->baseUrl);
        $environments = $this->environments($project, $input, $recording);
        $run = $this->runner($input);

        $writer = new AuthWriter($project->path(), $base, $environments, $run, $recording->html());

        $playwright = new Playwright(StructuredOutput::field(
            $writer->prompt(AuthPrompt::from($input, $environments)),
            'authSetup',
        ));

        [$playwright, $warnings] = $this->settle($project, $input, $recording, $base, $environments, $run, $playwright);

        $run?->ensure($playwright->value);

        return new GeneratedAuthSetupData(
            authSetup: $playwright->value,
            credentialsNeeded: $recording->credentials() === null,
            warnings: $warnings,
        );
    }

    /**
     * O loop de correção. As duas checagens são chamadas encapsuladas, uma linha cada: tirar a
     * validação por IA é apagar a linha dela.
     *
     * @return array{Playwright, list<string>}
     */
    private function settle(
        Project $project,
        AuthRecordingData $input,
        Recording $recording,
        Url $base,
        Environments $environments,
        ?RunSpec $run,
        Playwright $playwright,
    ): array {
        $events = $recording->withoutPasswords();

        for ($attempt = 0; $attempt <= self::MAX_FIX_ATTEMPTS; $attempt++) {
            $issues = [
                ...AuthRules::check($playwright, $base, $environments),
                ...AuthValidator::check($playwright, $events),
            ];

            $fixable = array_values(array_filter($issues, fn (Violation $v): bool => $v->fixable));

            if ($fixable === [] || $attempt === self::MAX_FIX_ATTEMPTS) {
                return [$playwright, $this->warnings($issues)];
            }

            $fixer = new AuthFixer($project->path(), $base, $environments, $run, $recording->html());

            $playwright = new Playwright(StructuredOutput::field(
                $fixer->prompt(FixPrompt::of(
                    spec: $playwright->value,
                    violations: $fixable,
                    error: $run?->last()?->passed === false ? $run->last()->output : null,
                    html: $run?->last()?->html,
                    events: $events,
                )),
                'playwright',
            ));
        }

        return [$playwright, []];
    }

    /**
     * O que esta gravação carrega conta como preenchido: a URL base e as credenciais são escritas
     * no ambiente logo depois, e sem isto todo primeiro login sairia acusado de variável vazia.
     */
    private function environments(Project $project, AuthRecordingData $input, Recording $recording): Environments
    {
        $credentials = $recording->credentials();

        $filled = [
            EnvKey::URL->value => $input->baseUrl,
            EnvKey::USER->value => $credentials?->username,
            EnvKey::PASSWORD->value => $credentials?->password,
        ];

        return new Environments(array_map(
            fn (EnvironmentVarData $var): EnvironmentVarData => blank($var->value) && filled($filled[$var->key] ?? null)
                ? new EnvironmentVarData($var->key, $filled[$var->key], $var->secret)
                : $var,
            $project->environments()->activeVars(),
        ));
    }

    /** Sem URL de execução não há onde rodar, e aí o agente nem recebe a tool. */
    private function runner(AuthRecordingData $input): ?RunSpec
    {
        if ($input->executionUrl === null) {
            return null;
        }

        return new RunSpec($input->executionUrl, [EnvKey::URL->value => $input->executionUrl]);
    }

    /**
     * O que ainda está quebrado quando o loop para. São dois casos e o usuário precisa dos dois:
     * o que o Fixer nunca resolveria, como variável declarada sem valor, e o que ele tentou até
     * o limite sem conseguir.
     *
     * @param  list<Violation>  $issues
     * @return list<string>
     */
    private function warnings(array $issues): array
    {
        return array_values(array_map(
            fn (Violation $v): string => "{$v->rule}: {$v->message}",
            $issues,
        ));
    }
}
