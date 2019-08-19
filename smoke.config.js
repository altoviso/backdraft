(function (factory) {
    if (typeof window === 'undefined') {
        factory(require('bd-smoke'), true);
    } else {
        factory(window.smoke, false);
    }
}((smoke, isNode) => {
    // recall: all file names are relative to the root directory of the project by default

    // config that's applicable to all environments
    const config = {
        load: [
            './test/test.css' // will be ignored by smoke on node
        ],
        remoteUrl: 'http://localhost:8080/altoviso/backdraft/node_modules/bd-smoke/browser-runner.html',
    };

    // each of the tests below is written using es6 imports, and, c2018, will not load on node without transforming
    // we don't want to make that a requirement to test remotely, therefore we note the root of each test that is interesting
    // to run remotely (and therefore, be loaded by smoke on node) and use smoke.defBrowserTestRef to inform smoke about
    // such tests
    const tests = [
        ['Element', './test/Element.js'],
        ['watchHub', './test/watchHub.js'],
        ['eventHub', './test/eventHub.js'],
        ['Component', './test/Component.js'],
        ['post-processing', './test/post-processing.js'],
        ['render', './test/render.js'],
        ['watchable', './test/watchable.js'],
        ['log-assert-count', './test/log-assert-count.js']
    ];

    if (isNode) {
        tests.map(item => smoke.defBrowserTestRef(item[0]));
        config.capabilities = isNode ? require('./test/capabilities') : [];
    } else {
        // browser
        config.load = config.load.concat(tests.map(item => item[1]));
    }

    smoke.configure(config).then(() => {
        // order the tests as given in tests above; mainly so we can have log-assert-count last without having to
        // put order attributes in the actual test definitions.
        const smokeTests = smoke.tests;
        const ordered = [];
        tests.forEach((item, order) => {
            const id = item[0];
            smokeTests.some(test => {
                if (test.id === id) {
                    test.order = order;
                    ordered.push(test);
                    return true;
                }
                return 0;
            });
        });
        ordered.forEach((test, i) => (smokeTests[i] = test));
    });
}));
