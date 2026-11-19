import tseslint from 'typescript-eslint';

const DATABASE_LAYER = ['@seedgw/db', '@seedgw/db/*', '@prisma/client', '@prisma/client/*'];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/.expo/**',
      '**/.turbo/**',
      '**/dist/**',
      '**/next-env.d.ts',
      '.design/**',
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}', 'apps/mobile/**/*.{ts,tsx}', 'packages/ui/**/*.{ts,tsx}'],
    ignores: ['apps/web/src/server/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: DATABASE_LAYER,
              message: 'Giao dien chi lay du lieu qua apps/web/src/server.',
            },
          ],
        },
      ],
    },
  },
);
