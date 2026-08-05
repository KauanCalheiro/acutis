<?php

namespace App\Action;

use App\Data\V1\Project\ProjectData;
use App\Support\Project;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Lorisleiva\Actions\Concerns\AsAction;
use RuntimeException;

class CreateProjectFromTemplate
{
    use AsAction;

    public function handle(string $name, string $template = 'playwright-ts'): ProjectData
    {
        $templatePath = base_path("stubs/{$template}");

        if (! File::isDirectory($templatePath)) {
            throw new RuntimeException("Template '{$template}' não encontrado.");
        }

        $slug = Str::slug($name);
        $path = acutis()->projectsPath."/{$slug}";

        File::copyDirectory($templatePath, $path);

        $package = "{$path}/package.json";
        if (File::exists($package)) {
            File::put($package, str_replace('{{name}}', $slug, File::get($package)));
        }

        $createdAt = WriteAcutisManifest::run($path, $name, $slug);

        Project::at($path)->environments()->ensure();

        return new ProjectData(
            name: $name,
            slug: $slug,
            path: $path,
            created_at: $createdAt,
        );
    }
}
