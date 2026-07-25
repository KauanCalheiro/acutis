<?php

use App\Http\Controllers\V1\ProjectController;
use Illuminate\Support\Facades\Route;

Route::get('projects', [ProjectController::class, 'index']);
Route::post('projects/create/template', [ProjectController::class, 'store']);
Route::post('projects/create/clone', [ProjectController::class, 'clone']);
Route::post('projects/probe', [ProjectController::class, 'probe']);
Route::get('projects/{project}', [ProjectController::class, 'show']);
Route::put('projects/{project}', [ProjectController::class, 'update']);
Route::delete('projects/{project}', [ProjectController::class, 'destroy']);
Route::get('projects/{project}/auth', [ProjectController::class, 'showAuth']);
Route::post('projects/{project}/auth', [ProjectController::class, 'auth']);
Route::put('projects/{project}/auth', [ProjectController::class, 'updateAuth']);
Route::post('projects/{project}/auth/skip', [ProjectController::class, 'skipAuth']);
Route::post('projects/{project}/auth/record', [ProjectController::class, 'recordAuth']);
Route::post('projects/{project}/tests/draft', [ProjectController::class, 'testsDraft']);
Route::post('projects/{project}/tests', [ProjectController::class, 'tests']);
Route::post('projects/{project}/run', [ProjectController::class, 'run']);
Route::get('projects/{project}/run/stream', [ProjectController::class, 'runStream']);
Route::get('projects/{project}/scenarios/{scenario}', [ProjectController::class, 'showScenario'])
    ->where('scenario', '.*');
Route::delete('projects/{project}/scenarios/{scenario}', [ProjectController::class, 'destroyScenario'])
    ->where('scenario', '.*');
Route::patch('projects/{project}/scenarios/{scenario}', [ProjectController::class, 'updateScenario'])
    ->where('scenario', '.*');
Route::post('projects/{project}/scenarios/{scenario}/suggestions', [ProjectController::class, 'suggestScenarioSelectors'])
    ->where('scenario', '.*');
Route::post('projects/{project}/scenarios/{scenario}/fix', [ProjectController::class, 'fixScenario'])
    ->where('scenario', '.*');
