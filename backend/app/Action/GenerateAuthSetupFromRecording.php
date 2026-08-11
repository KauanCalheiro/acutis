<?php

namespace App\Action;

use App\Ai\Agents\Auth\AuthFixer;
use App\Ai\Agents\Auth\AuthValidator;
use App\Ai\Agents\Auth\AuthWriter;
use App\Ai\Attempt;
use App\Ai\Prompts\AuthPrompt;
use App\Ai\Prompts\FixPrompt;
use App\Ai\Rules\AuthRules;
use App\Ai\Rules\Violation;
use App\Ai\SpecRunner;
use App\Ai\StructuredOutput;
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

    /** Quantas voltas de correção o arquivo ganha antes de voltar como está, com os avisos. */
    private const MAX_FIX_ATTEMPTS = 2;

    /** O arquivo é executado antes de voltar ao usuário, dentro do loop de correção. */
    public function handle(string $slug, AuthRecordingData $input): GeneratedAuthSetupData
    {
        $project = Project::make($slug);
        $recording = Recording::make($input->events);
        $environments = $this->environments($project, $input, $recording);
        $base = $this->base($input, $environments);
        $run = $this->runner($input, $environments);

        $payload = AuthPrompt::from($input, $base, $environments);

        $playwright = new Playwright(StructuredOutput::field(
            Attempt::answering(fn () => app(AuthWriter::class)->prompt($payload), 'authSetup'),
            'authSetup',
        ));

        [$playwright, $warnings] = $this->settle($recording, $base, $environments, $run, $playwright);

        $run?->ensure($playwright->value);

        return new GeneratedAuthSetupData(
            authSetup: $playwright->value,
            credentialsNeeded: $recording->credentials() === null,
            warnings: $warnings,
        );
    }

    /**
     * O loop de correção, e ele mora aqui e não dentro do agente: cada volta confere as regras,
     * executa o login e devolve o resultado ao Fixer numa chamada única. O teto é código, então não
     * existe volta infinita nem passo gasto em conversa.
     *
     * Executar só o arquivo que já passou pelas regras: rodar navegador para descobrir o que uma
     * regra aponta de graça é o gasto mais caro do fluxo.
     *
     * @return array{Playwright, list<string>}
     */
    private function settle(
        Recording $recording,
        Url $base,
        Environments $environments,
        ?SpecRunner $run,
        Playwright $playwright,
    ): array {
        $events = $recording->withoutPasswords();

        for ($attempt = 0; $attempt <= self::MAX_FIX_ATTEMPTS; $attempt++) {
            $issues = [
                ...AuthRules::check($playwright, $base, $environments),
                ...AuthValidator::check($playwright, $events),
            ];

            $fixable = array_values(array_filter($issues, fn (Violation $v): bool => $v->fixable));
            $result = $fixable === [] ? $run?->ensure($playwright->value) : null;

            if (($fixable === [] && $result?->passed !== false) || $attempt === self::MAX_FIX_ATTEMPTS) {
                return [$playwright, $this->warnings($issues)];
            }

            $correction = FixPrompt::of(
                spec: $playwright->value,
                violations: $fixable,
                error: $result?->output,
                html: $result?->html,
                events: $events,
            );

            $playwright = new Playwright(StructuredOutput::field(
                Attempt::answering(fn () => app(AuthFixer::class)->prompt($correction), 'playwright'),
                'playwright',
            ));
        }

        return [$playwright, []];
    }

    /** A URL do sistema, que é a do ambiente ativo; a gravação pode ter parado no host do SSO. */
    private function base(AuthRecordingData $input, Environments $environments): Url
    {
        return new Url($environments->get(EnvKey::URL->value)?->value ?: $input->baseUrl);
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

    /**
     * Sem URL de execução não há onde rodar, e aí o loop se guia só pelas regras.
     *
     * As credenciais vão junto porque o setup de login as lê: sem elas a execução falha por falta
     * de dado, o agente lê isso como problema do arquivo e tenta contornar escrevendo desvio.
     */
    private function runner(AuthRecordingData $input, Environments $environments): ?SpecRunner
    {
        if ($input->executionUrl === null) {
            return null;
        }

        $env = [EnvKey::URL->value => $input->executionUrl];

        foreach ([EnvKey::USER, EnvKey::PASSWORD] as $key) {
            $value = $environments->get($key->value)?->value;

            if (filled($value)) {
                $env[$key->value] = $value;
            }
        }

        return new SpecRunner($input->executionUrl, $env);
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
