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
    constructor(proc, container, onEmpty, onDestroy) {
        this._proc = proc;
        if (container) {
            (this._container = container).push(this);
            if (onEmpty) {
                this._onEmpty = onEmpty;
            }
        }

        // onDestroy is mutable
        if (onDestroy) {
            this.onDestroy = onDestroy;
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
        const container = this._container;
        if (container) {
            const index = container.indexOf(this);
            if (index !== -1) {
                container.splice(index, 1);
            }
            if (!container.length) {
                if (this._onEmpty) {
                    try {
                        this._onEmpty();
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

export function destroyable(proc, container, onEmpty, onDestroy) {
    return new Destroyable(proc, container, onEmpty, onDestroy);
}

export function destroyAll(container) {
    // deterministic and robust algorithm to destroy handles:
    //   * deterministic even when handle destructors insert handles (though the new handles will not be destroyed)
    //   * robust even when handle destructors cause other handles to be destroyed
    // container is emptied before destroying begins...so if destroying creates handles (probably a bug)
    // then container will not be empty upon return
    if (Array.isArray(container)) {
        const toDestroy = container.slice();
        container.splice(0);
        toDestroy.forEach(h => h.destroy());
    }// else container was likely falsy and never used
}
