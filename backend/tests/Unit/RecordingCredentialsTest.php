<?php

use App\Support\RecordingCredentials;

function events(array $overrides = []): array
{
    return array_merge([
        ['type' => 'navigate', 'url' => 'https://sistema.test/login', 'inputType' => null, 'value' => null],
        ['type' => 'fill', 'url' => 'https://sistema.test/login', 'inputType' => 'text', 'value' => 'user1'],
        ['type' => 'fill', 'url' => 'https://sistema.test/login', 'inputType' => 'password', 'value' => 'topsecret123'],
        ['type' => 'submit', 'url' => 'https://sistema.test/login', 'inputType' => null, 'value' => null],
    ], $overrides);
}

it('extracts the username, password and login url from the recorded events', function () {
    $credentials = RecordingCredentials::extract(events());

    expect($credentials->username)->toBe('user1')
        ->and($credentials->password)->toBe('topsecret123')
        ->and($credentials->loginUrl)->toBe('https://sistema.test/login');
});

it('returns nulls when no password field was recorded', function () {
    $credentials = RecordingCredentials::extract([
        ['type' => 'fill', 'url' => 'https://sistema.test', 'inputType' => 'text', 'value' => 'user1'],
    ]);

    expect($credentials->username)->toBeNull()
        ->and($credentials->password)->toBeNull()
        ->and($credentials->loginUrl)->toBeNull();
});

it('ignores a non-fill event immediately before the password field when finding the username', function () {
    $credentials = RecordingCredentials::extract([
        ['type' => 'fill', 'url' => 'x', 'inputType' => 'text', 'value' => 'user1'],
        ['type' => 'click', 'url' => 'x', 'inputType' => null, 'value' => null],
        ['type' => 'fill', 'url' => 'x', 'inputType' => 'password', 'value' => 'topsecret123'],
    ]);

    expect($credentials->username)->toBe('user1')
        ->and($credentials->password)->toBe('topsecret123');
});
