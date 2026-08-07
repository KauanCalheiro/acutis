<?php

namespace App\Providers;

use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void {}

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Teto de 600s por requisição, acima dos 30s que a cli-server herda do php.ini. Fora do
        // console porque `artisan serve` boota a app e vive horas.
        if (! $this->app->runningInConsole()) {
            set_time_limit(600);
        }

        JsonResource::withoutWrapping();
    }
}
