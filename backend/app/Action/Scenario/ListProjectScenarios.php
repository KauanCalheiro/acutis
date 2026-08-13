<?php

namespace App\Action\Scenario;

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

        $specs = [
            ...File::glob($path.'/tests/*.spec.ts'),
            ...File::glob($path.'/tests/*/*.spec.ts'),
        ];

        return collect($specs)
            ->map(fn (string $spec): ScenarioData => $this->toScenario($path, $spec))
            ->values()
            ->all();
    }

    private function toScenario(string $path, string $spec): ScenarioData
    {
        $relativeDir = trim(str_replace("{$path}/tests", '', dirname($spec)), '/');
        $domain = $relativeDir === '' ? null : $relativeDir;
        $name = basename($spec, '.spec.ts');
        $specRelative = $domain === null ? "{$name}.spec.ts" : "{$domain}/{$name}.spec.ts";
        $featureRelative = $domain === null ? "{$name}.feature" : "{$domain}/{$name}.feature";
        $feature = "{$path}/features/{$featureRelative}";
        $source = (string) File::get($spec);

        return new ScenarioData(
            title: $this->title($feature, $source, $name),
            spec: "tests/{$specRelative}",
            feature: File::exists($feature) ? "features/{$featureRelative}" : null,
            tags: $this->tags($source),
            domain: $domain,
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
