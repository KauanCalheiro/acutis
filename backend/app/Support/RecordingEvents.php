<?php

namespace App\Support;

final class RecordingEvents
{
    /**
     * Troca o valor de eventos marcados como sensíveis (ex.: senha) por '••••' —
     * usar antes de mandar eventos gravados pra IA ou gravar em disco.
     *
     * @param  array<int, array<string, mixed>>  $events
     * @return array<int, array<string, mixed>>
     */
    public static function redact(array $events): array
    {
        return array_map(function (array $event): array {
            if (($event['sensitive'] ?? false) === true) {
                $event['value'] = '••••';
            }

            return $event;
        }, $events);
    }

    /**
     * Casa nomes de env var (na ordem em que a IA os declarou) com o valor real
     * dos eventos sensíveis (na mesma ordem em que apareceram na gravação).
     *
     * @param  list<string>  $envVars
     * @param  array<int, array<string, mixed>>  $events
     * @return array<string, string>
     */
    public static function matchEnvValues(array $envVars, array $events): array
    {
        if ($envVars === []) {
            return [];
        }

        $sensitiveValues = array_values(array_filter(
            array_map(
                fn (array $event) => ($event['sensitive'] ?? false) === true ? ($event['value'] ?? '') : null,
                $events,
            ),
            fn ($value) => $value !== null,
        ));

        $result = [];

        foreach ($envVars as $index => $name) {
            $result[$name] = $sensitiveValues[$index] ?? '';
        }

        return $result;
    }

    /**
     * Alerta quando a quantidade de env vars declaradas pela IA não bate com a
     * quantidade de valores sensíveis da gravação — sinal de que algum .env
     * ficaria vazio ou algum valor sensível seria descartado sem aviso.
     *
     * @param  list<string>  $envVars
     * @param  array<int, array<string, mixed>>  $events
     */
    public static function unmatchedEnvWarning(array $envVars, array $events): ?string
    {
        $sensitiveCount = count(array_filter(
            $events,
            fn (array $event): bool => ($event['sensitive'] ?? false) === true,
        ));

        if ($sensitiveCount === 0 || count($envVars) === $sensitiveCount) {
            return null;
        }

        return sprintf(
            'Gravação tem %d valor(es) sensível(is) mas a IA declarou %d env var(s) — algum .env pode ter ficado vazio ou sem escrever.',
            $sensitiveCount,
            count($envVars),
        );
    }
}
