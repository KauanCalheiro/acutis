<?php

use App\Data\V1\Project\EnvironmentVarData;
use App\Support\Recording;

function events(array $overrides = []): array
{
    return array_merge([
        ['type' => 'navigate', 'url' => 'https://sistema.test/login', 'inputType' => null, 'value' => null],
        ['type' => 'fill', 'url' => 'https://sistema.test/login', 'inputType' => 'text', 'value' => 'user1'],
        ['type' => 'fill', 'url' => 'https://sistema.test/login', 'inputType' => 'password', 'value' => 'topsecret123'],
        ['type' => 'submit', 'url' => 'https://sistema.test/login', 'inputType' => null, 'value' => null],
    ], $overrides);
}

it('extracts the username and password from the recorded events', function () {
    $credentials = Recording::make(events())->credentials();

    expect($credentials->username)->toBe('user1')
        ->and($credentials->password)->toBe('topsecret123');
});

it('has no credentials at all when no password field was recorded', function () {
    $credentials = Recording::make([
        ['type' => 'fill', 'url' => 'https://sistema.test', 'inputType' => 'text', 'value' => 'user1'],
    ])->credentials();

    expect($credentials)->toBeNull();
});

it('has no credentials when the password field was recorded without a username before it', function () {
    $credentials = Recording::make([
        ['type' => 'fill', 'url' => 'x', 'inputType' => 'password', 'value' => 'topsecret123'],
    ])->credentials();

    expect($credentials)->toBeNull();
});

it('ignores a non-fill event immediately before the password field when finding the username', function () {
    $credentials = Recording::make([
        ['type' => 'fill', 'url' => 'x', 'inputType' => 'text', 'value' => 'user1'],
        ['type' => 'click', 'url' => 'x', 'inputType' => null, 'value' => null],
        ['type' => 'fill', 'url' => 'x', 'inputType' => 'password', 'value' => 'topsecret123'],
    ])->credentials();

    expect($credentials->username)->toBe('user1')
        ->and($credentials->password)->toBe('topsecret123');
});

function sensitiveEvents(array $values): array
{
    return array_map(
        fn (string $value): array => [
            'type' => 'fill',
            'url' => 'https://sistema.test/produtos',
            'inputType' => 'text',
            'sensitive' => true,
            'value' => $value,
        ],
        $values,
    );
}

function valuesOf(array $events): array
{
    return array_column($events, 'value');
}

it('marks a recorded value that matches an environment value with that key', function () {
    $events = Recording::make(sensitiveEvents(['abc123token']))
        ->redacted(specEnvironments([new EnvironmentVarData('API_TOKEN', 'abc123token')]));

    expect(valuesOf($events))->toBe(['{{API_TOKEN}}']);
});

it('marks a value that matches a secret environment value too, since the secret never leaves php', function () {
    $events = Recording::make(sensitiveEvents(['topsecret123']))->redacted(specEnvironments());

    expect(valuesOf($events))->toBe(['{{AUTH_PASSWORD}}']);
});

it('numbers the sensitive values that match no key, in recording order', function () {
    $events = Recording::make(sensitiveEvents(['primeiro-valor', 'segundo-valor']))
        ->redacted(specEnvironments());

    expect(valuesOf($events))->toBe(['{{SENSIVEL_1}}', '{{SENSIVEL_2}}']);
});

it('never lets the original sensitive value through', function () {
    $events = Recording::make(sensitiveEvents(['valor-que-nao-pode-vazar']))
        ->redacted(specEnvironments());

    expect(json_encode($events))->not->toContain('valor-que-nao-pode-vazar');
});

it('leaves values that were never marked sensitive alone', function () {
    $events = Recording::make(events())->redacted(specEnvironments());

    expect(valuesOf($events))->toContain('user1');
});

it('marks the recorded login credentials by the field that holds them', function () {
    $events = Recording::make(events())->withoutPasswords();

    expect(valuesOf($events))->toBe([null, '{{AUTH_USER}}', '{{AUTH_PASSWORD}}', null]);
});

it('never lets the real password through when marking the login', function () {
    $events = Recording::make(events())->withoutPasswords();

    expect(json_encode($events))->not->toContain('topsecret123');
});

it('marks the password field even when there is no username field before it', function () {
    $events = Recording::make([
        ['type' => 'fill', 'url' => 'x', 'inputType' => 'password', 'value' => 'topsecret123'],
    ])->withoutPasswords();

    expect(valuesOf($events))->toBe(['{{AUTH_PASSWORD}}']);
});

function eventsWithHtml(): array
{
    return [
        ['type' => 'navigate', 'url' => 'x', 'inputType' => null, 'value' => null, 'html' => null],
        ['type' => 'click', 'url' => 'x', 'inputType' => null, 'value' => null, 'html' => '<div><button class="btn">Salvar</button></div>'],
        ['type' => 'fill', 'url' => 'x', 'inputType' => 'text', 'value' => 'user1', 'html' => '<div><input name="user"></div>'],
    ];
}

it('leaves the captured html out of the events by default', function () {
    expect(Recording::make(eventsWithHtml())->events()[1])->not->toHaveKey('html');
});

it('carries the captured html when it is asked for', function () {
    expect(Recording::make(eventsWithHtml())->events(html: true)[1]['html'])
        ->toBe('<div><button class="btn">Salvar</button></div>');
});

it('never sends the captured html to the model, because it lives in its own file', function () {
    $events = Recording::make(eventsWithHtml())->redacted();

    expect(json_encode($events))->not->toContain('Salvar')
        ->and($events[1])->not->toHaveKey('html');
});

it('keeps the html out of the login events too', function () {
    $events = Recording::make(eventsWithHtml())->withoutPasswords();

    expect($events[1])->not->toHaveKey('html');
});

it('keeps the captured html keyed by the event it came from', function () {
    $html = Recording::make(eventsWithHtml())->html();

    expect($html)->toBe([
        1 => '<div><button class="btn">Salvar</button></div>',
        2 => '<div><input name="user"></div>',
    ]);
});

it('has no html at all for a recording made before the capture existed', function () {
    expect(Recording::make(events())->html())->toBe([]);
});

it('resolves the real value of each marker the ai named, by marker and not by position', function () {
    $values = Recording::make(sensitiveEvents(['primeiro-valor', 'segundo-valor']))
        ->envValues(['SENSIVEL_2' => 'SEGUNDO_TOKEN', 'SENSIVEL_1' => 'PRIMEIRO_TOKEN']);

    expect($values)->toBe([
        'SEGUNDO_TOKEN' => 'segundo-valor',
        'PRIMEIRO_TOKEN' => 'primeiro-valor',
    ]);
});

it('skips a marker the ai named but the recording never produced', function () {
    $values = Recording::make(sensitiveEvents(['primeiro-valor']))
        ->envValues(['SENSIVEL_1' => 'PRIMEIRO_TOKEN', 'SENSIVEL_9' => 'INVENTADO']);

    expect($values)->toBe(['PRIMEIRO_TOKEN' => 'primeiro-valor']);
});
