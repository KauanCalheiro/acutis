import { projectsResponseSchema } from '#shared/contracts/project'
import { defineEventHandler, getQuery } from 'h3'
import { projectUseCases } from '../../utils/composition/project'
import { parseApiResponse } from '../../utils/contract'
import { execute } from '../../utils/http'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const number = (key: string) => {
    const value = query[key]
    return typeof value === 'string' && value !== '' ? Number(value) : undefined
  }
  const string = (key: string) => typeof query[key] === 'string' ? query[key] as string : undefined
  const response = await execute(() => projectUseCases().projects.findAll({
    filters: {
      name: string('filter[name]'),
      slug: string('filter[slug]')
    },
    search: string('search'),
    sort: string('sort'),
    page: {
      size: number('page[size]'),
      number: number('page[number]')
    }
  }))

  return parseApiResponse(projectsResponseSchema, response)
})
