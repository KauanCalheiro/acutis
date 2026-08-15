<?php

namespace App\Ai\Prompts;

/**
 * Só os eventos que dependem de seletor frágil, cada um com o índice que o traz de volta. O PHP
 * resolve qual é o seletor atual, então o modelo devolve apenas o testid e o motivo, e não tem
 * como errar o eco de um campo que ele não precisava repetir.
 */
final class SelectorPrompt
{
    /** Ordem de preferência do que resta quando não há data-testid. */
    private const FRAGILE = ['id', 'cssStable', 'text'];

    /** @param  list<array<string, mixed>>  $events */
    public static function from(array $events): string
    {
        $targets = [];

        foreach ($events as $index => $event) {
            $selector = self::fragile($event['selectors'] ?? null);

            if ($selector === null) {
                continue;
            }

            $targets[] = [
                'index' => $index,
                'type' => (string) ($event['type'] ?? ''),
                'label' => (string) ($event['label'] ?? ''),
                'selector' => $selector,
            ];
        }

        return Payload::encode($targets);
    }

    private static function fragile(mixed $selectors): ?string
    {
        if (! is_array($selectors) || filled($selectors['dataTestId'] ?? null)) {
            return null;
        }

        foreach (self::FRAGILE as $kind) {
            if (filled($selectors[$kind] ?? null)) {
                return (string) $selectors[$kind];
            }
        }

        return null;
    }
}
