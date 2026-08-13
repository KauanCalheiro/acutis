<?php

namespace App\Action\Auth;

use App\Support\Project;
use Illuminate\Support\Facades\File;
use Lorisleiva\Actions\Concerns\AsAction;

class SkipProjectAuth
{
    use AsAction;

    public function handle(string $slug): void
    {
        $path = Project::make($slug)->path();
        $manifest = json_decode((string) File::get("{$path}/acutis.json"), true) ?: [];

        $manifest['auth_skipped'] = true;

        File::put(
            "{$path}/acutis.json",
            json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)."\n",
        );
    }
}
