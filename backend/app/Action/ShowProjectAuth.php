<?php

namespace App\Action;

use App\Support\Project;
use Illuminate\Support\Facades\File;
use Lorisleiva\Actions\Concerns\AsAction;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class ShowProjectAuth
{
    use AsAction;

    public function handle(string $slug): string
    {
        $path = Project::make($slug)->path();
        $file = "{$path}/tests/auth.setup.ts";

        if (! File::exists($file)) {
            throw new NotFoundHttpException('Autenticação não configurada.');
        }

        return File::get($file);
    }
}
