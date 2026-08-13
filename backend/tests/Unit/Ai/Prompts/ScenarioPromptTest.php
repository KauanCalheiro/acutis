<?php

use App\Ai\Prompts\ScenarioPrompt;
use App\Data\V1\Project\EnvironmentVarData;
use App\Data\V1\Recording\RecordingData;

function scenarioEvents(): array
{
    return [
        ['type' => 'navigate', 'timestamp' => 1000, 'url' => 'https://sistema.test/intranet/produtos', 'selectors' => null, 'label' => null, 'value' => null, 'inputType' => null],
        ['type' => 'fill', 'timestamp' => 1400, 'url' => 'https://sistema.test/intranet/produtos', 'selectors' => ['dataTestId' => 'busca'], 'label' => 'Buscar', 'value' => 'cadeira', 'inputType' => 'text'],
        ['type' => 'fill', 'timestamp' => 1800, 'url' => 'https://sistema.test/intranet/produtos', 'selectors' => ['dataTestId' => 'token'], 'label' => 'Token', 'value' => 'abc123token', 'inputType' => 'text', 'sensitive' => true],
        ['type' => 'click', 'timestamp' => 5000, 'url' => 'https://sistema.test/intranet/produtos', 'selectors' => ['dataTestId' => 'buscar'], 'label' => 'Buscar', 'value' => null, 'inputType' => null],
    ];
}

function scenarioRecording(): RecordingData
{
    return new RecordingData(baseUrl: SPEC_BASE_URL, events: scenarioEvents());
}

function gherkinPayload(array $extra = []): array
{
    return json_decode(ScenarioPrompt::gherkin(scenarioRecording(), specEnvironments($extra)), true);
}

it('gives the gherkin writer the base url and the events, and nothing else to weigh', function () {
    expect(array_keys(gherkinPayload()))->toBe(['baseUrl', 'events']);
});

it('carries the base url next to the name of the variable that holds it', function () {
    expect(gherkinPayload()['baseUrl'])->toBe(['value' => SPEC_BASE_URL, 'env' => 'URL']);
});

it('marks a sensitive value with the key that already holds it in the environment', function () {
    $payload = gherkinPayload([new EnvironmentVarData('API_TOKEN', 'abc123token')]);

    expect(array_column($payload['events'], 'value'))->toContain('{{API_TOKEN}}');
});

it('numbers a sensitive value that no environment key holds yet', function () {
    expect(array_column(gherkinPayload()['events'], 'value'))->toContain('{{SENSIVEL_1}}');
});

it('never lets a sensitive value reach the payload', function () {
    expect(ScenarioPrompt::gherkin(scenarioRecording(), specEnvironments()))
        ->not->toContain('abc123token');
});

it('leaves an ordinary recorded value untouched', function () {
    expect(array_column(gherkinPayload()['events'], 'value'))->toContain('cadeira');
});
