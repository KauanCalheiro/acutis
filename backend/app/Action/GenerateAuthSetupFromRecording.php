<?php

namespace App\Action;

use App\Ai\Agents\AuthRecordingWriter;
use App\Ai\StructuredOutput;
use App\Data\V1\Auth\AuthRecordingData;
use App\Data\V1\Auth\GeneratedAuthSetupData;
use App\Support\SessionState;
use Lorisleiva\Actions\Concerns\AsAction;

class GenerateAuthSetupFromRecording
{
    use AsAction;

    public function handle(AuthRecordingData $input): GeneratedAuthSetupData
    {
        $events = json_encode(
            $this->redactPasswordValues($input->events),
            JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
        );

        $authSetup = StructuredOutput::field(app(AuthRecordingWriter::class)->prompt(
            "URL base: {$input->baseUrl}\n\nEventos gravados:\n{$events}",
        ), 'authSetup');

        $captured = SessionState::hasSession($input->storageState);

        return new GeneratedAuthSetupData(
            authSetup: $authSetup,
            storageCaptured: $captured,
            storageState: $captured ? $input->storageState : null,
        );
    }

    /**
     * A senha real chega até o backend (necessária para extrair credenciais reais para o .env do
     * projeto), mas não precisa — e não deve — ser enviada ao provedor de IA. O evento continua
     * identificável pelo inputType, então a IA ainda reconhece o campo de senha normalmente.
     */
    private function redactPasswordValues(array $events): array
    {
        return array_map(function (array $event): array {
            if (($event['inputType'] ?? null) === 'password') {
                $event['value'] = '••••';
            }

            return $event;
        }, $events);
    }
}
