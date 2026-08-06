<?php

namespace App\Action;

use App\Ai\Agents\AuthRecordingWriter;
use App\Ai\StructuredOutput;
use App\Data\V1\Auth\AuthRecordingData;
use App\Enums\EnvKey;
use App\Support\Recording;
use Lorisleiva\Actions\Concerns\AsAction;

class GenerateAuthSetupFromRecording
{
    use AsAction;

    public function handle(AuthRecordingData $input): string
    {
        $recording = Recording::make($input->events);

        $events = json_encode(
            $recording->withoutPasswords(),
            JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
        );

        $landingUrl = $recording->landingUrl();

        // O caminho vai mastigado: somar o caminho da base ao da URL pós-login é onde o agente repete segmento.
        $landing = $landingUrl
            ? "URL pós-login: {$landingUrl}\nCaminho pós-login (use exatamente este, sem remontar): ".(parse_url($landingUrl, PHP_URL_PATH) ?: '/')
            : 'URL pós-login: nenhuma navegação após o submit foi gravada';

        $key = EnvKey::URL->value;

        return StructuredOutput::field(app(AuthRecordingWriter::class)->prompt(
            "URL base (é a variável {$key}; no arquivo use process.env.{$key}, não o literal): {$input->baseUrl}"
                ."\n{$landing}\n\nEventos gravados:\n{$events}",
        ), 'authSetup');
    }
}
