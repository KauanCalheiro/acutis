<?php

use App\Support\AcutisConfig;

it('resolves a relative projects path against the base path', function () {
    config(['acutis.projects.path' => '.acutis']);

    expect(AcutisConfig::resolve()->projectsPath)->toBe(base_path('.acutis'));
});

it('keeps an absolute projects path untouched', function () {
    config(['acutis.projects.path' => '/srv/acutis']);

    expect(AcutisConfig::resolve()->projectsPath)->toBe('/srv/acutis');
});
