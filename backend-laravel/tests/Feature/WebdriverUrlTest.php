<?php

it('defaults the webdriver url to the host port so the local mode reaches it', function () {
    expect(config('acutis.webdriver.url'))->toBe('http://localhost:4000');
});
