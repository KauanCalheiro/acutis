<?php

namespace App\Action;

use App\Ai\Agents\Selector\SelectorWriter;
use App\Ai\Prompts\SelectorPrompt;
use App\Ai\Rules\SelectorRules;
use App\Ai\StructuredOutput;
use App\Data\V1\Project\SelectorSuggestionData;
use App\Support\Project;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Lorisleiva\Actions\Concerns\AsAction;

class SuggestScenarioSelectors
{
    use AsAction;

    /** @return list<SelectorSuggestionData> */
    public function handle(string $slug, string $scenarioId): array
    {
        $project = Project::make($slug);
        $path = $project->path();
        $scenario = $project->scenario($scenarioId)->data();

        $eventsFile = Str::replaceLast('.spec.ts', '.events.json', "{$path}/{$scenario->spec}");
        $events = File::exists($eventsFile) ? (json_decode(File::get($eventsFile), true) ?? []) : [];

        $targets = json_decode(SelectorPrompt::from($events), true);

        if ($targets === []) {
            return [];
        }

        $response = app(SelectorWriter::class)->prompt(SelectorPrompt::from($events));

        $suggestions = $this->merge($targets, StructuredOutput::fieldArray($response, 'suggestions'));

        return $this->clean($suggestions);
    }

    /**
     * O modelo devolve só o índice, o testid e o motivo; o evento e o seletor atual vêm do PHP,
     * que já os tinha. Assim não há eco a errar, e sugestão de índice inexistente cai fora.
     *
     * @param  list<array<string, mixed>>  $targets
     * @param  list<array<string, mixed>>  $suggestions
     * @return list<SelectorSuggestionData>
     */
    private function merge(array $targets, array $suggestions): array
    {
        $byIndex = array_column($targets, null, 'index');
        $merged = [];

        foreach ($suggestions as $suggestion) {
            $target = $byIndex[$suggestion['index'] ?? -1] ?? null;

            if ($target === null) {
                continue;
            }

            $merged[] = new SelectorSuggestionData(
                event: (string) ($target['label'] ?: $target['type']),
                currentSelector: (string) $target['selector'],
                suggestedTestId: (string) ($suggestion['suggestedTestId'] ?? ''),
                reason: (string) ($suggestion['reason'] ?? ''),
            );
        }

        return $merged;
    }

    /**
     * Sugestão fora do padrão é descartada, não corrigida: o testid vai ser colado à mão no código
     * do sistema testado, e um nome torto ali fica para sempre.
     *
     * @param  list<SelectorSuggestionData>  $suggestions
     * @return list<SelectorSuggestionData>
     */
    private function clean(array $suggestions): array
    {
        return array_values(array_filter(
            $suggestions,
            fn (SelectorSuggestionData $suggestion): bool => SelectorRules::check([$suggestion]) === [],
        ));
    }
}
