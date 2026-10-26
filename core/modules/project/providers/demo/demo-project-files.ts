/** Escreve o projeto de exemplo dentro de um projeto recém-criado: login, cenários, ambiente e rodadas. */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { AUTH_FEATURE, AUTH_SPEC } from '../../../auth/providers/auth.js'
import { EnvKey } from '../../../environment/providers/env-key.js'
import { Environments } from '../../../environment/providers/environments.js'
import { eventsPathOf } from '../../../scenario/providers/scenario.js'
import { Runs } from '../../../scenario/providers/runs.js'
import { SuiteRuns } from '../../../scenario/providers/suite-runs.js'
import { demoAuthRuns, demoRounds } from './demo-history.js'
import {
  DEMO_AUTH,
  DEMO_SCENARIOS,
  SWAG_LABS_PASSWORD,
  SWAG_LABS_URL,
  SWAG_LABS_USER,
  type DemoScenario
} from './swag-labs.js'

function put(projectPath: string, file: string, content: string): void {
  const target = join(projectPath, file)

  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, content)
}

function writeScenario(projectPath: string, scenario: DemoScenario, spec: string, feature: string): void {
  put(projectPath, spec, scenario.playwright)
  put(projectPath, feature, scenario.gherkin)
  put(projectPath, eventsPathOf(spec), `${JSON.stringify(scenario.events, null, 4)}\n`)
}

function writeEnvironment(projectPath: string): void {
  new Environments(projectPath)
    .set(EnvKey.URL, SWAG_LABS_URL)
    .set(EnvKey.USER, SWAG_LABS_USER)
    .set(EnvKey.PASSWORD, SWAG_LABS_PASSWORD, true)
}

function writeHistory(projectPath: string, now: Date): void {
  const rounds = demoRounds(DEMO_SCENARIOS, now)
  const suite = new SuiteRuns(projectPath)
  const auth = new Runs(projectPath, DEMO_AUTH.id)

  for (const run of demoAuthRuns(DEMO_AUTH, rounds)) auth.append(run)

  for (const round of rounds) {
    suite.append(round.suite)

    for (const [id, run] of round.scenarios) new Runs(projectPath, id).append(run)
  }
}

export function writeDemoProjectFiles(projectPath: string, now: Date = new Date()): void {
  writeEnvironment(projectPath)
  writeScenario(projectPath, DEMO_AUTH, AUTH_SPEC, AUTH_FEATURE)

  for (const scenario of DEMO_SCENARIOS) {
    writeScenario(projectPath, scenario, `tests/${scenario.id}.spec.ts`, `features/${scenario.id}.feature`)
  }

  writeHistory(projectPath, now)
}
