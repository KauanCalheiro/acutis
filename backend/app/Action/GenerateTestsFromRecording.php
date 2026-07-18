<?php

namespace App\Action;

use App\Ai\Agents\GherkinWriter;
use App\Ai\Agents\PlaywrightWriter;
use App\Ai\StructuredOutput;
use App\Ai\Tools\RunPlaywrightTest;
use App\Data\V1\Recording\GeneratedTestsData;
use App\Data\V1\Recording\RecordingData;
use App\Data\V1\Recording\TestRunData;
use App\Support\RecordingEvents;
use Lorisleiva\Actions\Concerns\AsAction;

class GenerateTestsFromRecording
{
    use AsAction;

    private const NOTICEABLE_PAUSE_MS = 2000;

    private const MAX_RUN_ATTEMPTS = 3;

    public function handle(RecordingData $recording): GeneratedTestsData
    {
        $events = json_encode(
            RecordingEvents::redact($recording->events),
            JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
        );

        $gherkinResponse = app(GherkinWriter::class)->prompt(
            "URL base: {$recording->baseUrl}\n\nEventos gravados:\n{$events}",
        );
        $gherkin = StructuredOutput::field($gherkinResponse, 'gherkin');
        $domain = StructuredOutput::field($gherkinResponse, 'domain');

        $playwrightResponse = app(PlaywrightWriter::class)->prompt(
            "URL base: {$recording->baseUrl}\n\nCenário Gherkin:\n{$gherkin}\n\nEventos gravados:\n{$events}"
                .$this->noticeablePauses($recording->events),
        );
        $playwright = StructuredOutput::field($playwrightResponse, 'playwright');
        $envVars = StructuredOutput::fieldArray($playwrightResponse, 'envVars');

        $testRun = null;

        if ($recording->executionUrl !== null) {
            [$playwright, $testRun, $envVars] = $this->runUntilItPasses($recording, $gherkin, $events, $playwright, $envVars);
        }

        $tag = $this->readWriteTag($recording->events);

        return new GeneratedTestsData(
            gherkin: $this->ensureGherkinTag($gherkin, $tag),
            playwright: $this->ensurePlaywrightTag($playwright, $tag),
            domain: $domain,
            envVars: $envVars,
            testRun: $testRun,
        );
    }

    private function readWriteTag(array $events): string
    {
        $mutates = collect($events)->contains(
            fn (array $event): bool => in_array($event['type'] ?? '', ['fill', 'submit'], true),
        );

        // ponytail: heurística fill/submit = escrita; clique que muta sem formulário passa por @read — o agente decide melhor, isto é só o fallback
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

    private function runUntilItPasses(
        RecordingData $recording,
        string $gherkin,
        string $events,
        string $playwright,
        array $envVars,
    ): array {
        $attempts = 0;

        while (true) {
            $attempts++;

            $result = app(RunPlaywrightTest::class)->run(
                str_replace($recording->baseUrl, $recording->executionUrl, $playwright),
                $recording->executionUrl,
            );

            if ($result->passed) {
                return [$playwright, new TestRunData(executed: true, passed: true, attempts: $attempts), $envVars];
            }

            if ($attempts >= self::MAX_RUN_ATTEMPTS) {
                return [$playwright, new TestRunData(
                    executed: true,
                    passed: false,
                    attempts: $attempts,
                    error: $result->output,
                ), $envVars];
            }

            $retryResponse = app(PlaywrightWriter::class)->prompt(
                "O teste Playwright abaixo falhou ao executar. Corrija o spec mantendo a URL base {$recording->baseUrl}."
                    ."\n\nErro da execução:\n{$result->output}"
                    ."\n\nSpec com falha:\n{$playwright}"
                    ."\n\nCenário Gherkin:\n{$gherkin}"
                    ."\n\nEventos gravados:\n{$events}",
            );
            $playwright = StructuredOutput::field($retryResponse, 'playwright');
            $envVars = StructuredOutput::fieldArray($retryResponse, 'envVars');
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
