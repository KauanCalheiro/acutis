<?php

namespace App\Action;

use App\Support\Project;
use Illuminate\Support\Facades\File;
use Lorisleiva\Actions\Concerns\AsAction;

class DeleteProject
{
    use AsAction;

    public function handle(string $slug): void
    {
        File::deleteDirectory(Project::path($slug));
    }
}
