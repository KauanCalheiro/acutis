<?php

namespace App\Action;

use App\Support\Project;
use Lorisleiva\Actions\Concerns\AsAction;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class DeleteProjectEnvironment
{
    use AsAction;

    public function handle(string $slug, string $environmentSlug): void
    {
        $environments = Project::make($slug)->environments();

        if (blank($environments->find($environmentSlug))) {
            throw new NotFoundHttpException('Ambiente não encontrado.');
        }

        $environments->forget($environmentSlug);
    }
}
