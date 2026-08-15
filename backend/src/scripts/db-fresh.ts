/** `pnpm db:fresh` — apaga o banco de configurações e o refaz pelas migrations. */
import { fresh } from '../config/database-fresh.js'

const path = await fresh()

console.log(`banco refeito em ${path}`)
