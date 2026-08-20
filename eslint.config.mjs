import { eslintJsRules } from './eslint-js-rules.mjs';
import { eslintStyleRules } from './eslint-style-rules.mjs';
import stylistic from '@stylistic/eslint-plugin';
import { defineConfig } from 'eslint/config';
import { importX } from 'eslint-plugin-import-x';
import globals from 'globals';

export default defineConfig([
    {
        plugins: {
            '@stylistic': stylistic,
            'import-x': importX
        }
    }, {
        ignores: ['dist/**']
    }, {
        'name': 'backdraft-eslint',
        'extends': [],
        'languageOptions': {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: globals.browser
        },
        'linterOptions': {
            noInlineConfig: false,
            reportUnusedDisableDirectives: true
        },
        'files': ['*.mjs', 'src/*.js', 'test/*.js'],
        'rules': { ...eslintJsRules, ...eslintStyleRules }
    }, {
        files: ['test/*.js'],
        rules: {
            'no-use-before-define': [0],
            'no-magic-numbers': [0],
            'no-underscore-dangle': [0],
            'no-console': [0],
            'camelcase': [0],
            'class-methods-use-this': [0],
            'no-invalid-this': [0],
            'no-unused-vars': [0],
            'consistent-return': [0],
            'no-restricted-globals': [0],
            'no-empty': [0],
            'no-return-assign': [0],
            'no-throw-literal': [0],
            'no-empty-function': [0],
            'no-useless-assignment': [0],
            'no-undef': [0],
            'array-callback-return': [0]
        }
    }
]);
