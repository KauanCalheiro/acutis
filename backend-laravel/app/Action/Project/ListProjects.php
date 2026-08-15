<?php

namespace App\Action\Project;

use App\Data\V1\Project\ProjectData;
use App\Enums\GitProvider;
use App\Support\Git;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Lorisleiva\Actions\Concerns\AsAction;

class ListProjects
{
    use AsAction;

    private const SORTABLE = ['name', 'slug', 'created_at'];

    /**
     * @param  array<string, string>  $filters
     * @return Collection<int, ProjectData>
     */
    public function handle(array $filters = [], ?string $search = null, ?string $sort = null): Collection
    {
        $base = acutis()->projectsPath;

        if (! File::isDirectory($base)) {
            return collect();
        }

        return collect(File::directories($base))
            ->filter(fn (string $dir): bool => File::exists($dir.'/acutis.json'))
            ->map(fn (string $dir): ProjectData => $this->toProject($dir))
            ->when(filled($filters['name'] ?? null), fn (Collection $c): Collection => $c->filter(
                fn (ProjectData $p): bool => Str::contains(Str::lower($p->name), Str::lower($filters['name']))
            ))
            ->when(filled($filters['slug'] ?? null), fn (Collection $c): Collection => $c->filter(
                fn (ProjectData $p): bool => Str::contains(Str::lower($p->slug), Str::lower($filters['slug']))
            ))
            ->when(filled($search), fn (Collection $c): Collection => $c->filter(
                fn (ProjectData $p): bool => Str::contains(Str::lower($p->name), Str::lower($search))
                    || Str::contains(Str::lower($p->slug), Str::lower($search))
            ))
            ->pipe(fn (Collection $c): Collection => $this->sort($c, $sort))
            ->values();
    }

    private function toProject(string $dir): ProjectData
    {
        $manifest = json_decode((string) File::get($dir.'/acutis.json'), true) ?: [];
        $slug = $manifest['slug'] ?? basename($dir);
        $repository = Git::in($dir)->remoteUrl();

        return new ProjectData(
            name: $manifest['name'] ?? $slug,
            slug: $slug,
            path: $dir,
            repository: $repository,
            provider: GitProvider::fromUrl($repository),
            created_at: $manifest['created_at'] ?? null,
        );
    }

    /**
     * @param  Collection<int, ProjectData>  $projects
     * @return Collection<int, ProjectData>
     */
    private function sort(Collection $projects, ?string $sort): Collection
    {
        $field = ltrim((string) $sort, '-');

        if (! in_array($field, self::SORTABLE, true)) {
            return $projects->sortBy('name');
        }

        return $projects->sortBy($field, SORT_REGULAR, str_starts_with((string) $sort, '-'));
    }
}
