//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

export default [
  ...tanstackConfig,
  {
    rules: {
      'import/no-cycle': 'off',
      'import/order': 'off',
      'sort-imports': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/require-await': 'off',
      'pnpm/json-enforce-catalog': 'off',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^#/(lib/(domain|infra)/[^/]+)/.+',
              message: 'Import the concern through its public barrel.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/lib/{domain,infra}/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^#/(lib/(domain|infra)/[^/]+)/.+',
              message: 'Import the concern through its public barrel.',
            },
            {
              regex: '^#/(features|routes|components|hooks)(/|$)',
              message: 'Library modules must not import UI/application code.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/lib/infra/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^#/lib/domain(/|$)',
              message: 'Infrastructure must not import domain modules.',
            },
            {
              regex: '^#/(features|routes|components|hooks)(/|$)',
              message: 'Library modules must not import UI/application code.',
            },
          ],
        },
      ],
    },
  },
  {
    ignores: [
      'eslint.config.js',
      'prettier.config.js',
      'dependency-cruiser.config.cjs',
      'src/routeTree.gen.ts',
      '.output/**',
      '.vendor/**',
    ],
  },
]
