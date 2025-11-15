/**
 * ESLint Configuration (v9 Format)
 *
 * Migrated from .eslintrc.json to ESLint v9 flat config format.
 * Uses existing installed packages without requiring new dependencies.
 */

import js from '@eslint/js'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  // Apply to all JS/TS files
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      parser: tsparser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        // Browser environment
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        alert: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        localStorage: 'readonly',
        File: 'readonly',
        FileList: 'readonly',
        HTMLElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLButtonElement: 'readonly',
        HTMLParagraphElement: 'readonly',
        HTMLHeadingElement: 'readonly',
        React: 'readonly',
        URL: 'readonly',
        confirm: 'readonly',
        
        // Node.js environment  
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      react: react,
      'react-hooks': reactHooks,
    },
    rules: {
      // ESLint base rules
      ...js.configs.recommended.rules,
      
      // TypeScript rules (matching original config)
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_' }
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      
      // Override base ESLint no-unused-vars to avoid duplicate warnings
      'no-unused-vars': 'off', // Let TypeScript ESLint handle this
      
      // React rules (matching original config)
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off', 
      'react/no-unescaped-entities': 'off',
      
      // React Hooks rules
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      
      // General rules (matching original config)
      'no-useless-escape': 'off',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  
  // Ignore patterns (replaces .eslintignore file)
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '.vscode/**',
      '.git/**',
      '*.min.js',
    ],
  },
]