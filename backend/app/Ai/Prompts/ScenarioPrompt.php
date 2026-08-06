<?php

namespace App\Ai\Prompts;

use App\Data\V1\Recording\RecordingData;
use App\Support\Primitives\Environments;
use App\Support\Primitives\Url;
use App\Support\Recording;

/** O que os escritores de cenário recebem: o Gherkin descreve intenção, o spec a implementa. */
final class ScenarioPrompt
{
    /** Abaixo disso é ritmo de digitação; acima, o usuário esperou a página. */
    private const NOTICEABLE_PAUSE_MS = 2000;

    /** O escritor de Gherkin descreve a intenção do usuário, então não pesa variável nem pausa. */
    public static function gherkin(RecordingData $recording, ?Environments $environments = null): string
    {
        return Payload::encode([
            'baseUrl' => Payload::baseUrl(new Url($recording->baseUrl)),
            'events' => Recording::make($recording->events)->redacted($environments),
        ]);
    }

    public static function spec(RecordingData $recording, string $gherkin, Environments $environments): string
    {
        return Payload::encode([
            'baseUrl' => Payload::baseUrl(new Url($recording->baseUrl)),
            'gherkin' => $gherkin,
            'environment' => Payload::environment($environments),
            'events' => Recording::make($recording->events)->redacted($environments),
            'pauses' => self::pauses($recording->events),
        ]);
    }

    /**
     * Onde o usuário parou entre um evento e o seguinte: ali a página carregava ou hidratava, e o
     * spec precisa esperar a condição antes de agir.
     *
     * @param  list<array<string, mixed>>  $events
     * @return list<array<string, mixed>>
     */
    private static function pauses(array $events): array
    {
        $pauses = [];

        foreach ($events as $index => $event) {
            if ($index === 0) {
                continue;
            }

            $gap = ($event['timestamp'] ?? 0) - ($events[$index - 1]['timestamp'] ?? 0);

            if ($gap < self::NOTICEABLE_PAUSE_MS) {
                continue;
            }

            $pauses[] = [
                'beforeEvent' => $index,
                'seconds' => round($gap / 1000, 1),
                'type' => (string) ($event['type'] ?? ''),
                'target' => (string) ($event['label'] ?? $event['type'] ?? ''),
            ];
        }

        return $pauses;
    }
}
