<?php

namespace App\Action\Project;

use App\Data\V1\Project\ProjectData;
use App\Enums\GitProvider;
use App\Support\Git;
use App\Support\Project;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Lorisleiva\Actions\Concerns\AsAction;

class UpdateProject
{
    use AsAction;

    public function handle(string $slug, string $name): ProjectData
    {
        $path = Project::make($slug)->path();
        $newSlug = Str::slug($name);

        if ($newSlug === '') {
            throw ValidationException::withMessages([
                'name' => 'O nome deve conter ao menos um caractere alfanumérico.',
            ]);
        }

        if ($newSlug !== $slug) {
            $newPath = acutis()->projectsPath."/{$newSlug}";

            if (File::exists($newPath)) {
                throw ValidationException::withMessages([
                    'name' => 'Já existe um projeto com este nome.',
                ]);
            }

            File::moveDirectory($path, $newPath);
            $path = $newPath;
        }

        $manifest = json_decode((string) File::get($path.'/acutis.json'), true) ?: [];
        $manifest['name'] = $name;
        $manifest['slug'] = $newSlug;
        File::put($path.'/acutis.json', json_encode(
            $manifest,
            JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
        )."\n");

        $repository = Git::in($path)->remoteUrl();

        return new ProjectData(
            name: $name,
            slug: $newSlug,
            path: $path,
            repository: $repository,
            provider: GitProvider::fromUrl($repository),
            created_at: $manifest['created_at'] ?? null,
        );
    }
}
