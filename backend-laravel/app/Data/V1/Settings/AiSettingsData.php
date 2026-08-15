<?php

namespace App\Data\V1\Settings;

use App\Models\AiSetting;
use Illuminate\Validation\Rule;
use Spatie\LaravelData\Data;

class AiSettingsData extends Data
{
    /** Provedores que rodam sem credencial nenhuma, e para os quais exigir chave trava o cadastro. */
    private const KEYLESS = ['ollama'];

    /** Provedor nulo é a escolha "sem IA": o `ConvertEmptyStringsToNull` traz assim o campo vazio. */
    public function __construct(
        public ?string $provider,
        public ?string $key = null,
        public ?string $url = null,
        public ?string $modelCheapest = null,
        public ?string $modelSmartest = null,
    ) {}

    public static function rules(): array
    {
        return [
            'provider' => ['present', 'nullable', 'string', Rule::in(array_keys(config('ai.providers')))],
            'key' => [Rule::requiredIf(self::needsKey(...)), 'nullable', 'string'],
            'url' => ['nullable', 'string', 'url'],
            'modelCheapest' => ['nullable', 'string'],
            'modelSmartest' => ['nullable', 'string'],
        ];
    }

    /**
     * Provedor que fala com serviço de terceiro precisa de chave para funcionar, e ficar ativo sem
     * ela só produziria 401 na primeira geração. Provedor local não tem o que pedir, e "sem IA"
     * não tem provedor nenhum a quem pedir.
     */
    private static function needsKey(): bool
    {
        $provider = (string) request('provider');

        return filled($provider)
            && ! in_array($provider, self::KEYLESS, true)
            && blank(request('key'))
            && blank(AiSetting::find($provider)?->key);
    }

    public static function messages(): array
    {
        return [
            'provider.present' => 'O provedor é obrigatório.',
            'provider.in' => 'Provedor não suportado.',
            'key.required' => 'A chave de API do provedor escolhido é obrigatória.',
            'url.url' => 'A URL do provedor deve ser uma URL válida.',
        ];
    }
}
