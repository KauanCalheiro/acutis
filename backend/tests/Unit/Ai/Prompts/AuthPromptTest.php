<?php

use App\Ai\Prompts\AuthPrompt;
use App\Data\V1\Auth\AuthRecordingData;

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

function authPayload(array $events = [], array $extra = []): array
{
    return json_decode(AuthPrompt::from(
        new AuthRecordingData(baseUrl: SPEC_BASE_URL, events: loginEvents($events)),
        specEnvironments($extra),
    ), true);
}

it('builds a payload that is valid json', function () {
    expect(authPayload())->toBeArray();
});

it('carries the base url next to the name of the variable that holds it', function () {
    expect(authPayload()['baseUrl'])->toBe(['value' => SPEC_BASE_URL, 'env' => 'URL']);
});

it('carries the landing url already split into the path to wait for', function () {
    expect(authPayload()['landing'])->toBe([
        'url' => 'https://sistema.test/intranet/',
        'path' => '/intranet/',
    ]);
});

it('leaves the landing null when no navigation followed the submit', function () {
    $events = array_slice(loginEvents(), 0, 4);

    expect(authPayload($events)['landing'])->toBeNull();
});

it('names the credential variables instead of describing which field is which', function () {
    expect(authPayload()['credentials'])->toBe([
        'user' => 'AUTH_USER',
        'password' => 'AUTH_PASSWORD',
    ]);
});

it('names the variable that holds the session file', function () {
    expect(authPayload()['storageState'])->toBe('STORAGE_STATE');
});

it('sends the events with the credentials already marked', function () {
    expect(array_column(authPayload()['events'], 'value'))
        ->toBe([null, '{{AUTH_USER}}', '{{AUTH_PASSWORD}}', null, null]);
});

it('never lets the typed password reach the payload', function () {
    expect(AuthPrompt::from(
        new AuthRecordingData(baseUrl: SPEC_BASE_URL, events: loginEvents()),
        specEnvironments(),
    ))->not->toContain('topsecret123');
});

it('sends the value of an environment variable that is not secret', function () {
    $vars = collect(authPayload()['environment'])->keyBy('key');

    expect($vars['AUTH_USER'])->toBe(['key' => 'AUTH_USER', 'value' => 'usuario-de-teste']);
});

it('sends only the key of a secret environment variable', function () {
    $vars = collect(authPayload()['environment'])->keyBy('key');

    expect($vars['AUTH_PASSWORD'])->toBe(['key' => 'AUTH_PASSWORD', 'secret' => true]);
});
