module.exports = {
    'env': {
        'browser': true,
        'es6': true,
        'node': true
    },

    parserOptions: {
        ecmaVersion: 2018,
        sourceType: 'module',
    },

    extends: [
        'eslint:recommended',
        // './eslint-rules/es.js',
        // './eslint-rules/errors.js',
        // './eslint-rules/variables.js',
        // './eslint-rules/imports.js',
        // './eslint-rules/style.js',
        // './eslint-rules/best-practices.js',
        // './eslint-rules/node.js'
    ],

    'rules': {
        'no-multi-assign': ['off'],
        'no-cond-assign': ['error', 'except-parens'],
        'padding-line-between-statements': ['off'],
        'arrow-body-style': ['off'],
        'no-param-reassign': ['off'],
        'max-len': ['off'],
        'prefer-const': ['error', {'destructuring': 'all'}],
        'no-use-before-define': ['off'],
        'no-else-return': ['off'],
        'no-prototype-builtins': ['off'],
        'comma-dangle': ['off'],
        'one-var': ['off'],
        'sort-vars': ['off'],
        'no-plusplus': ['off'],
        'arrow-parens': ['error', 'as-needed'],
        'wrap-iife': ['off'],
        'no-shadow': ['off'],
    }
};