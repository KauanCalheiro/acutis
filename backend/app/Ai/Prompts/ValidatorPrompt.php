<?php

namespace App\Ai\Prompts;

/**
 * O que o revisor recebe. Só o que as regras não alcançam: o arquivo, a gravação que ele deveria
 * reproduzir e, quando existe, o Gherkin que declarou a intenção.
 */
final class ValidatorPrompt
{
    /** @param  list<array<string, mixed>>  $events */
    public static function of(string $spec, array $events, ?string $gherkin = null): string
    {
        $payload = ['spec' => $spec];

        if ($gherkin !== null) {
            $payload['gherkin'] = $gherkin;
        }

        $payload['events'] = $events;

        return Payload::encode($payload);
    }
}
