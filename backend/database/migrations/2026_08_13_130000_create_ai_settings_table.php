<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Uma linha por provedor de IA, criada já vazia: a tela nunca precisa distinguir "provedor sem
 * cadastro" de "provedor com cadastro em branco". Qual deles está ativo continua em `settings`,
 * numa chave só, e é isso que dispensa garantir "exatamente uma linha ativa" aqui.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_settings', function (Blueprint $table) {
            $table->string('provider')->primary();
            $table->text('key')->nullable();
            $table->string('url')->nullable();
            $table->string('model_cheapest')->nullable();
            $table->string('model_smartest')->nullable();
            $table->timestamps();
        });

        foreach (array_keys(config('ai.providers')) as $provider) {
            DB::table('ai_settings')->insert([
                'provider' => $provider,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $this->carryOver();
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_settings');
    }

    /**
     * O que estava guardado no formato antigo, uma chave global por campo, passa a ser a linha do
     * provedor que estava ativo. Sem isto quem já configurou o acutis reabriria a tela vazio.
     */
    private function carryOver(): void
    {
        $saved = DB::table('settings')
            ->whereIn('key', ['ai.provider', 'ai.key', 'ai.url', 'ai.model.cheapest', 'ai.model.smartest'])
            ->pluck('value', 'key');

        $provider = $saved['ai.provider'] ?? null;

        if ($provider === null) {
            return;
        }

        // A chave viaja cifrada como está: o cast do model novo a decifra do mesmo jeito.
        DB::table('ai_settings')->where('provider', $this->plain($provider))->update([
            'key' => $saved['ai.key'] ?? null,
            'url' => $this->plain($saved['ai.url'] ?? null),
            'model_cheapest' => $this->plain($saved['ai.model.cheapest'] ?? null),
            'model_smartest' => $this->plain($saved['ai.model.smartest'] ?? null),
            'updated_at' => now(),
        ]);

        DB::table('settings')
            ->whereIn('key', ['ai.key', 'ai.url', 'ai.model.cheapest', 'ai.model.smartest'])
            ->delete();
    }

    /** O valor de `settings` sai cifrado do banco; endereço e modelo entram legíveis na tabela nova. */
    private function plain(?string $value): ?string
    {
        return $value === null ? null : (Crypt::decryptString($value) ?: null);
    }
};
