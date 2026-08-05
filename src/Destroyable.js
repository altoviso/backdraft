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

export function destroyable(proc, container, onEmpty) {
    return new Destroyable(proc, container, onEmpty);
}
