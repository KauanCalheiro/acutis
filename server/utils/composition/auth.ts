import { DomainEventBus } from '@acutis/core/common/events/domain-event-bus.js'
import { AuthService } from '@acutis/core/modules/auth/auth.service.js'
import { ProjectService } from '@acutis/core/modules/project/project.service.js'
import { AuthUseCases } from '@acutis/core/use-cases/auth/auth.use-cases.js'
import { RunnerService } from '@acutis/core/webdriver/runner/runner.service.js'
import { settingsUseCases } from './settings'

let auth: AuthUseCases | null = null

export async function authUseCases(): Promise<AuthUseCases> {
  if (auth !== null) return auth

  auth = new AuthUseCases(new AuthService(
    new ProjectService(),
    new RunnerService(),
    await settingsUseCases(),
    new DomainEventBus()
  ))

  return auth
}

export function resetAuthUseCases(): void {
  auth = null
}
