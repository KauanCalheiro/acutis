<?php

use App\Ai\Prompts\AuthPrompt;
use App\Data\V1\Auth\AuthRecordingData;
use App\Support\Recording;

function loginEvents(array $overrides = []): array
{
    return $overrides ?: [
        ['type' => 'navigate', 'timestamp' => 1000, 'url' => 'https://sistema.test/intranet/login', 'selectors' => null, 'label' => null, 'value' => null, 'inputType' => null],
        ['type' => 'fill', 'timestamp' => 2000, 'url' => 'https://sistema.test/intranet/login', 'selectors' => ['dataTestId' => 'user'], 'label' => 'Usuário', 'value' => 'usuario-de-teste', 'inputType' => 'text'],
        ['type' => 'fill', 'timestamp' => 2400, 'url' => 'https://sistema.test/intranet/login', 'selectors' => ['dataTestId' => 'pass'], 'label' => 'Senha', 'value' => 'topsecret123', 'inputType' => 'password'],
        ['type' => 'submit', 'timestamp' => 2800, 'url' => 'https://sistema.test/intranet/login', 'selectors' => ['dataTestId' => 'entrar'], 'label' => 'Entrar', 'value' => null, 'inputType' => null],
        ['type' => 'navigate', 'timestamp' => 3200, 'url' => 'https://sistema.test/intranet/', 'selectors' => null, 'label' => null, 'value' => null, 'inputType' => null],
    ];
}

function authGherkinPayload(array $events = []): array
{
    $input = new AuthRecordingData(baseUrl: SPEC_BASE_URL, events: loginEvents($events));

    return json_decode(AuthPrompt::gherkin($input, Recording::make($input->events)), true);
}

it('gives the gherkin writer the base url and the events, and nothing else to weigh', function () {
    expect(array_keys(authGherkinPayload()))->toBe(['baseUrl', 'events']);
});

it('carries the base url next to the name of the variable that holds it', function () {
    expect(authGherkinPayload()['baseUrl'])->toBe(['value' => SPEC_BASE_URL, 'env' => 'URL']);
});

it('sends the events with the credentials already marked', function () {
    expect(array_column(authGherkinPayload()['events'], 'value'))
        ->toBe([null, '{{AUTH_USER}}', '{{AUTH_PASSWORD}}', null, null]);
});

it('never lets the typed password reach the payload', function () {
    $input = new AuthRecordingData(baseUrl: SPEC_BASE_URL, events: loginEvents());

    expect(AuthPrompt::gherkin($input, Recording::make($input->events)))->not->toContain('topsecret123');
});
