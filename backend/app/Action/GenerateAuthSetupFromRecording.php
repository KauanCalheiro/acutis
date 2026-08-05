<?php

namespace App\Action;

use App\Ai\Agents\AuthRecordingWriter;
use App\Ai\StructuredOutput;
use App\Data\V1\Auth\AuthRecordingData;
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

        $landingUrl = $recording->landingUrl() ?? 'nenhuma navegação após o submit foi gravada';

        return StructuredOutput::field(app(AuthRecordingWriter::class)->prompt(
            "URL base: {$input->baseUrl}\nURL pós-login: {$landingUrl}\n\nEventos gravados:\n{$events}",
        ), 'authSetup');
    }
}
