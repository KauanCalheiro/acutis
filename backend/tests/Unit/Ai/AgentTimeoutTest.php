<?php

use App\Ai\Agents\Auth\AuthWriter;
use App\Ai\Limits;
use Laravel\Ai\Attributes\Timeout;

/** Toda classe de agente, descoberta pelo disco, para um agente novo entrar no teste sozinho. */
function agentClasses(): array
{
    $root = __DIR__.'/../../../app/Ai/Agents';

    return array_map(
        fn (string $file): string => 'App\\Ai\\Agents\\'.str_replace(
            ['/', '.php'],
            ['\\', ''],
            substr($file, strlen($root) + 1),
        ),
        glob($root.'/*/*.php') ?: [],
    );
}

it('finds the agents on disk', function () {
    expect(agentClasses())->toContain(AuthWriter::class);
});

it('gives every agent the same timeout, since 60s does not cover a real generation', function (string $agent) {
    $attributes = (new ReflectionClass($agent))->getAttributes(Timeout::class);

    expect($attributes)->not->toBeEmpty()
        ->and($attributes[0]->newInstance()->value)->toBe(Limits::TIMEOUT);
})->with(agentClasses());
