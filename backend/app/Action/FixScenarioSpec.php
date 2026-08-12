<?php

namespace App\Action;

use App\Ai\Agents\Auth\AuthFixer;
use App\Ai\Agents\Auth\AuthValidator;
use App\Ai\Agents\Scenario\ScenarioFixer;
use App\Ai\Agents\Scenario\ScenarioValidator;
use App\Ai\Attempt;
use App\Ai\Prompts\FixPrompt;
use App\Ai\Rules\AuthRules;
use App\Ai\Rules\SpecRules;
use App\Ai\Rules\Violation;
use App\Ai\SpecRunner;
use App\Ai\StructuredOutput;
use App\Data\V1\Project\FixedSpecData;
use App\Data\V1\Project\ScenarioFixData;
use App\Enums\EnvKey;
use App\Support\Primitives\Environments;
use App\Support\Primitives\Playwright;
use App\Support\Primitives\Url;
use App\Support\Project;
use Lorisleiva\Actions\Concerns\AsAction;

class FixScenarioSpec
{
    use AsAction;

    /** Rede de segurança: o agente já se corrige por dentro, e o ideal é nunca chegar aqui. */
    private const MAX_FIX_ATTEMPTS = 2;

    /**
     * Projeto sem URL configurada não tem host nem caminho a comparar, e as regras que dependem
     * disso precisam de algo. `.invalid` é reservado pela RFC 2606 justamente para isto: nunca
     * resolve, então nunca casa por engano com o que o spec traz.
     */
    private const NO_URL = 'https://acutis.invalid';

    /**
     * O spec é executado uma vez antes de chamar o Fixer, para ver a página como ela está agora:
     * é de dentro da execução, já autenticada, que sai o HTML onde aparece o elemento que mudou.
     */
    public function handle(string $slug, string $scenarioId, ScenarioFixData $input): FixedSpecData
    {
        $project = Project::make($slug);
        $scenario = $project->scenario($scenarioId);
        $environments = new Environments($project->environments()->activeVars());
        $base = $this->baseUrl($environments);

        $source = $scenario->source();
        $events = $scenario->events();
        $isAuth = $scenario->isAuth();

        $run = $base === null ? null : new SpecRunner($base->value, [EnvKey::URL->value => $base->value]);
        $result = $run?->ensure($source);

        $rulesBase = $base ?? new Url(self::NO_URL);

        $fixer = $isAuth ? app(AuthFixer::class) : app(ScenarioFixer::class);

        $payload = FixPrompt::of(
            spec: $source,
            step: $input->step,
            error: $input->error,
            html: $result?->passed === false ? $result->html : null,
            events: $events,
        );

        for ($attempt = 0; ; $attempt++) {
            $response = Attempt::answering(fn () => $fixer->prompt($payload), 'playwright');

            $playwright = new Playwright(StructuredOutput::field($response, 'playwright'));
            $summary = StructuredOutput::field($response, 'summary');

            $issues = $this->issues($isAuth, $playwright, $rulesBase, $environments, $events);
            $fixable = array_values(array_filter($issues, fn (Violation $v): bool => $v->fixable));

            if ($fixable === [] || $attempt === self::MAX_FIX_ATTEMPTS) {
                return new FixedSpecData(playwright: $playwright->value, summary: $summary);
            }

            $payload = FixPrompt::of(spec: $playwright->value, violations: $fixable, events: $events);
        }
    }

    /**
     * As duas checagens, uma linha cada: tirar a validação por IA é apagar a linha dela.
     *
     * @param  list<array<string, mixed>>  $events
     * @return list<Violation>
     */
    private function issues(
        bool $isAuth,
        Playwright $playwright,
        Url $base,
        Environments $environments,
        array $events,
    ): array {
        return [
            ...$isAuth
                ? AuthRules::check($playwright, $base, $environments)
                : SpecRules::check($playwright, $base, $environments),
            ...$isAuth
                ? AuthValidator::check($playwright, $events)
                : ScenarioValidator::check($playwright, $events),
        ];
    }

    /** Sem URL configurada não há onde rodar, e aí o Fixer trabalha só com o erro e os eventos. */
    private function baseUrl(Environments $environments): ?Url
    {
        $url = $environments->get(EnvKey::URL->value)?->value;

        return filled($url) ? new Url($url) : null;
    }
}
