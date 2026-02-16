import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
    // Global ignores
    {
        ignores: [
            '**/dist/**',
            '**/node_modules/**',
            '**/build/**',
            '**/*.d.ts',
            '**/coverage/**',
            'apps/web/src/vite-env.d.ts',
        ],
    },

    // Base JS rules for all files
    js.configs.recommended,

    // TypeScript rules for all .ts/.tsx files
    ...tseslint.configs.recommended,

    // React-specific rules (frontend only)
    {
        files: ['apps/web/src/**/*.{ts,tsx}'],
        plugins: {
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            'react-refresh/only-export-components': [
                'warn',
                { allowConstantExport: true },
            ],
        },
    },

    // Relax rules for the codebase (avoid breaking existing code)
    {
        rules: {
            // Allow `any` — too many to fix right now
            '@typescript-eslint/no-explicit-any': 'off',

            // Allow unused vars prefixed with _ (standard convention)
            '@typescript-eslint/no-unused-vars': ['warn', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_',
            }],

            // Allow require() in Node.js backend
            '@typescript-eslint/no-require-imports': 'off',

            // Allow empty catch blocks (common pattern)
            'no-empty': ['error', { allowEmptyCatch: true }],

            // Allow empty functions (e.g. noop callbacks)
            '@typescript-eslint/no-empty-function': 'off',

            // Prefer const but don't error
            'prefer-const': 'warn',

            // No console (already replaced with logger)
            'no-console': 'warn',
        },
    },

    // Prettier must be last — disables conflicting style rules
    eslintConfigPrettier,
);
