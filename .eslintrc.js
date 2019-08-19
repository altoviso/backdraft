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

    'rules': {
    },

    "overrides": [
        {
            "files": ['smoke.config.js'],
            "rules": {
                "global-require": "off",
            }
        }
    ]
};