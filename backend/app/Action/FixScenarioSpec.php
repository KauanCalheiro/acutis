<?php

namespace App\Action;

use App\Ai\Agents\SpecFixer;
use App\Ai\StructuredOutput;
use App\Ai\Tools\CaptureSnapshot;
use App\Data\V1\Project\FixedSpecData;
use App\Data\V1\Project\ScenarioFixData;
use App\Support\Project;
use Lorisleiva\Actions\Concerns\AsAction;

class FixScenarioSpec
{
    use AsAction;

    public function handle(string $slug, string $scenarioId, ScenarioFixData $input): FixedSpecData
    {
        $scenario = Project::make($slug)->scenario($scenarioId);

        $playwright = $scenario->source();
        $events = $scenario->events();

        $response = app(SpecFixer::class)->prompt($this->promptFor($playwright, $events, $input));

        return new FixedSpecData(
            playwright: StructuredOutput::field($response, 'playwright'),
            summary: StructuredOutput::field($response, 'summary'),
        );
    }

    /** @param  list<array<string, mixed>>  $events */
    private function promptFor(string $playwright, array $events, ScenarioFixData $input): string
    {
        $snapshot = $this->snapshot($events);
        $json = fn (array $value): string => json_encode($value, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        return <<<PROMPT
        Passo que falhou:
        {$input->step}

        Erro da execução:
        {$input->error}

        Spec atual:
        {$playwright}

        Snapshot da página real:
        {$snapshot}

        Eventos originais da gravação:
        {$json($events)}
        PROMPT;
    }

    /** @param  list<array<string, mixed>>  $events */
    private function snapshot(array $events): string
    {
        $url = collect($events)->pluck('url')->filter()->first();

        if (! is_string($url)) {
            return 'indisponível';
        }

        return app(CaptureSnapshot::class)->capture($url);
    }
}
