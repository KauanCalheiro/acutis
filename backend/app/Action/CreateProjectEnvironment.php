<?php

namespace App\Action;

use App\Support\Project;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Lorisleiva\Actions\Concerns\AsAction;

class CreateProjectEnvironment
{
    use AsAction;

    public function handle(string $slug, string $name): array
    {
        $environments = Project::make($slug)->environments()->ensure();
        $environmentSlug = Str::slug($name);

        if (filled($environments->find($environmentSlug))) {
            throw ValidationException::withMessages(['name' => 'Já existe um ambiente com esse nome.']);
        }

        $environments->put($environmentSlug, $name, $environments->declaredKeys());

        return $environments->displayed($environmentSlug);
    }
}
