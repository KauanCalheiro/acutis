<?php

namespace App\Action;

use App\Support\Project;
use Illuminate\Support\Facades\File;
use Lorisleiva\Actions\Concerns\AsAction;

class UpdateProjectAuth
{
    use AsAction;

    public function handle(string $slug, string $authSetup): string
    {
        $path = Project::make($slug)->path();

        File::ensureDirectoryExists("{$path}/tests");
        File::put("{$path}/tests/auth.setup.ts", $authSetup);

        return $authSetup;
    }
}
