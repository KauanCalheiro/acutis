import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as z from 'zod'
import * as auth from '../../shared/contracts/auth'
import * as environment from '../../shared/contracts/environment'
import * as generation from '../../shared/contracts/generation'
import * as git from '../../shared/contracts/git'
import * as project from '../../shared/contracts/project'
import * as recording from '../../shared/contracts/recording'
import * as scenario from '../../shared/contracts/scenario'
import * as settings from '../../shared/contracts/settings'

const modules = { auth, environment, generation, git, project, recording, scenario, settings }
const root = resolve(import.meta.dirname, '../..')

describe('internal contracts', () => {
  it.each(Object.entries(modules))('keeps every runtime export from %s as a usable schema', (_name, contracts) => {
    expect(Object.keys(contracts).length).toBeGreaterThan(0)

    for (const schema of Object.values(contracts)) {
      expect(schema).toHaveProperty('safeParse')
      expect(() => z.toJSONSchema(schema as z.ZodType)).not.toThrow()
    }
  })

  it('does not depend on a contracts workspace package', () => {
    const workspace = readFileSync(resolve(root, 'pnpm-workspace.yaml'), 'utf8')

    expect(workspace).not.toMatch(/^\s*- contracts\s*$/m)
    expect(existsSync(resolve(root, 'contracts'))).toBe(false)
  })
})
