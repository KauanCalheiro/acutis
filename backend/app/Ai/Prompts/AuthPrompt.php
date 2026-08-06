<?php

namespace App\Ai\Prompts;

use App\Data\V1\Auth\AuthRecordingData;
use App\Enums\EnvKey;
use App\Support\Primitives\Environments;
use App\Support\Primitives\Url;
use App\Support\Recording;

/**
 * O que o escritor do login recebe. Credenciais e sessão vão nomeadas, e o caminho pós-login já
 * mastigado: somar o caminho da base ao da URL de destino é onde o agente repetia segmento.
 */
final class AuthPrompt
{
    public static function from(AuthRecordingData $input, Environments $environments): string
    {
        $recording = Recording::make($input->events);

        return Payload::encode([
            'baseUrl' => Payload::baseUrl(new Url($input->baseUrl)),
            'landing' => self::landing($recording->landingUrl()),
            'credentials' => [
                'user' => EnvKey::USER->value,
                'password' => EnvKey::PASSWORD->value,
            ],
            'storageState' => EnvKey::STORAGE_STATE->value,
            'environment' => Payload::environment($environments),
            'events' => $recording->withoutPasswords(),
        ]);
    }

    /**
     * Null quando nenhuma navegação após o submit foi gravada, e aí não há URL a confirmar: o
     * login se confirma pelo sumiço do campo de senha.
     *
     * @return array{url: string, path: string}|null
     */
    private static function landing(?string $url): ?array
    {
        if ($url === null) {
            return null;
        }

        return [
            'url' => $url,
            'path' => parse_url($url, PHP_URL_PATH) ?: '/',
        ];
    }
}
