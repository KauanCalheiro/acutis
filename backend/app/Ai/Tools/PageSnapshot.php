<?php

namespace App\Ai\Tools;

use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\Http;
use Laravel\Ai\Contracts\Tool;
use Laravel\Ai\Tools\Request;
use Throwable;

/** Os elementos que a página real tem agora, para o seletor sair de lá e não da imaginação. */
final class PageSnapshot implements Tool
{
    public function description(): string
    {
        return 'Abre uma URL e devolve os elementos que a página realmente tem, com testid, papel e rótulo. '
            .'Use antes de escolher um seletor que você não viu nos eventos gravados.';
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'url' => $schema->string()->description('URL da página a capturar.')->required(),
        ];
    }

    public function handle(Request $request): string
    {
        try {
            $snapshot = Http::timeout(60)
                ->post(acutis()->webdriverUrl.'/runner/snapshot', ['url' => (string) $request['url']])
                ->throw()
                ->json();
        } catch (Throwable) {
            return 'Não foi possível capturar a página: o serviço de execução não respondeu.';
        }

        return json_encode($snapshot, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
}
