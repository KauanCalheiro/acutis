<?php

namespace App\Action\Settings;

use App\Data\V1\Settings\AiSettingsData;
use App\Enums\SettingKey;
use App\Models\AiSetting;
use App\Models\Setting;
use Lorisleiva\Actions\Concerns\AsAction;

class UpdateAiSettings
{
    use AsAction;

    /**
     * Grava o cadastro no provedor escolhido e o torna o ativo. Campo em branco é gravado em
     * branco: a tela devolve o que está guardado, então apagar na tela é ordem de apagar.
     *
     * @return array<string, mixed>
     */
    public function handle(AiSettingsData $data): array
    {
        Setting::set(SettingKey::AI_PROVIDER, $data->provider);

        AiSetting::updateOrCreate(['provider' => $data->provider], [
            'key' => $data->key,
            'url' => $data->url,
            'model_cheapest' => $data->modelCheapest,
            'model_smartest' => $data->modelSmartest,
        ]);

        return ShowAiSettings::run();
    }
}
