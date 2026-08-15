<?php

namespace App\Ai\Prompts;

use App\Data\V1\Recording\RecordingData;
use App\Support\Primitives\Environments;
use App\Support\Primitives\Url;
use App\Support\Recording;

/** O que o escritor de Gherkin recebe: a intenção do usuário sai da gravação, não do spec. */
final class ScenarioPrompt
{
    public static function gherkin(RecordingData $recording, ?Environments $environments = null): string
    {
        return Payload::encode([
            'baseUrl' => Payload::baseUrl(new Url($recording->baseUrl)),
            'events' => Recording::make($recording->events)->redacted($environments),
        ]);
    }
}
