export const eslintStyleRules = {
    '@stylistic/array-bracket-spacing': [
        2,
        'never'
    ],
    '@stylistic/arrow-parens': [
        2,
        'as-needed',
        {
            requireForBlockBody: false
        }
    ],
    '@stylistic/arrow-spacing': [
        2,
        {
            before: true,
            after: true
        }
    ],
    '@stylistic/block-spacing': [
        2,
        'always'
    ],
    '@stylistic/brace-style': [
        2,
        '1tbs',
        {
            allowSingleLine: true
        }
    ],
    '@stylistic/comma-dangle': [
        2,
        'never'
    ],
    '@stylistic/comma-spacing': [
        2,
        {
            before: false,
            after: true
        }
    ],
    '@stylistic/comma-style': [
        2,
        'last',
        {
            exceptions: {
                ArrayExpression: false,
                ArrayPattern: false,
                ArrowFunctionExpression: false,
                CallExpression: false,
                FunctionDeclaration: false,
                FunctionExpression: false,
                ImportDeclaration: false,
                ObjectExpression: false,
                ObjectPattern: false,
                VariableDeclaration: false,
                NewExpression: false
            }
        }
    ],
    '@stylistic/computed-property-spacing': [
        2,
        'never',
        {
            enforceForClassMembers: true
        }
    ],
    '@stylistic/dot-location': [
        2,
        'property'
    ],
    '@stylistic/eol-last': [
        2,
        'always'
    ],
    '@stylistic/generator-star-spacing': [
        2,
        {
            before: false,
            after: true
        }
    ],
    '@stylistic/indent': [
        2,
        4,
        {
            SwitchCase: 1,
            flatTernaryExpressions: false,
            ignoredNodes: [
                'ReturnStatement *',
                'CallExpression > *'
            ],
            ArrayExpression: 1,
            CallExpression: {
                arguments: 1
            },
            FunctionDeclaration: {
                body: 1,
                parameters: 1,
                returnType: 1
            },
            FunctionExpression: {
                body: 1,
                parameters: 1,
                returnType: 1
            },
            ignoreComments: false,
            ImportDeclaration: 1,
            MemberExpression: 1,
            ObjectExpression: 1,
            offsetTernaryExpressions: false,
            outerIIFEBody: 1,
            tabLength: 4,
            VariableDeclarator: 1
        }
    ],
    '@stylistic/indent-binary-ops': [
        2,
        4
    ],
    '@stylistic/key-spacing': [
        2,
        {
            afterColon: true,
            beforeColon: false
        }
    ],
    '@stylistic/keyword-spacing': [
        2,
        {
            before: true,
            after: true,
            overrides: {}
        }
    ],
    '@stylistic/lines-between-class-members': [
        2,
        'always',
        {
            exceptAfterOverload: true,
            exceptAfterSingleLine: true
        }
    ],
    '@stylistic/max-statements-per-line': [
        2,
        {
            max: 1
        }
    ],
    '@stylistic/member-delimiter-style': [
        2,
        {
            multiline: {
                delimiter: 'semi',
                requireLast: true
            },
            singleline: {
                delimiter: 'semi',
                requireLast: false
            },
            multilineDetection: 'brackets',
            overrides: {
                'interface': {
                    multiline: {
                        delimiter: 'semi',
                        requireLast: true
                    }
                }
            }
        }
    ],
    '@stylistic/multiline-ternary': [0],
    '@stylistic/new-parens': [
        2,
        'always'
    ],
    '@stylistic/no-extra-parens': [0],
    '@stylistic/no-floating-decimal': [
        2
    ],
    '@stylistic/no-mixed-operators': [
        2,
        {
            groups: [
                [
                    '+',
                    '-',
                    '*',
                    '/',
                    '%',
                    '**'
                ],
                [
                    '&',
                    '|',
                    '^',
                    '~',
                    '<<',
                    '>>',
                    '>>>'
                ],
                [
                    '==',
                    '!=',
                    '===',
                    '!==',
                    '>',
                    '>=',
                    '<',
                    '<='
                ],
                [
                    '&&',
                    '||'
                ],
                [
                    'in',
                    'instanceof'
                ]
            ],
            allowSamePrecedence: true
        }
    ],
    '@stylistic/no-mixed-spaces-and-tabs': [
        2,
        false
    ],
    '@stylistic/no-multi-spaces': [
        2,
        {
            // rawld--to consider
            // exceptions: {
            //     'Property': true,
            //     'ImportAttribute': true,
            //     'ArrayExpression': true,
            //     'VariableDeclarator': true
            // },
            ignoreEOLComments: false,
            includeTabs: true
        }
    ],
    '@stylistic/no-multiple-empty-lines': [
        2,
        {
            max: 2,
            maxBOF: 0,
            maxEOF: 0
        }
    ],
    '@stylistic/no-tabs': [
        2,
        {
            allowIndentationTabs: false
        }
    ],
    '@stylistic/no-trailing-spaces': [
        2,
        {
            skipBlankLines: false,
            ignoreComments: false
        }
    ],
    '@stylistic/no-whitespace-before-property': [
        2
    ],
    '@stylistic/object-curly-spacing': [
        2,
        'always'
    ],
    '@stylistic/operator-linebreak': [
        2,
        'before'
    ],
    '@stylistic/padded-blocks': [
        2,
        {
            blocks: 'never',
            classes: 'never',
            switches: 'never'
        },
        {
            allowSingleLineBlocks: false
        }
    ],
    '@stylistic/quote-props': [
        2,
        'consistent-as-needed',
        // rawld
        {
            keywords: true,
            unnecessary: true,
            numbers: true
        }
    ],
    '@stylistic/quotes': [
        2,
        'single',
        {
            allowTemplateLiterals: 'always',
            avoidEscape: true,
            ignoreStringLiterals: false
        }
    ],
    '@stylistic/rest-spread-spacing': [
        2,
        'never'
    ],
    '@stylistic/semi': [
        2,
        'always'
    ],
    '@stylistic/semi-spacing': [
        2,
        {
            before: false,
            after: true
        }
    ],
    '@stylistic/space-before-blocks': [
        2,
        'always'
    ],
    '@stylistic/space-before-function-paren': [
        2,
        {
            anonymous: 'always',
            asyncArrow: 'always',
            named: 'never'
        }
    ],
    '@stylistic/space-in-parens': [
        2,
        'never'
    ],
    '@stylistic/space-infix-ops': [
        2,
        {
            int32Hint: false,
            ignoreTypes: false
        }
    ],
    '@stylistic/space-unary-ops': [
        2,
        {
            words: true,
            nonwords: false
        }
    ],
    '@stylistic/spaced-comment': [
        2,
        'always',
        {
            line: {
                exceptions: [
                    '-',
                    '+'
                ],
                markers: [
                    '=',
                    '!'
                ]
            },
            block: {
                exceptions: [
                    '-',
                    '+'
                ],
                markers: [
                    '=',
                    '!'
                ],
                balanced: true
            }
        }
    ],
    '@stylistic/template-curly-spacing': [
        2,
        'never'
    ],
    '@stylistic/template-tag-spacing': [
        2,
        'never'
    ],
    '@stylistic/type-annotation-spacing': [
        2,
        {}
    ],
    '@stylistic/type-generic-spacing': [
        2
    ],
    '@stylistic/type-named-tuple-spacing': [
        2
    ],
    '@stylistic/wrap-iife': [
        2,
        'any',
        {
            functionPrototypeMethods: true
        }
    ],
    '@stylistic/yield-star-spacing': [
        2,
        {
            after: true,
            before: false
        }
    ]
};
