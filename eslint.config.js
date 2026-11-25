import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

/**
 * The architectural boundary is enforced here, not by convention.
 *
 *   core/     must never import from modules/
 *   modules/  may import from core/api and nothing else in core/
 *   modules/  must never import another module
 *
 * If a module needs something core/api does not expose, that is an issue
 * against the contract — never a shortcut around these rules.
 */

const CORE_MAY_NOT_IMPORT = [
  '@modules',
  '@modules/*',
  '@modules/*/**',
  '**/modules',
  '**/modules/*',
  '**/modules/*/**',
]

const MODULES_MAY_ONLY_IMPORT_CORE_API = [
  '@core/*',
  '@core/*/**',
  '**/core/*',
  '**/core/*/**',
  '!@core/api',
  '!@core/api/**',
  '!**/core/api',
  '!**/core/api/**',
]

const MODULES_MAY_NOT_IMPORT_OTHER_MODULES = [
  '@modules/*',
  '@modules/*/**',
]

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },

  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat['recommended-latest'],
    ],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
  },

  {
    files: ['src/core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: CORE_MAY_NOT_IMPORT,
              message:
                'core/ must never import from modules/. The core knows no module by name.',
            },
          ],
        },
      ],
    },
  },

  {
    files: ['src/modules/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: MODULES_MAY_ONLY_IMPORT_CORE_API,
              message:
                'Modules may only import from @core/api. Needing more is a change to the contract.',
            },
            {
              group: MODULES_MAY_NOT_IMPORT_OTHER_MODULES,
              message:
                'Modules never import each other. Integrate through events instead.',
            },
          ],
        },
      ],
    },
  },
)
