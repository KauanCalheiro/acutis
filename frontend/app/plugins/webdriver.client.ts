export default defineNuxtPlugin(() => {
  useWebdriver().ensureConnected()
})
