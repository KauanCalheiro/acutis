<?php

namespace App\Ai\Prompts;

use App\Enums\EnvKey;
use App\Support\Primitives\Url;

/**
 * As peças que todo payload de agente compartilha. O contexto vai como JSON porque o nome do
 * campo carrega a instrução: `baseUrl.env` sozinho diz qual variável usar, e antes isso era um
 * parágrafo em prosa que o modelo às vezes ignorava.
 */
final class Payload
{
    /** @param  array<array-key, mixed>  $payload */
    public static function encode(array $payload): string
    {
        return json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    /**
     * A URL base junto do nome da variável que a guarda, que é o que impede o modelo de cunhar um
     * nome a partir do rótulo e escrever process.env.BASE_URL.
     *
     * @return array{value: string, env: string}
     */
    public static function baseUrl(Url $base): array
    {
        return ['value' => $base->value, 'env' => EnvKey::URL->value];
    }
}
