<?php

namespace App\Action;

use App\Ai\Agents\GherkinWriter;
use App\Ai\Agents\PlaywrightWriter;
use App\Data\V1\Recording\GeneratedTestsData;
use App\Data\V1\Recording\RecordingData;
use Lorisleiva\Actions\Concerns\AsAction;

class GenerateTestsFromRecording
{
    use AsAction;

    public function handle(RecordingData $recording): GeneratedTestsData
    {
        $events = json_encode(
            $recording->events,
            JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
        );

        $gherkin = app(GherkinWriter::class)->prompt(
            "URL base: {$recording->baseUrl}\n\nEventos gravados:\n{$events}",
        )['gherkin'];

        $playwright = app(PlaywrightWriter::class)->prompt(
            "URL base: {$recording->baseUrl}\n\nCenário Gherkin:\n{$gherkin}\n\nEventos gravados:\n{$events}",
        )['playwright'];

        return new GeneratedTestsData(
            gherkin: $gherkin,
            playwright: $playwright,
        );
    }
}
