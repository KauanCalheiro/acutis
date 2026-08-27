/** O que todo teste de endpoint precisa: um diretório de projetos só dele e um app H3 de pé. */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createApp,
  createRouter,
  defineEventHandler,
  send,
  sendNoContent,
  getRouterParam,
  setResponseStatus,
  toNodeListener,
  type EventHandler
} from 'h3'
import supertest from 'supertest'
import { DataSource } from 'typeorm'
import { SettingsService } from '../../core/modules/settings/settings.service.js'
import { ScenarioService } from '../../core/modules/scenario/scenario.service.js'
import { RunnerService } from '../../core/webdriver/runner/runner.service.js'
import { RecorderService } from '../../core/webdriver/recorder/recorder.service.js'
import { VideoService } from '../../core/webdriver/video/video.service.js'
import { scenarioFixRequestSchema } from '../../shared/contracts/scenario.js'
import { closeSettings, settingsDataSource, settingsUseCases } from '../../server/utils/composition/settings.js'
import { scenarioUseCases } from '../../server/utils/composition/scenario.js'
import { recorderService, videoService } from '../../server/utils/composition/recorder.js'
import { generationUseCases } from '../../server/utils/composition/generation.js'
import { resetAuthUseCases } from '../../server/utils/composition/auth.js'
import { execute, validatedBody } from '../../server/utils/http.js'
import {
  configureExecutionRunner,
  resetExecutionRunner
} from '../../server/utils/composition/execution.js'

import projectsIndex from '../../server/api/projects/index.get.js'
import projectsCreate from '../../server/api/projects/index.post.js'
import projectsClone from '../../server/api/projects/clone.post.js'
import projectsProbe from '../../server/api/projects/probe.post.js'
import projectShow from '../../server/api/projects/[slug].get.js'
import projectUpdate from '../../server/api/projects/[slug].put.js'
import projectDestroy from '../../server/api/projects/[slug].delete.js'
import environmentsIndex from '../../server/api/projects/[slug]/environments/index.get.js'
import environmentsCreate from '../../server/api/projects/[slug]/environments/index.post.js'
import environmentUpdate from '../../server/api/projects/[slug]/environments/[environment].put.js'
import environmentDestroy from '../../server/api/projects/[slug]/environments/[environment].delete.js'
import environmentActivate from '../../server/api/projects/[slug]/environments/[environment]/activate.post.js'
import authShow from '../../server/api/projects/[slug]/auth.get.js'
import authUpdate from '../../server/api/projects/[slug]/auth.put.js'
import authSkip from '../../server/api/projects/[slug]/auth/skip.post.js'
import authRecord from '../../server/api/projects/[slug]/auth/record.post.js'
import authCredentials from '../../server/api/projects/[slug]/auth/credentials.post.js'
import projectSettings from '../../server/api/projects/[slug]/settings.put.js'
import projectSettingsSkip from '../../server/api/projects/[slug]/settings/skip.post.js'
import scenarioShow from '../../server/api/projects/[slug]/scenarios/[...scenario].get.js'
import scenarioUpdate from '../../server/api/projects/[slug]/scenarios/[...scenario].patch.js'
import scenarioDestroy from '../../server/api/projects/[slug]/scenarios/[...scenario].delete.js'
import scenarioFix from '../../server/api/projects/[slug]/scenario-fix.post.js'
import scenarioSkip from '../../server/api/projects/[slug]/scenario-skip.patch.js'
import scenarioSuggestions from '../../server/api/projects/[slug]/scenario-suggestions.post.js'
import testsGenerate from '../../server/api/projects/[slug]/tests.post.js'
import testsDraft from '../../server/api/projects/[slug]/tests/draft.post.js'
import projectRun from '../../server/api/projects/[slug]/run.post.js'
import projectRunStream from '../../server/api/projects/[slug]/run-stream.get.js'
import settingsShow from '../../server/api/settings/ai.get.js'
import settingsUpdate from '../../server/api/settings/ai.put.js'
import settingsModels from '../../server/api/settings/ai/models.post.js'
import settingsPing from '../../server/api/settings/ai/ping.post.js'
import recordingShow from '../../server/routes/recording/[id].get.js'
import recordingDestroy from '../../server/routes/recording/[id].delete.js'
import projectReport from '../../server/api/projects/[slug]/report/[...path].get.js'
import runnerSpec from '../../server/routes/runner/spec.post.js'
import runnerProject from '../../server/routes/runner/project.post.js'
import runnerProjectStream from '../../server/routes/runner/project/stream.post.js'
import runnerVideo from '../../server/routes/runner/video.get.js'

