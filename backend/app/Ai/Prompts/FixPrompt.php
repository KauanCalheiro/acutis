<?php

namespace App\Ai\Prompts;

use App\Ai\Rules\Violation;

/**
 * O que um Fixer recebe, venha a correção da validação ou de uma execução vermelha. As seções que
 * não têm o que dizer ficam de fora: um "run": null só ocuparia atenção sem informar nada. O
 * fixable da violação também não vai: é roteamento interno, e o modelo não faria nada com ele.
 */
final class FixPrompt
{
    /**
     * @param  list<Violation>  $violations
     * @param  string|null  $html  a página no instante da falha, vinda da própria execução
     * @param  list<array<string, mixed>>  $events
     */
    public static function of(
        string $spec,
        array $violations = [],
        ?string $step = null,
        ?string $error = null,
        ?string $html = null,
        array $events = [],
    ): string {
        $payload = [
            'spec' => $spec,
            'violations' => array_map(
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

        if ($html !== null) {
            $payload['html'] = $html;
        }

        if ($events !== []) {
            $payload['events'] = $events;
        }

        return Payload::encode($payload);
    }
}
