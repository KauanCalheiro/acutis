<?php

namespace App\Http\Middleware;

use App\Enums\SettingKey;
use App\Models\AiSetting;
use App\Models\Setting;
use Closure;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Põe o cadastro do provedor ativo sobre o `config('ai.*')` da requisição.
 *
 * Sem cadastro não toca em nada, e aí valem as variáveis de ambiente, que é como o projeto
 * funcionava antes desta tela existir. Campo em branco também não escreve: é assim que o default
 * do provedor volta a valer depois de alguém ter apontado para outro lugar.
 */
class ApplyAiSettings
{
    public function handle(Request $request, Closure $next): Response
    {
        $this->rememberDefaultUrls();

        $provider = $this->activeProvider();

        if ($provider !== null) {
            config()->set('ai.default', $provider);
        }

        $active = config('ai.default');
        $credential = $this->credentialOf($active);

        if ($credential === null) {
            return $next($request);
        }

        $this->apply($credential->key, "ai.providers.{$active}.key");
        $this->apply($credential->url, "ai.providers.{$active}.url");
        $this->apply($credential->model_cheapest, "ai.providers.{$active}.models.text.cheapest");
        $this->apply($credential->model_smartest, "ai.providers.{$active}.models.text.smartest");

        return $next($request);
    }

    /**
     * O endereço que cada provedor usa sem cadastro, copiado antes de qualquer sobrescrita. O
     * cadastro do provedor ativo entra por cima em `ai.providers.<ativo>.url`, e sem esta cópia a
     * tela anunciaria como padrão justamente o endereço que o usuário acabou de gravar.
     */
    private function rememberDefaultUrls(): void
    {
        config()->set('ai.provider_urls', collect(config('ai.providers'))
            ->map(fn (array $provider): ?string => $provider['url'] ?? null)
            ->filter()
            ->all());
    }

    private function apply(?string $value, string $path): void
    {
        if (filled($value)) {
            config()->set($path, $value);
        }
    }

    /**
     * Null quando a tabela ainda não existe, que é o estado de uma instalação antes do migrate.
     * Sem isso, toda rota da aplicação responderia 500 até alguém rodar a migration.
     */
    private function activeProvider(): ?string
    {
        try {
            return Setting::get(SettingKey::AI_PROVIDER);
        } catch (QueryException) {
            return null;
        }
    }

    private function credentialOf(string $provider): ?AiSetting
    {
        try {
            return AiSetting::find($provider);
        } catch (QueryException) {
            return null;
        }
    }
}
