<?php

namespace App\Ai\Prompts;

use App\Data\V1\Project\EnvironmentVarData;
use App\Enums\EnvKey;
use App\Support\Primitives\Environments;
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

    /**
     * Chave e valor do que não é segredo, só a chave do que é. O valor vai para o modelo decidir
     * qual variável usar; escrevê-lo literal no spec é violação, então mandá-lo é seguro.
     *
     * @return list<array<string, mixed>>
     */
    public static function environment(Environments $environments): array
    {
        return array_map(
            fn (EnvironmentVarData $var): array => $var->secret
                ? ['key' => $var->key, 'secret' => true]
                : ['key' => $var->key, 'value' => (string) $var->value],
            $environments->vars,
        );
    }
}