export interface Harness {
  root: string
  http: ReturnType<typeof supertest>
  get: <T>(token: unknown) => T
  projectPath: (slug: string) => string
  close: () => Promise<void>
}

export interface Override {
  provide: unknown
  value: unknown
}

interface LegacyProvider {
  provide?: unknown
  useValue?: unknown
}

interface LegacyModule {
  providers?: LegacyProvider[]
}

function created(handler: EventHandler): EventHandler {
  return defineEventHandler((event) => {
    setResponseStatus(event, 201)
    return handler(event)
  })
}

function noContent(handler: EventHandler): EventHandler {
  return defineEventHandler(async (event) => {
    await handler(event)
    sendNoContent(event, 204)
  })
}

function legacyProviders(extra: unknown[]): Override[] {
  return extra.flatMap((entry) => {
    const providers = (entry as LegacyModule | undefined)?.providers ?? []
    return providers
      .filter(provider => provider.provide !== undefined && provider.useValue !== undefined)
      .map(provider => ({ provide: provider.provide, value: provider.useValue }))
  })
}

function mountRoutes() {
  const router = createRouter()
  const legacyScenarioFix = defineEventHandler(async (event) => {
    await validatedBody(event, scenarioFixRequestSchema)
    const useCases = await generationUseCases()

    return execute(() => useCases.scenarios.fix(
      getRouterParam(event, 'slug') ?? '',
      getRouterParam(event, 'scenario') ?? ''
    ))
  })
  const legacyScenarioSuggestions = defineEventHandler(async (event) => {
    const useCases = await generationUseCases()

    return execute(() => useCases.scenarios.suggestions(
      getRouterParam(event, 'slug') ?? '',
      getRouterParam(event, 'scenario') ?? ''
    ))
  })

  router.get('/api/v1/projects', projectsIndex)
  router.post('/api/v1/projects/create/template', created(projectsCreate))
  router.post('/api/v1/projects/create/clone', created(projectsClone))
  router.post('/api/v1/projects/probe', projectsProbe)
  router.get('/api/v1/projects/:slug', projectShow)
  router.put('/api/v1/projects/:slug', projectUpdate)
  router.delete('/api/v1/projects/:slug', projectDestroy)
  router.get('/api/v1/projects/:slug/report/**:path', projectReport)
  router.get('/api/v1/projects/:slug/report/', projectReport)

  router.get('/api/v1/projects/:slug/environments', environmentsIndex)
  router.post('/api/v1/projects/:slug/environments', created(environmentsCreate))
  router.put('/api/v1/projects/:slug/environments/:environment', environmentUpdate)
  router.delete('/api/v1/projects/:slug/environments/:environment', environmentDestroy)
  router.post('/api/v1/projects/:slug/environments/:environment/activate', environmentActivate)

  router.get('/api/v1/projects/:slug/auth', authShow)
  router.put('/api/v1/projects/:slug/auth', authUpdate)
  router.post('/api/v1/projects/:slug/auth/skip', noContent(authSkip))
  router.post('/api/v1/projects/:slug/auth/record', authRecord)
  router.post('/api/v1/projects/:slug/auth/credentials', noContent(authCredentials))
  router.put('/api/v1/projects/:slug/settings', projectSettings)
  router.post('/api/v1/projects/:slug/settings/skip', noContent(projectSettingsSkip))

  router.get('/api/v1/projects/:slug/scenarios/**:scenario', scenarioShow)
  router.patch('/api/v1/projects/:slug/scenarios/**:scenario', scenarioUpdate)
  router.delete('/api/v1/projects/:slug/scenarios/**:scenario', scenarioDestroy)
  router.post('/api/v1/projects/:slug/scenarios/:scenario/fix', legacyScenarioFix)
  router.post('/api/v1/projects/:slug/scenarios/:scenario/suggestions', legacyScenarioSuggestions)
  router.patch('/api/v1/projects/:slug/scenario-skip', scenarioSkip)
  router.post('/api/v1/projects/:slug/scenario-fix', scenarioFix)
  router.post('/api/v1/projects/:slug/scenario-suggestions', scenarioSuggestions)
  router.post('/api/v1/projects/:slug/tests', testsGenerate)
  router.post('/api/v1/projects/:slug/tests/draft', testsDraft)

  router.post('/api/v1/projects/:slug/run', projectRun)
  router.get('/api/v1/projects/:slug/run/stream', projectRunStream)

  router.get('/api/v1/settings/ai', settingsShow)
  router.put('/api/v1/settings/ai', settingsUpdate)
  router.post('/api/v1/settings/ai/models', settingsModels)
  router.post('/api/v1/settings/ai/ping', settingsPing)
  router.get('/recording/:id', recordingShow)
  router.delete('/recording/:id', recordingDestroy)
  router.post('/runner/spec', runnerSpec)
  router.post('/runner/project', runnerProject)
  router.post('/runner/project/stream', runnerProjectStream)
  router.get('/runner/video', runnerVideo)

  return router
}

