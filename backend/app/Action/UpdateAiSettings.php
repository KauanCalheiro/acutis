<?php

namespace App\Action;

use App\Data\V1\Settings\AiSettingsData;
use App\Enums\SettingKey;
use App\Models\Setting;
use Lorisleiva\Actions\Concerns\AsAction;

class UpdateAiSettings
{
    use AsAction;

    /**
     * A chave vazia mantém a que está guardada, que é o caso de salvar o mesmo provedor sem
     * digitar tudo de novo. Trocar de provedor sem chave a validação já barra.
     *
     * @return array{provider: string, key_set: bool, providers: list<string>}
     */
    public function handle(AiSettingsData $data): array
    {
        Setting::set(SettingKey::AI_PROVIDER, $data->provider);

        if (filled($data->key)) {
            Setting::set(SettingKey::AI_KEY, $data->key);
        }

        return ShowAiSettings::run();
    }
}
