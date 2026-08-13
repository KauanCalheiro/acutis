<?php

namespace App\Http\Controllers\V1;

use App\Action\Settings\ShowAiSettings;
use App\Action\Settings\UpdateAiSettings;
use App\Data\V1\Settings\AiSettingsData;
use App\Http\Controllers\Controller;
use App\Http\Resources\V1\AiSettingsResource;

class SettingsController extends Controller
{
    public function showAi(): AiSettingsResource
    {
        return AiSettingsResource::make(ShowAiSettings::run());
    }

    public function updateAi(AiSettingsData $data): AiSettingsResource
    {
        return AiSettingsResource::make(UpdateAiSettings::run($data));
    }
}
