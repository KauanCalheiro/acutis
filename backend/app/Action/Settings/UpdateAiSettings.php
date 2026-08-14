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
     * Sem provedor é a escolha "sem IA": nenhum cadastro é tocado, para religar não pedir a chave
     * de novo, e a partir daí `config('ai.default')` fica vazio e os agentes não são chamados.
     *
     * @return array<string, mixed>
     */
    public function handle(AiSettingsData $data): array
    {
        Setting::set(SettingKey::AI_PROVIDER, (string) $data->provider);

        // O middleware já passou com o provedor anterior: sem isto a resposta anunciaria o antigo.
        config()->set('ai.default', (string) $data->provider);

        if (blank($data->provider)) {
            return ShowAiSettings::run();
        }

        AiSetting::updateOrCreate(['provider' => $data->provider], [
            'key' => $data->key,
            'url' => $data->url,
            'model_cheapest' => $data->modelCheapest,
            'model_smartest' => $data->modelSmartest,
        ]);

        return ShowAiSettings::run();
    }
}
