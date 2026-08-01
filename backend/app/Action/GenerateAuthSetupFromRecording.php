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
        $events = json_encode(
            Recording::make($input->events)->withoutPasswords(),
            JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
        );

        return StructuredOutput::field(app(AuthRecordingWriter::class)->prompt(
            "URL base: {$input->baseUrl}\n\nEventos gravados:\n{$events}",
        ), 'authSetup');
    }
}
