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
        'backdraft'
    ],

    rules: {
        'no-shadow': ["warn", { "allow": ["e"] }]
    },

    overrides: [
        {
            'files': ['smoke.config.js'],
            'rules': {
                'global-require': 'off',
            }
        },
        {
            'files': ['test/*.js'],
            'rules': {
                'camelcase': 'off',
                'func-names': 'off',
                'no-shadow': 'off',
                'no-console': 'off',
                'no-use-before-define': 'off',
                'no-empty': 'off',
                'max-len': 'off',
            }
        }
    ]
};