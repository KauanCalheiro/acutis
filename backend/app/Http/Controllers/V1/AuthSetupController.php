<?php

namespace App\Http\Controllers\V1;

use App\Action\GenerateAuthSetup;
use App\Data\V1\Auth\AuthSetupData;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class AuthSetupController extends Controller
{
    public function store(AuthSetupData $data): JsonResponse
    {
        return response()->json(GenerateAuthSetup::run($data));
    }
}
