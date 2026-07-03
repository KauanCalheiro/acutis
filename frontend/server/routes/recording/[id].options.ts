import { defineEventHandler, handleCors } from 'h3'

export default defineEventHandler((event) => {
  handleCors(event, { origin: '*', methods: ['POST'] })
})
