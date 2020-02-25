import {smoke} from './node_modules/bd-smoke/smoke.js';

smoke.configureBrowser({
    load: [
        './test/test.css',
        './test/Element.js',
        './test/watchHub.js',
        './test/eventHub.js',
        './test/Component.js',
        './test/post-processing.js',
        './test/render.js',
        './test/watchable.js',
        './test/log-assert-count.js'
    ]
});
