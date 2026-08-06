<?php

namespace App\Ai\Prompts;

use App\Ai\Rules\Violation;

/**
 * O que um Fixer recebe, venha a correção da validação ou de uma execução vermelha. As seções que
 * não têm o que dizer ficam de fora: um "run": null só ocuparia atenção sem informar nada.
 */
final class FixPrompt
{
    /**
     * @param  list<Violation>  $violations
     * @param  array<array-key, mixed>|null  $snapshot
     * @param  list<array<string, mixed>>  $events
     */
    public static function of(
        string $spec,
        array $violations = [],
        ?string $step = null,
        ?string $error = null,
        ?array $snapshot = null,
        array $events = [],
    ): string {
        $payload = [
            'spec' => $spec,
            'violations' => array_map(
                // O fixable é roteamento interno; para o modelo não há o que fazer com ele.
                fn (Violation $violation): array => [
                    'rule' => $violation->rule,
                    'message' => $violation->message,
                ],
                $violations,
            ),
        ];

        if ($step !== null || $error !== null) {
            $payload['run'] = ['step' => $step, 'error' => $error];
        }

        if ($snapshot !== null) {
            $payload['snapshot'] = $snapshot;
        }

        if ($events !== []) {
            $payload['events'] = $events;
        }

        return Payload::encode($payload);
    }
}
