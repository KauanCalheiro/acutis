<?php

namespace App\Http\Middleware;

use App\Enums\SettingKey;
use App\Models\Setting;
use Closure;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Põe o provedor e a chave configurados na tela sobre o `config('ai.*')` da requisição.
 *
 * Sem configuração não toca em nada, e aí valem as variáveis de ambiente, que é como o projeto
 * funcionava antes desta tela existir.
 */
class ApplyAiSettings
{
    public function handle(Request $request, Closure $next): Response
    {
        $settings = $this->saved();

        $provider = $settings[SettingKey::AI_PROVIDER->value] ?? null;
        $key = $settings[SettingKey::AI_KEY->value] ?? null;

        if ($provider !== null) {
            config()->set('ai.default', $provider);
        }

        if ($key !== null) {
            config()->set('ai.providers.'.config('ai.default').'.key', $key);
        }

        return $next($request);
    }

    /**
     * Vazio quando a tabela ainda não existe, que é o estado de uma instalação antes do migrate.
     * Sem isso, toda rota da aplicação responderia 500 até alguém rodar a migration.
     *
     * @return array<string, string>
     */
    private function saved(): array
    {
        try {
            return Setting::query()
                ->whereIn('key', [SettingKey::AI_PROVIDER->value, SettingKey::AI_KEY->value])
                ->get()
                ->mapWithKeys(fn (Setting $setting): array => [$setting->key => $setting->value])
                ->all();
        } catch (QueryException) {
            return [];
        }
    }
}
