import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
    { ignores: ['.tmp', 'dist', 'dist-ui', 'frontend', 'node_modules', 'stubs', 'test-results'] },
    js.configs.recommended,
    tseslint.configs.recommended,
    {
        languageOptions: { globals: { ...globals.node, ...globals.browser } },
        rules: {
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-unused-vars': ['error', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                ignoreRestSiblings: true
            }],
            'no-console': ['error', { allow: ['warn', 'error'] }],
            'no-control-regex': 'off',
            eqeqeq: ['error', 'always'],
            'prefer-const': 'error'
        }
    },
    {
        files: ['**/__tests__/**/*.ts', 'test/**/*.ts', 'reporters/**/*.spec.ts'],
        rules: { '@typescript-eslint/no-explicit-any': 'off' }
    },
    {
        files: ['src/scripts/**/*.ts', 'scripts/**/*.js', 'bin/**/*.{js,mjs}', 'reporters/**/*.cjs'],
        rules: { 'no-console': 'off', '@typescript-eslint/no-require-imports': 'off' }
    }
)
