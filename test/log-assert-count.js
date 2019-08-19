const smoke = typeof window !== 'undefined' ? window.smoke : require('bd-smoke');

smoke.defTest({
    id: 'log-assert-count',
    test() {
        this.logger.logNote(`total asserts: ${smoke.getAssertCount()}`);
    }
});
