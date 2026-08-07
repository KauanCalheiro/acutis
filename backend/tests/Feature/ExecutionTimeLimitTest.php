<?php

/**
 * O teto vale para requisição, não para processo de console: `artisan serve` boota a app e vive
 * horas, e um limite nele mata o servidor de desenvolvimento no meio do expediente.
 */
it('leaves the time limit of a console process alone', function () {
    expect(ini_get('max_execution_time'))->toBe('0');
});
