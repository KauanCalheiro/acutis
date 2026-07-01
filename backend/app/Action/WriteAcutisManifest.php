<?php

namespace App\Action;

use Illuminate\Support\Facades\File;
use Lorisleiva\Actions\Concerns\AsAction;

class WriteAcutisManifest
{
    use AsAction;

    public const VERSION = 1;

    /** @return string O created_at (ISO 8601) gravado no manifesto. */
    public function handle(string $path, string $name, string $slug): string
    {
        $createdAt = now()->toIso8601String();

        File::put($path.'/acutis.json', json_encode([
            'name' => $name,
            'slug' => $slug,
            'created_at' => $createdAt,
            'version' => self::VERSION,
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)."\n");

        return $createdAt;
    }
}
