<?php

namespace App\Action;

use App\Data\V1\Project\ScenarioData;
use Illuminate\Support\Facades\File;
use Lorisleiva\Actions\Concerns\AsAction;

class ListProjectScenarios
{
    use AsAction;

    /** @return list<ScenarioData> */
    public function handle(string $path): array
    {
        if (! File::isDirectory($path.'/tests')) {
            return [];
        }

        return collect(File::glob($path.'/tests/*.spec.ts'))
            ->map(fn (string $spec): ScenarioData => $this->toScenario($path, $spec))
            ->values()
            ->all();
    }

    private function toScenario(string $path, string $spec): ScenarioData
    {
        $name = basename($spec, '.spec.ts');
        $feature = "{$path}/features/{$name}.feature";
        $source = (string) File::get($spec);

        return new ScenarioData(
            title: $this->title($feature, $source, $name),
            spec: "tests/{$name}.spec.ts",
            feature: File::exists($feature) ? "features/{$name}.feature" : null,
            tags: $this->tags($source),
        );
    }

    private function title(string $feature, string $source, string $fallback): string
    {
        if (File::exists($feature) && preg_match('/Funcionalidade:\s*(.+)/u', (string) File::get($feature), $m)) {
            return trim($m[1]);
        }

        if (preg_match('/test\.describe\(\s*[\'"](.+?)[\'"]/u', $source, $m)) {
            return $m[1];
        }

        return $fallback;
    }

    /** @return list<string> */
    private function tags(string $source): array
    {
        if (! preg_match('/tag:\s*\[([^\]]*)\]/', $source, $m)) {
            return [];
        }

        preg_match_all('/@[\w-]+/', $m[1], $tags);

        return $tags[0];
    }
}
