// to see this work, run
//     node smoke-remote-controller.config.js --cap=firefox
//     - or, e.g. -
//     node smoke-remote-controller.config.js --cap=firefox
// from this directory

const smoke = require('bd-smoke');

// Inform node of test ids that it can remotely control running those tests on a remote browser.
[
    'Element',
    'watchHub',
    'eventHub',
    'Component',
    'post-processing',
    'render',
    'watchable',
    'log-assert-count'
].forEach(testId => smoke.defBrowserTestRef(testId));

smoke.defaultStart(smoke.configureNode(
    {
        autoRun: true,
        remoteUrl: 'http://localhost:3002/bd-core/node_modules/bd-smoke/smoke-runner.html',
        capabilities: require('./test/capabilities')
    }
));
