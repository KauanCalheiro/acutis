<?php

namespace App\Action;

use App\Support\Project;
use Lorisleiva\Actions\Concerns\AsAction;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class ActivateProjectEnvironment
{
    use AsAction;

    public function handle(string $slug, string $environmentSlug): array
    {
        $environments = Project::make($slug)->environments();

        if (blank($environments->find($environmentSlug))) {
            throw new NotFoundHttpException('Ambiente não encontrado.');
        }

        $environments->activate($environmentSlug);

        return $environments->masked($environmentSlug);
    }
}
