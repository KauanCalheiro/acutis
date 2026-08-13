<?php

namespace App\Ai\Prompts;

use App\Data\V1\Auth\AuthRecordingData;
use App\Support\Primitives\Url;
use App\Support\Recording;

/** O login vira Gherkin como qualquer cenário, e o escritor dele só precisa da URL base e dos eventos. */
final class AuthPrompt
{
    public static function gherkin(AuthRecordingData $input, Recording $recording): string
    {
        return Payload::encode([
            'baseUrl' => Payload::baseUrl(new Url($input->baseUrl)),
            'events' => $recording->withoutPasswords(),
        ]);
    }
}
