<?php

namespace App\Support;

use Illuminate\Support\Facades\File;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

final class Project
{
    /** Caminho do projeto pelo slug; 404 se não existir. */
    public static function path(string $slug): string
    {
        $path = acutis()->projectsPath."/{$slug}";

        if (! File::exists($path.'/acutis.json')) {
            throw new NotFoundHttpException('Projeto não encontrado.');
        }

        return $path;
    }

    /** Caminho do projeto no host, pra montar o link vscode://file/. */
    public static function hostPath(string $slug): string
    {
        return acutis()->projectsHostPath."/{$slug}";
    }
}
