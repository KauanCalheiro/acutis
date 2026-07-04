<?php

namespace App\Http\Controllers\V1;

use App\Action\GenerateAuthSetup;
use App\Data\V1\Auth\AuthSetupData;
use App\Http\Controllers\Controller;
use App\Http\Resources\V1\GeneratedAuthSetupResource;

class AuthSetupController extends Controller
{
    public function store(AuthSetupData $data): GeneratedAuthSetupResource
    {
        return GeneratedAuthSetupResource::make(GenerateAuthSetup::run($data));
    }
}
