<?php

use App\Http\Controllers\V1\ProjectController;
use Illuminate\Support\Facades\Route;

Route::get('projects', [ProjectController::class, 'index']);
Route::post('projects/create/template', [ProjectController::class, 'store']);
Route::post('projects/create/clone', [ProjectController::class, 'clone']);
