<?php

namespace App\Action\Recording;

use App\Ai\Agents\Scenario\GherkinWriter;
use App\Ai\Agents\Scenario\ScenarioFixer;
use App\Ai\Attempt;
use App\Ai\Prompts\FixPrompt;
use App\Ai\Prompts\ScenarioPrompt;
use App\Ai\Rules\SpecRules;
use App\Ai\Rules\Violation;
use App\Ai\SpecRunner;
use App\Ai\StructuredOutput;
use App\Data\V1\Project\EnvironmentVarData;
use App\Data\V1\Recording\GeneratedTestsData;
use App\Data\V1\Recording\RecordingData;
use App\Data\V1\Recording\TestRunData;
use App\Enums\EnvKey;
use App\Support\Primitives\Environments;
use App\Support\Primitives\Playwright;
use App\Support\Primitives\Url;
use App\Support\Project;
use App\Support\Recording;
use App\Support\Recording\SpecEmitter;
use App\Support\TestArtifact;
use Lorisleiva\Actions\Concerns\AsAction;

class GenerateTestsFromRecording
{
    use AsAction;

    /** Quantas voltas de correção o arquivo ganha antes de voltar como está, com os avisos. */
    private const MAX_FIX_ATTEMPTS = 2;

    public function handle(string $slug, RecordingData $recording): GeneratedTestsData
    {
        $project = Project::make($slug);
        $events = Recording::make($recording->events);
        $base = new Url($recording->baseUrl);
        $environments = $this->environments($project, $recording);
        $run = $this->runner($recording);

        $written = app(GherkinWriter::class)->prompt(ScenarioPrompt::gherkin($recording, $environments));
        $gherkin = StructuredOutput::field($written, 'gherkin');
        $domain = StructuredOutput::field($written, 'domain');

        $emitter = new SpecEmitter($events, $base, $environments);
        $playwright = $emitter->spec(TestArtifact::title($gherkin), TestArtifact::scenario($gherkin));
        $envVars = $emitter->envVars();

        [$playwright, $warnings] = $this->settle(
            $events,
            $base,
            $this->withDeclared($environments, $events, $envVars),
            $run,
            $playwright,
        );

        $run?->ensure($playwright->value);

        $tag = $this->readWriteTag($recording->events);
        $gherkin = $this->ensureGherkinTag($gherkin, $tag);
        $spec = $this->ensurePlaywrightTag($playwright->value, $tag);

        if ($recording->publico) {
            [$gherkin, $spec] = $this->markAsPublic($gherkin, $spec);
        }

        return new GeneratedTestsData(
            gherkin: $gherkin,
            playwright: $spec,
            domain: $domain,
            envVars: $envVars,
            testRun: $this->testRun($run),
            warnings: $warnings,
        );
    }

    /**
     * O loop de correção, e ele mora aqui e não dentro do agente: cada volta confere as regras,
     * executa o arquivo e devolve o resultado ao Fixer numa chamada única. O teto é código, então
     * não existe volta infinita nem passo gasto em conversa.
     *
     * Executar só o arquivo que já passou pelas regras: rodar navegador para descobrir o que uma
     * regra aponta de graça é o gasto mais caro do fluxo.
     *
     * @return array{Playwright, list<string>}
     */
    private function settle(
        Recording $events,
        Url $base,
        Environments $environments,
        ?SpecRunner $run,
        Playwright $playwright,
    ): array {
        $redacted = $events->redacted($environments);

        for ($attempt = 0; $attempt <= self::MAX_FIX_ATTEMPTS; $attempt++) {
            $issues = SpecRules::check($playwright, $base, $environments);

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
                events: $redacted,
            );

            $playwright = new Playwright(StructuredOutput::field(
                Attempt::answering(fn () => app(ScenarioFixer::class)->prompt($correction), 'playwright'),
                'playwright',
            ));
        }

