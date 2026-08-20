/* eslint-disable no-magic-numbers */

const eslintRules = {
    'accessor-pairs': [2, {
        enforceForTSTypes: false,
        enforceForClassMembers: true,
        getWithoutSet: false,
        setWithoutGet: true
    }],
    'array-callback-return': [2, { allowImplicit: true, checkForEach: false, allowVoid: false }],
    'arrow-body-style': [2, 'as-needed', { requireReturnForObjectLiteral: false }],
    'block-scoped-var': [2],
    'camelcase': [2, {
        allow: [],
        ignoreDestructuring: false,
        ignoreGlobals: false,
        ignoreImports: false,
        properties: 'never'
    }],
    'capitalized-comments': [0, 'never', {
        line: {
            ignorePattern: '.*',
            ignoreInlineComments: true,
            ignoreConsecutiveComments: true
        },
        block: { ignorePattern: '.*', ignoreInlineComments: true, ignoreConsecutiveComments: true }
    }],
    'class-methods-use-this': [2, {
        enforceForClassFields: true,
        exceptMethods: [],
        ignoreOverrideMethods: false
    }],
    'complexity': [0],
    'consistent-return': [2, { treatUndefinedAsUnspecified: false }],
    'consistent-this': [0, 'self'],
    'constructor-super': [2],
    'curly': [2, 'multi-line'],
    'default-case': [2, { commentPattern: '^no default$' }],
    'default-case-last': [2],
    'default-param-last': [2],
    'dot-notation': [2, { allowKeywords: true, allowPattern: '' }],
    'eqeqeq': [2, 'always', { 'null': 'ignore' }],
    'for-direction': [2],
    'func-name-matching': [0, 'always', { includeCommonJSModuleExports: false, considerPropertyDescriptor: true }],
    'func-names': [0, 'always', {}],
    'func-style': [0, 'expression', { allowArrowFunctions: false, allowTypeAnnotation: false, overrides: {} }],
    'getter-return': [2, { allowImplicit: true }],
    'global-require': [2],
    'grouped-accessor-pairs': [2, 'anyOrder', { enforceForTSTypes: false }],
    'guard-for-in': [2],
    'id-denylist': [0],
    'id-length': [0, {
        exceptionPatterns: [], exceptions: [], min: 2, properties: 'always'
    }],
    'id-match': [0, '^[a-z]+([A-Z][a-z]+)*$', {
        classFields: true,
        ignoreDestructuring: false,
        onlyDeclarations: false,
        properties: true
    }],
    'init-declarations': [0],
    'logical-assignment-operators': [0, 'never', { enforceForIfStatements: false }],
    'max-classes-per-file': [0],
    'max-depth': [0, 4],
    'max-lines': [0, { max: 300, skipBlankLines: true, skipComments: true }],
    'max-lines-per-function': [0, {
        max: 50, skipBlankLines: true, skipComments: true, IIFEs: true
    }],
    'max-nested-callbacks': [2],
    'max-params': [0, 3],
    'max-statements': [0, 10],
    'new-cap': [2, {
        capIsNew: false,
        capIsNewExceptions: ['Immutable.Map', 'Immutable.Set', 'Immutable.List'],
        newIsCap: true,
        newIsCapExceptions: [],
        properties: true
    }],
    'no-alert': [1],
    'no-array-constructor': [2],
    'no-async-promise-executor': [2],
    'no-await-in-loop': [2],
    'no-bitwise': [2, { allow: [], int32Hint: false }],
    'no-caller': [2],
    'no-case-declarations': [2],
    'no-class-assign': [2],
    'no-compare-neg-zero': [2],
    'no-cond-assign': [2, 'except-parens'],
    'no-console': [1, {}],
    'no-const-assign': [2],
    'no-constant-binary-expression': [2, { checkRelationalComparisons: false }],
    'no-constant-condition': [1, { checkLoops: 'allExceptWhileTrue' }],
    'no-constructor-return': [2],
    'no-continue': [0],
    'no-control-regex': [2],
    'no-debugger': [2],
    'no-delete-var': [2],
    'no-div-regex': [0],
    'no-dupe-args': [2],
    'no-dupe-class-members': [2],
    'no-dupe-else-if': [2],
    'no-dupe-keys': [2],
    'no-duplicate-case': [2],
    'no-duplicate-imports': [2, { includeExports: false, allowSeparateTypeImports: false }],
    'no-else-return': [2, { allowElseIf: true }],
    'no-empty': [2, { allowEmptyCatch: false }],
    'no-empty-character-class': [2],
    'no-empty-function': [2],
    'no-empty-pattern': [2, { allowObjectPatternsAsParameters: false }],
    'no-empty-static-block': [2],
    'no-eq-null': [2],
    'no-eval': [2, { allowIndirect: false }],
    'no-ex-assign': [2],
    'no-extend-native': [2, { exceptions: [] }],
    'no-extra-bind': [2],
    'no-extra-boolean-cast': [2, {}],
    'no-extra-label': [2],
    'no-fallthrough': [2, { allowEmptyCase: false, reportUnusedFallthroughComment: false }],
    'no-func-assign': [2],
    'no-global-assign': [2, { exceptions: [] }],
    'no-implicit-coercion': [2, {
        'allow': ['!!'],
        'boolean': true,
        'disallowTemplateShorthand': false,
        'number': true,
        'string': true
    }],
    'no-implicit-globals': [2, { lexicalBindings: true }],
    'no-implied-eval': [2],
    'no-import-assign': [2],
    'no-inline-comments': [0, {}],
    'no-inner-declarations': [2, 'functions', { blockScopedFunctions: 'allow' }],
    'no-invalid-regexp': [2, {}],
    'no-invalid-this': [2, { capIsConstructor: true }],
    'no-irregular-whitespace': [2, {
        skipComments: false,
        skipJSXText: false,
        skipRegExps: false,
        skipStrings: true,
        skipTemplates: false
    }],
    'no-iterator': [2],
    'no-label-var': [2],
    'no-labels': [2, { allowLoop: false, allowSwitch: false }],
    'no-lone-blocks': [2],
    'no-lonely-if': [2],
    'no-loop-func': [2],
    'no-loss-of-precision': [2],
    'no-magic-numbers': [2, {
        // these are typically used for things like arguments.length, but in any case constants like these are obvious
        ignore: [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5],
        detectObjects: false,
        enforceConst: true,
        ignoreArrayIndexes: true,
        ignoreDefaultValues: false,
        ignoreClassFieldInitialValues: false,
        ignoreEnums: false,
        ignoreNumericLiteralTypes: false,
        ignoreReadonlyClassProperties: false,
        ignoreTypeIndexes: false
    }],
    'no-misleading-character-class': [2, { allowEscape: false }],
    'no-multi-assign': [0, { ignoreNonDeclaration: false }],
    'no-multi-str': [2],
    'no-negated-condition': [0],
    'no-nested-ternary': [0],
    'no-new': [2],
    'no-new-func': [2],
    'no-new-native-nonconstructor': [2],
    'no-new-object': [2],
    'no-new-require': [2],
    'no-new-symbol': [2],
    'no-new-wrappers': [2],
    'no-nonoctal-decimal-escape': [2],
    'no-obj-calls': [2],
    'no-object-constructor': [2],
    'no-octal': [2],
    'no-octal-escape': [2],
    'no-param-reassign': [0, {
        props: true,
        ignorePropertyModificationsFor: []
    }],
    'no-plusplus': [0, { allowForLoopAfterthoughts: false }],
    'no-promise-executor-return': [2, { allowVoid: false }],
    'no-proto': [2],
    'no-prototype-builtins': [0],
    'no-redeclare': [2, { builtinGlobals: true }],
    'no-regex-spaces': [2],
    'no-restricted-exports': [2],
    'no-restricted-globals': [2, {
        name: 'isFinite',
        message: 'Use Number.isFinite instead https://github.com/airbnb/javascript#standard-library--isfinite'
    }, {
        name: 'isNaN',
        message: 'Use Number.isNaN instead https://github.com/airbnb/javascript#standard-library--isnan'
    }, {
        name: 'addEventListener',
        message: 'Use window.addEventListener instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'blur',
        message: 'Use window.blur instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'close',
        message: 'Use window.close instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'closed',
        message: 'Use window.closed instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'confirm',
        message: 'Use window.confirm instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'defaultStatus',
        message: 'Use window.defaultStatus instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'defaultstatus',
        message: 'Use window.defaultstatus instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'event',
        message: 'Use window.event instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'external',
        message: 'Use window.external instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'find',
        message: 'Use window.find instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'focus',
        message: 'Use window.focus instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'frameElement',
        message: 'Use window.frameElement instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'frames',
        message: 'Use window.frames instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'history',
        message: 'Use window.history instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'innerHeight',
        message: 'Use window.innerHeight instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'innerWidth',
        message: 'Use window.innerWidth instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'length',
        message: 'Use window.length instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'location',
        message: 'Use window.location instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'locationbar',
        message: 'Use window.locationbar instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'menubar',
        message: 'Use window.menubar instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'moveBy',
        message: 'Use window.moveBy instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'moveTo',
        message: 'Use window.moveTo instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'name',
        message: 'Use window.name instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'onblur',
        message: 'Use window.onblur instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'onerror',
        message: 'Use window.onerror instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'onfocus',
        message: 'Use window.onfocus instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'onload',
        message: 'Use window.onload instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'onresize',
        message: 'Use window.onresize instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'onunload',
        message: 'Use window.onunload instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'open',
        message: 'Use window.open instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'opener',
        message: 'Use window.opener instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'opera',
        message: 'Use window.opera instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'outerHeight',
        message: 'Use window.outerHeight instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'outerWidth',
        message: 'Use window.outerWidth instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'pageXOffset',
        message: 'Use window.pageXOffset instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'pageYOffset',
        message: 'Use window.pageYOffset instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'parent',
        message: 'Use window.parent instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'print',
        message: 'Use window.print instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'removeEventListener',
        message: 'Use window.removeEventListener instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'resizeBy',
        message: 'Use window.resizeBy instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'resizeTo',
        message: 'Use window.resizeTo instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'screen',
        message: 'Use window.screen instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'screenLeft',
        message: 'Use window.screenLeft instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'screenTop',
        message: 'Use window.screenTop instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'screenX',
        message: 'Use window.screenX instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'screenY',
        message: 'Use window.screenY instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'scroll',
        message: 'Use window.scroll instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'scrollbars',
        message: 'Use window.scrollbars instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'scrollBy',
        message: 'Use window.scrollBy instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'scrollTo',
        message: 'Use window.scrollTo instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'scrollX',
        message: 'Use window.scrollX instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'scrollY',
        message: 'Use window.scrollY instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'self',
        message: 'Use window.self instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'status',
        message: 'Use window.status instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'statusbar',
        message: 'Use window.statusbar instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'stop',
        message: 'Use window.stop instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'toolbar',
        message: 'Use window.toolbar instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }, {
        name: 'top',
        message: 'Use window.top instead. https://github.com/facebook/create-react-app/blob/HEAD/packages/confusing-browser-globals/README.md'
    }],
    'no-restricted-imports': [0],
    'no-restricted-properties': [2, {
        object: 'arguments',
        property: 'callee',
        message: 'arguments.callee is deprecated'
    }, {
        object: 'global',
        property: 'isFinite',
        message: 'Please use Number.isFinite instead'
    }, {
        object: 'self',
        property: 'isFinite',
        message: 'Please use Number.isFinite instead'
    }, {
        object: 'window',
        property: 'isFinite',
        message: 'Please use Number.isFinite instead'
    }, { object: 'global', property: 'isNaN', message: 'Please use Number.isNaN instead' }, {
        object: 'self',
        property: 'isNaN',
        message: 'Please use Number.isNaN instead'
    }, {
        object: 'window',
        property: 'isNaN',
        message: 'Please use Number.isNaN instead'
    }, {
        property: '__defineGetter__',
        message: 'Please use Object.defineProperty instead.'
    }, { property: '__defineSetter__', message: 'Please use Object.defineProperty instead.' }, {
        object: 'Math',
        property: 'pow',
        message: 'Use the exponentiation operator (**) instead.'
    }],
    'no-restricted-syntax': [2, {
        selector: 'ForInStatement',
        message: 'for..in loops iterate over the entire prototype chain, which is virtually never what you want. Use Object.{keys,values,entries}, and iterate over the resulting array.'
    }, {
        selector: 'ForOfStatement',
        message: 'iterators/generators require regenerator-runtime, which is too heavyweight for this guide to allow them. Separately, loops should be avoided in favor of array iterations.'
    }, {
        selector: 'LabeledStatement',
        message: 'Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.'
    }, {
        selector: 'WithStatement',
        message: '`with` is disallowed in strict mode because it makes code impossible to predict and optimize.'
    }],
    'no-return-assign': [2, 'except-parens'],
    'no-script-url': [2],
    'no-self-assign': [2, { props: true }],
    'no-self-compare': [2],
    'no-sequences': [2, { allowInParentheses: true }],
    'no-setter-return': [2],
    'no-shadow': [0],
    'no-shadow-restricted-names': [2, { reportGlobalThis: true }],
    'no-spaced-func': [2],
    'no-sparse-arrays': [2],
    'no-template-curly-in-string': [2],
    'no-ternary': [0],
    'no-this-before-super': [2],
    'no-throw-literal': [2],
    'no-unassigned-vars': [2],
    'no-undef': [2, { 'typeof': false }],
    'no-undef-init': [2],
    'no-undefined': [0],
    'no-underscore-dangle': [0],
    'no-unexpected-multiline': [2],
    'no-unmodified-loop-condition': [0],
    'no-unneeded-ternary': [2, { defaultAssignment: false }],
    'no-unreachable': [2],
    'no-unreachable-loop': [2, { ignore: [] }],
    'no-unsafe-finally': [2],
    'no-unsafe-negation': [2, { enforceForOrderingRelations: false }],
    'no-unsafe-optional-chaining': [2, { disallowArithmeticOperators: true }],
    'no-unused-expressions': [2, {
        allowShortCircuit: true,
        allowTernary: true,
        allowTaggedTemplates: false,
        enforceForJSX: false,
        ignoreDirectives: false
    }],
    'no-unused-labels': [2],
    'no-unused-private-class-members': [2],
    'no-unused-vars': [2, {
        vars: 'all',
        args: 'after-used',
        ignoreRestSiblings: false,
        caughtErrors: 'all',
        ignoreClassWithStaticInitBlock: false,
        ignoreUsingDeclarations: false,
        reportUsedIgnorePattern: false,
        argsIgnorePattern: '^_unused',
        caughtErrorsIgnorePattern: '^e$',
        destructuredArrayIgnorePattern: '^_unused'
    }],
    'no-use-before-define': [2, {
        classes: true,
        functions: false,
        variables: true,
        allowNamedExports: false,
        enums: true,
        typedefs: true,
        ignoreTypeReferences: true
    }],
    'no-useless-assignment': [2],
    'no-useless-backreference': [2],
    'no-useless-call': [2],
    'no-useless-catch': [2],
    'no-useless-computed-key': [2, { enforceForClassMembers: true }],
    'no-useless-concat': [2],
    'no-useless-constructor': [2],
    'no-useless-escape': [2, { allowRegexCharacters: [] }],
    'no-useless-rename': [2, { ignoreDestructuring: false, ignoreImport: false, ignoreExport: false }],
    'no-useless-return': [2],
    'no-var': [2],
    'no-void': [2, { allowAsStatement: false }],
    'no-warning-comments': [0, { location: 'start', terms: ['todo', 'fixme'] }],
    'no-with': [2],
    'object-shorthand': [2, 'always', { ignoreConstructors: false, avoidQuotes: true }],
    'operator-assignment': [2, 'always'],
    'prefer-arrow-callback': [2, { allowNamedFunctions: false, allowUnboundThis: true }],
    'prefer-const': [2, { destructuring: 'all', ignoreReadBeforeAssign: false }],
    'prefer-destructuring': [0, {
        VariableDeclarator: { array: false, object: true },
        AssignmentExpression: { array: false, object: true }
    }, { enforceForRenamedProperties: false }],
    'prefer-exponentiation-operator': [2],
    'prefer-named-capture-group': [0],
    'prefer-numeric-literals': [2],
    'prefer-object-has-own': [2],
    'prefer-object-spread': [2],
    'prefer-promise-reject-errors': [2, { allowEmptyReject: true }],
    'prefer-regex-literals': [2, { disallowRedundantWrapping: true }],
    'prefer-rest-params': [2],
    'prefer-spread': [2],
    'prefer-template': [2],
    'radix': [2, 'always'],
    'require-atomic-updates': [0, { allowProperties: false }],
    'require-await': [0],
    'require-unicode-regexp': [0, {}],
    'require-yield': [2],
    'sort-imports': [2, {
        ignoreCase: true,
        ignoreDeclarationSort: true, // eslint-plugin-import handles this
        ignoreMemberSort: false,
        memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single']
    }],
    'sort-keys': [0, 'asc', {
        allowLineSeparatedGroups: false,
        caseSensitive: false,
        ignoreComputedKeys: false,
        minKeys: 2,
        natural: true
    }],
    'sort-vars': [0, { ignoreCase: false }],
    'strict': [2, 'never'],
    'symbol-description': [2],
    'unicode-bom': [2, 'never'],
    'use-isnan': [2, { enforceForIndexOf: false, enforceForSwitchCase: true }],
    'valid-typeof': [2, { requireStringLiterals: true }],
    'vars-on-top': [2],
    'yoda': [2, 'never', { exceptRange: false, onlyEquality: false }]
};

