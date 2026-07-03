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

    private const NOTICEABLE_PAUSE_MS = 2000;

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
            "URL base: {$recording->baseUrl}\n\nCenário Gherkin:\n{$gherkin}\n\nEventos gravados:\n{$events}"
                .$this->noticeablePauses($recording->events),
        )['playwright'];

        return new GeneratedTestsData(
            gherkin: $gherkin,
            playwright: $playwright,
        );
    }

    private function noticeablePauses(array $events): string
    {
        $pauses = [];

        foreach ($events as $index => $event) {
            if ($index === 0) {
                continue;
            }

            $gapMs = ($event['timestamp'] ?? 0) - ($events[$index - 1]['timestamp'] ?? 0);

            if ($gapMs < self::NOTICEABLE_PAUSE_MS) {
                continue;
            }

            $seconds = number_format($gapMs / 1000, 1);
            $target = $event['label'] ?? $event['type'];
            $pauses[] = "- {$seconds}s antes do evento {$index} ({$event['type']} em \"{$target}\")";
        }

        if ($pauses === []) {
            return '';
        }

        return "\n\nPausas notáveis (a página provavelmente carregava ou hidratava — espere a condição antes do passo):\n"
            .implode("\n", $pauses);
    }
}
