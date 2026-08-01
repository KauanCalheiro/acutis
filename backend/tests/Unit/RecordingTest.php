<?php

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
