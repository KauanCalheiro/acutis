<?php

namespace App\Action;

use App\Ai\Agents\GherkinWriter;
use App\Ai\Agents\PlaywrightWriter;
use App\Ai\StructuredOutput;
use App\Ai\Tools\RunPlaywrightTest;
use App\Data\V1\Recording\GeneratedTestsData;
use App\Data\V1\Recording\RecordingData;
use App\Data\V1\Recording\TestRunData;
use Lorisleiva\Actions\Concerns\AsAction;

class GenerateTestsFromRecording
{
    use AsAction;

    private const NOTICEABLE_PAUSE_MS = 2000;

    private const MAX_RUN_ATTEMPTS = 3;

    public function handle(RecordingData $recording): GeneratedTestsData
    {
        $events = json_encode(
            $recording->events,
            JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
        );

        $gherkin = StructuredOutput::field(app(GherkinWriter::class)->prompt(
            "URL base: {$recording->baseUrl}\n\nEventos gravados:\n{$events}",
        ), 'gherkin');

        $playwright = StructuredOutput::field(app(PlaywrightWriter::class)->prompt(
            "URL base: {$recording->baseUrl}\n\nCenário Gherkin:\n{$gherkin}\n\nEventos gravados:\n{$events}"
                .$this->noticeablePauses($recording->events),
        ), 'playwright');

        $testRun = null;

        if ($recording->executionUrl !== null) {
            [$playwright, $testRun] = $this->runUntilItPasses($recording, $gherkin, $events, $playwright);
        }

        return new GeneratedTestsData(
            gherkin: $gherkin,
            playwright: $playwright,
            testRun: $testRun,
        );
    }

    private function runUntilItPasses(
        RecordingData $recording,
        string $gherkin,
        string $events,
        string $playwright,
    ): array {
        $attempts = 0;

        while (true) {
            $attempts++;

            $result = app(RunPlaywrightTest::class)->run(
                str_replace($recording->baseUrl, $recording->executionUrl, $playwright),
            );

            if ($result->passed) {
                return [$playwright, new TestRunData(executed: true, passed: true, attempts: $attempts)];
            }

            if ($attempts >= self::MAX_RUN_ATTEMPTS) {
                return [$playwright, new TestRunData(
                    executed: true,
                    passed: false,
                    attempts: $attempts,
                    error: $result->output,
                )];
            }

            $playwright = StructuredOutput::field(app(PlaywrightWriter::class)->prompt(
                "O teste Playwright abaixo falhou ao executar. Corrija o spec mantendo a URL base {$recording->baseUrl}."
                    ."\n\nErro da execução:\n{$result->output}"
                    ."\n\nSpec com falha:\n{$playwright}"
                    ."\n\nCenário Gherkin:\n{$gherkin}"
                    ."\n\nEventos gravados:\n{$events}",
            ), 'playwright');
        }
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
