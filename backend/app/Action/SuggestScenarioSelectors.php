<?php

namespace App\Action;

use App\Ai\Agents\SelectorSuggestionWriter;
use App\Ai\StructuredOutput;
use App\Data\V1\Project\SelectorSuggestionData;
use App\Support\Project;
use App\Support\Scenario;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Lorisleiva\Actions\Concerns\AsAction;

class SuggestScenarioSelectors
{
    use AsAction;

    /** @return list<SelectorSuggestionData> */
    public function handle(string $slug, string $scenarioId): array
    {
        $path = Project::path($slug);
        $scenario = Scenario::find($path, $scenarioId);

        $eventsFile = Str::replaceLast('.spec.ts', '.events.json', "{$path}/{$scenario->spec}");
        $events = File::exists($eventsFile) ? (json_decode(File::get($eventsFile), true) ?? []) : [];

        $targets = collect($events)
            ->filter(fn (array $event): bool => ! empty($event['selectors']) && empty($event['selectors']['dataTestId']))
            ->values();

        if ($targets->isEmpty()) {
            return [];
        }

        $response = app(SelectorSuggestionWriter::class)->prompt(
            json_encode($targets, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        );

        return collect(StructuredOutput::fieldArray($response, 'suggestions'))
            ->map(fn (array $s): SelectorSuggestionData => new SelectorSuggestionData(
                event: $s['event'] ?? '',
                currentSelector: $s['currentSelector'] ?? '',
                suggestedTestId: $s['suggestedTestId'] ?? '',
                reason: $s['reason'] ?? '',
            ))
            ->all();
    }
}
