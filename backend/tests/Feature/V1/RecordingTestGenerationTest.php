<?php

use App\Ai\Agents\GherkinWriter;
use App\Ai\Agents\PlaywrightWriter;

use function Pest\Laravel\postJson;

function recordingPayload(array $overrides = []): array
{
    return array_merge([
        'sessionId' => '7b9a3531-4964-4c8e-a0bb-daa10c55563b',
        'baseUrl' => 'http://127.0.0.1:52346',
        'recordedAt' => '2026-07-03T22:00:00Z',
        'video' => 'recording.webm',
        'events' => [
            [
                'type' => 'navigate',
                'timestamp' => 1783119883000,
                'url' => 'http://127.0.0.1:52346/',
                'selectors' => null,
                'label' => 'Acutis Store',
                'value' => null,
                'tagName' => null,
                'innerText' => null,
            ],
            [
                'type' => 'fill',
                'timestamp' => 1783119883520,
                'url' => 'http://127.0.0.1:52346/',
                'selectors' => [
                    'dataTestId' => 'login-name',
                    'id' => 'name',
                    'name' => 'name',
                    'placeholder' => 'Seu nome',
                    'cssStable' => '#name',
                    'finder' => '#name',
                ],
                'label' => 'Nome completo',
                'value' => 'Ana Souza',
                'tagName' => 'input',
                'innerText' => null,
            ],
            [
                'type' => 'click',
                'timestamp' => 1783119884000,
                'url' => 'http://127.0.0.1:52346/',
                'selectors' => [
                    'dataTestId' => 'login-submit',
                    'id' => 'sign-in',
                    'finder' => '#sign-in',
                ],
                'label' => 'Entrar',
                'value' => null,
                'tagName' => 'button',
                'innerText' => 'Entrar',
            ],
        ],
    ], $overrides);
}

it('generates gherkin and playwright from a recording', function () {
    GherkinWriter::fake([['gherkin' => 'Funcionalidade: Login na Acutis Store']]);
    PlaywrightWriter::fake([['playwright' => "import { test, expect } from '@playwright/test'"]]);

    postJson('/api/v1/recordings/tests', recordingPayload())
        ->assertOk()
        ->assertJson([
            'gherkin' => 'Funcionalidade: Login na Acutis Store',
            'playwright' => "import { test, expect } from '@playwright/test'",
        ]);
});

it('prompts the gherkin writer with the recorded events', function () {
    GherkinWriter::fake([['gherkin' => 'Funcionalidade: Login']]);
    PlaywrightWriter::fake([['playwright' => 'spec']]);

    postJson('/api/v1/recordings/tests', recordingPayload())->assertOk();

    GherkinWriter::assertPrompted(
        fn ($prompt) => str_contains($prompt->prompt, 'Ana Souza')
            && str_contains($prompt->prompt, 'http://127.0.0.1:52346')
    );
});

it('prompts the playwright writer with the generated gherkin and the events', function () {
    GherkinWriter::fake([['gherkin' => 'Funcionalidade: Login na Acutis Store']]);
    PlaywrightWriter::fake([['playwright' => 'spec']]);

    postJson('/api/v1/recordings/tests', recordingPayload())->assertOk();

    PlaywrightWriter::assertPrompted(
        fn ($prompt) => str_contains($prompt->prompt, 'Funcionalidade: Login na Acutis Store')
            && str_contains($prompt->prompt, 'login-submit')
    );
});

it('annotates noticeable pauses between events in the playwright prompt', function () {
    GherkinWriter::fake([['gherkin' => 'Funcionalidade: Login']]);
    PlaywrightWriter::fake([['playwright' => 'spec']]);

    $payload = recordingPayload();
    $payload['events'][1]['timestamp'] = $payload['events'][0]['timestamp'] + 500;
    $payload['events'][2]['timestamp'] = $payload['events'][1]['timestamp'] + 4700;

    postJson('/api/v1/recordings/tests', $payload)->assertOk();

    PlaywrightWriter::assertPrompted(
        fn ($prompt) => str_contains($prompt->prompt, 'Pausas notáveis')
            && str_contains($prompt->prompt, '4.7s')
    );
});

it('omits the pause section when events flow without noticeable gaps', function () {
    GherkinWriter::fake([['gherkin' => 'Funcionalidade: Login']]);
    PlaywrightWriter::fake([['playwright' => 'spec']]);

    $payload = recordingPayload();
    $payload['events'][1]['timestamp'] = $payload['events'][0]['timestamp'] + 500;
    $payload['events'][2]['timestamp'] = $payload['events'][1]['timestamp'] + 800;

    postJson('/api/v1/recordings/tests', $payload)->assertOk();

    PlaywrightWriter::assertPrompted(
        fn ($prompt) => ! str_contains($prompt->prompt, 'Pausas notáveis')
    );
});

it('rejects a recording without events', function () {
    GherkinWriter::fake();
    PlaywrightWriter::fake();

    postJson('/api/v1/recordings/tests', recordingPayload(['events' => []]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['events']);

    GherkinWriter::assertNeverPrompted();
});

it('rejects a recording without base url', function () {
    GherkinWriter::fake();
    PlaywrightWriter::fake();

    $payload = recordingPayload();
    unset($payload['baseUrl']);

    postJson('/api/v1/recordings/tests', $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['baseUrl']);
});

it('rejects an event without type', function () {
    GherkinWriter::fake();
    PlaywrightWriter::fake();

    $payload = recordingPayload();
    unset($payload['events'][0]['type']);

    postJson('/api/v1/recordings/tests', $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['events.0.type']);
});
