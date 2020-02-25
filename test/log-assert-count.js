import {smoke} from '../node_modules/bd-smoke/smoke.js';

smoke.defTest({
    id: 'log-assert-count',
    order: 8,
    test() {
        this.logger.logNote(`total asserts: ${smoke.getAssertCount()}`);
    }
});