const importRules = {
    'import-x/default': [0],
    'import-x/dynamic-import-chunkname': [0],
    'import-x/export': [2],
    'import-x/extensions': [2, 'ignorePackages'],
    'import-x/first': [2],
    'import-x/import/no-absolute-path': [0],
    'import-x/import/no-internal-modules': [0],
    'import-x/import/no-named-default': [0],
    'import-x/max-dependencies': [0],
    'import-x/named': [2],
    'import-x/namespace': [2],
    'import-x/newline-after-import': [2],
    'import-x/no-amd': [2],
    'import-x/no-anonymous-default-export': [0],
    'import-x/no-cycle': [0],
    'import-x/no-duplicates': [2],
    'import-x/no-dynamic-require': [0],
    'import-x/no-mutable-exports': [2],
    'import-x/no-named-as-default': [2],
    'import-x/no-named-as-default-member': [2],
    'import-x/no-self-import': [0],
    'import-x/no-unresolved': [2],
    'import-x/no-useless-path-segments': [0],
    'import-x/no-webpack-loader-syntax': [0],
    'import-x/order': [2, {
        groups: [['builtin', 'external', 'internal', 'parent', 'sibling', 'index']],
        alphabetize: {
            order: 'asc',
            caseInsensitive: true
        }
    }]
};

export const eslintJsRules = { ...eslintRules, ...importRules };
