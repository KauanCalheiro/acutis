// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    ignores: [
      '.agents/**',
      '.claude/**',
      '.codex/**',
      '.github/**',
      '.output/**',
      '.playwright-mcp/**',
      'dist-ui/**',
      'e2e/**'
    ]
  }
)
