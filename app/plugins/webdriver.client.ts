export default defineNuxtPlugin(() => {
  if (import.meta.env.MODE === 'test') return

  useWebdriver().ensureConnected()
})
