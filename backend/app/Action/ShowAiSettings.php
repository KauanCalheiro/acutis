<?php

namespace App\Action;

use App\Enums\SettingKey;
use App\Models\Setting;
use Lorisleiva\Actions\Concerns\AsAction;

class ShowAiSettings
{
    use AsAction;

    /** @return array{provider: string, key_set: bool, providers: list<string>} */
    public function handle(): array
    {
        return [
            'provider' => Setting::get(SettingKey::AI_PROVIDER) ?? config('ai.default'),
            'key_set' => Setting::get(SettingKey::AI_KEY) !== null,
            'providers' => array_keys(config('ai.providers')),
        ];
    }
}
