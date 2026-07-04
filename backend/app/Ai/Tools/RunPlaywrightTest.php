<?php

namespace App\Ai\Tools;

use Illuminate\Support\Facades\Http;

class RunPlaywrightTest
{
    public function run(string $spec): PlaywrightRunResult
    {
        $result = Http::timeout(120)
            ->post(acutis()->webdriverUrl.'/runner/spec', ['spec' => $spec])
            ->throw()
            ->json();

        return new PlaywrightRunResult(
            passed: (bool) ($result['passed'] ?? false),
            output: (string) ($result['output'] ?? ''),
        );
    }
}
