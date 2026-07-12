<?php

namespace App\Action;

use App\Ai\Agents\AuthRecordingWriter;
use App\Ai\StructuredOutput;
use App\Data\V1\Auth\AuthRecordingData;
use App\Data\V1\Auth\GeneratedAuthSetupData;
use Lorisleiva\Actions\Concerns\AsAction;

class GenerateAuthSetupFromRecording
{
    use AsAction;

    public function handle(AuthRecordingData $input): GeneratedAuthSetupData
    {
        $events = json_encode(
            $input->events,
            JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
        );

        $authSetup = StructuredOutput::field(app(AuthRecordingWriter::class)->prompt(
            "URL base: {$input->baseUrl}\n\nEventos gravados:\n{$events}",
        ), 'authSetup');

        return new GeneratedAuthSetupData(
            authSetup: $authSetup,
            storageCaptured: false,
        );
    }
}
