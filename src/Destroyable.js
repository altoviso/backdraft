let unexpectedHandler = function (e) {
    // eslint-disable-next-line no-console
    console.error(e);
};

export function setUnexpectedHandler(h) {
    const oldHandler = unexpectedHandler;
    unexpectedHandler = h;
    return oldHandler;
}

export class Destroyable {
    constructor(proc, container, onEmpty) {
        this._proc = proc;
        if (container) {
            (this.container = container).push(this);
        }
        if (onEmpty) {
            this.onEmpty = onEmpty;
        }
    }

    proc(...args) {
        try {
            !this._pause && !this._pauseOnce && this._proc && this._proc(...args);
            this._pauseOnce && (this._pauseOnce = 0);
        } catch (e) {
            unexpectedHandler(e);
        }
        return this;
    }

    exec() {
        this.proc();
        return this;
    }

    pause(proc) {
        if (proc) {
            this.pause();
            try {
                proc();
            } catch (e) {
                unexpectedHandler(e);
            }
            this.unpause();
            return this;
        }
        if (!this._pause) {
            this._pause = 1;
        } else {
            ++this._pause;
        }
        return this;
    }

    pauseOnce() {
        this._pauseOnce = true;
        return this;
    }

    unpause() {
        this._pause && --this._pause;
        return this;
    }

    unpauseAll() {
        this._pause = this._pauseOnce = 0;
        return this;
    }

    destroy() {
        if (this.onDestroy) {
            try {
                this.onDestroy();
                delete this.onDestroy;
            } catch (e) {
                // squelch
                unexpectedHandler(e);
            }
        }
        delete this._proc;
        const container = this.container;
        if (container) {
            const index = container.indexOf(this);
            if (index !== -1) {
                container.splice(index, 1);
            }
            if (!container.length) {
                if (this.onEmpty) {
                    try {
                        this.onEmpty();
                    } catch (e) {
                        // squelch
                        unexpectedHandler(e);
                    }
                }
                if (container.onEmpty) {
                    try {
                        container.onEmpty();
                    } catch (e) {
                        // squelch
                        unexpectedHandler(e);
                    }
                }
            }
        }
    }
}

export class DestroyableTimeout extends Destroyable {
    constructor(proc, delay, container, onEmpty) {
        super(proc, container, onEmpty);
        this._handle = window.setTimeout(() => {
            this.exec();
            this._handle = 0;
            this.destroy();
        }, delay);
    }

    destroy() {
        if (this._handle) {
            window.clearTimeout(this._handle);
            delete this._handle;
        }
        super.destroy();
    }
}

export class DestroyableInterval extends Destroyable {
    constructor(proc, interval, container, onEmpty) {
        super(proc, container, onEmpty);
        this._handle = window.setInterval(this.exec.bind(this), interval);
    }

    destroy() {
        if (this._handle) {
            window.clearInterval(this._handle);
            delete this._handle;
        }
        super.destroy();
    }
}

export function destroyable(proc, container, onEmpty) {
    return new Destroyable(proc, container, onEmpty);
}
