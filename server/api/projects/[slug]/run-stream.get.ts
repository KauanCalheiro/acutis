import { createEventStream, defineEventHandler, getQuery, getRouterParam } from 'h3'
import { executionUseCases } from '../../../utils/composition/execution'
import { execute } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  const execution = executionUseCases()
  const slug = getRouterParam(event, 'slug') ?? ''
  const query = getQuery(event)
  const string = (key: string) => typeof query[key] === 'string' ? query[key] as string : undefined

  await execute(() => execution.projects.pathOf(slug))

  const stream = createEventStream(event)

  void (async () => {
    let finished: unknown = null
    let writes = Promise.resolve()

    try {
      await execution.run.stream(slug, {
        spec: string('spec'),
        grep: string('grep'),
        filter: string('filter')
      }, (message) => {
        if (message.event === 'run:finished') {
          finished = message
          return
        }

        writes = writes.then(() => stream.push({ data: JSON.stringify(message) }))
      })

      await writes
      if (finished !== null) await stream.push({ data: JSON.stringify(finished) })
    } finally {
      await stream.close()
    }
  })()

  return stream.send()
})