        return [$playwright, []];
    }

    /**
     * A URL desta gravação conta como preenchida: é ela que o projeto passa a usar, e sem isto o
     * primeiro rascunho de um projeto novo sairia acusado de variável vazia.
     */
    private function environments(Project $project, RecordingData $recording): Environments
    {
        return new Environments(array_map(
            fn (EnvironmentVarData $var): EnvironmentVarData => $var->key === EnvKey::URL->value && blank($var->value)
                ? new EnvironmentVarData($var->key, $recording->baseUrl, $var->secret)
                : $var,
            $project->environments()->activeVars(),
        ));
    }

    /**
     * As variáveis que a IA acabou de batizar para os valores sensíveis. Elas ainda não existem no
     * ambiente — só entram quando o rascunho for salvo — mas já valem para as regras, senão toda
     * variável nova sairia acusada de inexistente. Secretas porque o valor veio de evento sensível.
     *
     * @param  list<string>  $envVars
     */
    private function withDeclared(Environments $environments, Recording $events, array $envVars): Environments
    {
        if ($envVars === []) {
            return $environments;
        }

        $names = [];

        foreach (array_values($envVars) as $position => $name) {
            $names[Recording::SENSITIVE.($position + 1)] = $name;
        }

        $declared = [];

        foreach ($events->envValues($names) as $name => $value) {
            $declared[] = new EnvironmentVarData($name, $value, secret: true);
        }

        return new Environments([...$environments->vars, ...$declared]);
    }

    /** Sem URL de execução não há onde rodar, e aí o loop se guia só pelas regras. */
    private function runner(RecordingData $recording): ?SpecRunner
    {
        if ($recording->executionUrl === null) {
            return null;
        }

        return new SpecRunner($recording->executionUrl, [EnvKey::URL->value => $recording->executionUrl]);
    }

    private function testRun(?SpecRunner $run): ?TestRunData
    {
        if ($run === null || $run->last() === null) {
            return null;
        }

        return new TestRunData(
            executed: true,
            passed: $run->last()->passed,
            attempts: $run->attempts(),
            error: $run->last()->passed ? null : $run->last()->output,
        );
    }

    /**
     * O que ainda está quebrado quando o loop para: o que o Fixer nunca resolveria e o que ele
     * tentou até o limite sem conseguir.
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

    /**
     * A tag @publico é o que separa, na hora de rodar, quem usa a sessão do projeto de quem roda
     * limpo. É ela que permite testar a própria tela de login num projeto autenticado.
     *
     * @return array{string, string}
     */
    private function markAsPublic(string $gherkin, string $playwright): array
    {
        $tags = [...TestArtifact::tags($gherkin), '@publico'];

        return [
            TestArtifact::stampGherkinTags($gherkin, $tags),
            TestArtifact::stampPlaywrightTags($playwright, $tags),
        ];
    }

    /**
     * ponytail: heurística fill/submit = escrita; clique que muta sem formulário passa por @read,
     * e o agente decide melhor — isto é só o fallback.
     */
    private function readWriteTag(array $events): string
    {
        $mutates = collect($events)->contains(
            fn (array $event): bool => in_array($event['type'] ?? '', ['fill', 'submit'], true),
        );

        return $mutates ? '@write' : '@read';
    }

    private function ensureGherkinTag(string $gherkin, string $tag): string
    {
        $firstLine = strtok($gherkin, "\n") ?: '';

        if (str_starts_with(trim($firstLine), '@')) {
            if (preg_match('/@(read|write)\b/', $firstLine)) {
                return $gherkin;
            }

            return "{$tag} ".ltrim($gherkin);
        }

        return "{$tag}\n{$gherkin}";
    }

    private function ensurePlaywrightTag(string $playwright, string $tag): string
    {
        if (preg_match('/tag:\s*\[([^\]]*)\]/', $playwright, $m)) {
            if (preg_match('/@(read|write)\b/', $m[1])) {
                return $playwright;
            }

            return preg_replace('/tag:\s*\[/', "tag: ['{$tag}', ", $playwright, 1);
        }

        return preg_replace(
            '/test\.describe\(\s*((["\']).+?\2)\s*,\s*(?=\(|async)/',
            "test.describe($1, { tag: ['{$tag}'] }, ",
            $playwright,
            1,
        ) ?? $playwright;
    }
}
