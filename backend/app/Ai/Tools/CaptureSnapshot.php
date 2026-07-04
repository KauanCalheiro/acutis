<?php

namespace App\Ai\Tools;

use Illuminate\Support\Facades\Http;

class CaptureSnapshot
{
    public function capture(string $url): string
    {
        $snapshot = Http::timeout(60)
            ->post(acutis()->webdriverUrl.'/runner/snapshot', ['url' => $url])
            ->throw()
            ->json();

        return json_encode(
            $snapshot,
            JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
        );
    }
}
