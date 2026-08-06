<?php

use App\Ai\Agents\Auth\AuthFixer;
use App\Ai\Agents\Auth\AuthWriter;
use App\Ai\Agents\Scenario\ScenarioFixer;
use App\Ai\Agents\Scenario\ScenarioWriter;
use App\Ai\Limits;
use Laravel\Ai\Attributes\MaxSteps;

it('gives every writing agent the shared step ceiling', function (string $agent) {
    $attributes = (new ReflectionClass($agent))->getAttributes(MaxSteps::class);

    expect($attributes)->not->toBeEmpty()
        ->and($attributes[0]->newInstance()->value)->toBe(Limits::STEPS);
})->with([
    AuthWriter::class,
    AuthFixer::class,
    ScenarioWriter::class,
    ScenarioFixer::class,
]);

it('keeps the step ceiling at the value the agents were tuned for', function () {
    expect(Limits::STEPS)->toBe(35);
});
