<?php

use App\Http\Controllers\V1\ProjectController;
use Illuminate\Support\Facades\Route;

Route::get('projects', [ProjectController::class, 'index']);
Route::post('projects/create/template', [ProjectController::class, 'store']);
Route::post('projects/create/clone', [ProjectController::class, 'clone']);
Route::post('projects/{project}/auth', [ProjectController::class, 'auth']);
Route::post('projects/{project}/tests', [ProjectController::class, 'tests']);
Route::post('projects/{project}/run', [ProjectController::class, 'run']);
Route::get('projects/{project}/run/stream', [ProjectController::class, 'runStream']);
