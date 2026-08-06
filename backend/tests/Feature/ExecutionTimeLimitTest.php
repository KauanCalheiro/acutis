<?php

it('lifts the php execution time limit above the ini default', function () {
    expect(ini_get('max_execution_time'))->toBe('300');
});
