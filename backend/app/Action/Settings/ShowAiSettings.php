<?php

namespace App\Action\Settings;

use App\Ai\Provider;
use App\Models\AiSetting;
use Lorisleiva\Actions\Concerns\AsAction;

class ShowAiSettings
{
    use AsAction;

    /** @return array<string, mixed> */
    public function handle(): array
    {
        return [
            'provider' => Provider::active(),
            'configured' => Provider::configured(),
            'credentials' => $this->credentials(),
            'providers' => array_keys(config('ai.providers')),
            'provider_urls' => $this->defaultUrls(),
        ];
    }

    /**
     * O cadastro de cada provedor, chave inclusive. Ela volta para a tela de propósito: o acutis
     * roda na máquina de quem o usa, sem multiusuário, e conferir a chave que está guardada vale
     * mais do que esconder de quem a digitou. A tela a mostra mascarada, com botão de revelar.
     *
     * @return array<string, array<string, string|null>>
     */
    private function credentials(): array
    {
        return AiSetting::all()
            ->mapWithKeys(fn (AiSetting $credential): array => [
                $credential->provider => [
                    'key' => $credential->key,
                    'url' => $credential->url,
                    'model_cheapest' => $credential->model_cheapest,
                    'model_smartest' => $credential->model_smartest,
                ],
            ])
            ->all();
    }

    /**
     * O endereço que cada provedor usa quando ninguém informa um. A tela mostra como placeholder,
     * para o campo vazio dizer o que vai valer em vez de deixar adivinhar.
     *
     * Vem da cópia que o `ApplyAiSettings` guarda antes de pôr o cadastro por cima: ler de
     * `ai.providers` aqui devolveria o endereço salvo disfarçado de padrão.
     *
     * @return array<string, string>
     */
    private function defaultUrls(): array
    {
        return config('ai.provider_urls', []);
    }
}
