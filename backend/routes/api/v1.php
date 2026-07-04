<?php

use App\Http\Controllers\V1\AuthSetupController;
use App\Http\Controllers\V1\ProjectController;
use App\Http\Controllers\V1\RecordingTestController;
use Illuminate\Support\Facades\Route;

Route::get('projects', [ProjectController::class, 'index']);
Route::post('projects/create/template', [ProjectController::class, 'store']);
Route::post('projects/create/clone', [ProjectController::class, 'clone']);
Route::post('recordings/tests', [RecordingTestController::class, 'store']);
Route::post('auth-setups', [AuthSetupController::class, 'store']);
