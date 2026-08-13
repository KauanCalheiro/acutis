<?php

use App\Ai\Agents\Auth\AuthFixer;
use App\Ai\Limits;
use Laravel\Ai\Attributes\Timeout;
use Laravel\Ai\Contracts\HasTools;

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
    expect(agentClasses())->toContain(AuthFixer::class);
});

it('gives every agent the same timeout, since 60s does not cover a real generation', function (string $agent) {
    $attributes = (new ReflectionClass($agent))->getAttributes(Timeout::class);

    expect($attributes)->not->toBeEmpty()
        ->and($attributes[0]->newInstance()->value)->toBe(Limits::TIMEOUT);
})->with(agentClasses());

/**
 * Nenhum agente pede ferramenta: cada um recebe o prompt inteiro e devolve a resposta numa
 * interação. Foi o laço de tools que trouxe a complexidade que este projeto não quer, e é a Action
 * que orquestra execução e correção, onde o limite é código e não conversa.
 */
it('keeps every agent on a single call, with no tool loop to spend itself in', function (string $agent) {
    expect(is_subclass_of($agent, HasTools::class))->toBeFalse();
})->with(agentClasses());