export async function startApi(
  extra: unknown[] = [],
  overrides: Override[] = [],
  existingRoot?: string
): Promise<Harness> {
  const root = existingRoot ?? mkdtempSync(join(tmpdir(), 'acutis-test-'))
  const previousRoot = process.env.ACUTIS_PROJECTS_PATH
  const providers = [...legacyProviders(extra), ...overrides]

  process.env.ACUTIS_PROJECTS_PATH = root

  const runner = providers.find(override => override.provide === RunnerService)?.value
  if (runner) configureExecutionRunner(runner as RunnerService)

  const settings = await settingsUseCases()
  const healthRecorder = providers.find(override => override.provide === RecorderService)?.value as
    | Pick<RecorderService, 'isRecording'>
    | undefined
  const app = createApp({
    onError: async (error, event) => {
      setResponseStatus(event, error.statusCode)
      const data = error.data && typeof error.data === 'object' ? error.data : {}
      await send(event, JSON.stringify({
        message: (data as { message?: string }).message ?? error.message,
        ...data
      }), 'application/json')
    }
  })
  const router = mountRoutes()

  router.get('/health', defineEventHandler(() => ({
    ok: true,
    recording: (healthRecorder ?? recorderService).isRecording()
  })))
  app.use(router)

  const registry = new Map<unknown, unknown>([
    [SettingsService, settings],
    [DataSource, settingsDataSource()],
    [ScenarioService, scenarioUseCases()],
    [VideoService, videoService],
    ...providers.map(override => [override.provide, override.value] as [unknown, unknown])
  ])

  return {
    root,
    http: supertest(toNodeListener(app)),
    get: <T>(token: unknown) => registry.get(token) as T,
    projectPath: (slug: string) => join(root, slug),
    close: async () => {
      resetExecutionRunner()
      resetAuthUseCases()
      await closeSettings()
      rmSync(root, { recursive: true, force: true })

      if (previousRoot === undefined) delete process.env.ACUTIS_PROJECTS_PATH
      else process.env.ACUTIS_PROJECTS_PATH = previousRoot
    }
  }
}
