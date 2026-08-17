import type { AuthCredentialsRequest } from '@acutis/contracts/auth'

export default defineEventHandler(async (event) => {
  const { acutis } = useClients(event)
  const slug = getRouterParam(event, 'slug')
  await acutis(`/api/v1/projects/${slug}/auth/credentials`, { method: 'POST', body: await readBody<AuthCredentialsRequest>(event) })
})
