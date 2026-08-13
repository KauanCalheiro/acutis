<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * A linha `ai.model` sobrou de uma versão em que o modelo era um só. Hoje são dois, gravados em
 * `ai.model.cheapest` e `ai.model.smartest`, e nada mais lê a antiga.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('settings')->where('key', 'ai.model')->delete();
    }
};
