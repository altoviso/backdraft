function noop() {
    // do nothing
}

class Destroyable {
    constructor(proc, container, onEmpty) {
        const result = this;
        result.proc = proc;
        if (container) {
            result.destroy = () => {
                result.destroy = result.proc = noop;
                const index = container.indexOf(result);
                if (index !== -1) {
                    container.splice(index, 1);
                }
                !container.length && onEmpty && onEmpty();
            };
            container.push(result);
        } else {
            result.destroy = () => {
                result.destroy = result.proc = noop;
            };
        }
    }

    static destroyAll(container) {
        // deterministic and robust algorithm to destroy handles:
        //   * deterministic even when handle destructors insert handles (though the new handles will not be destroyed)
        //   * robust even when handle destructors cause other handles to be destroyed
        if (Array.isArray(container)) {
            container.slice().forEach(h => h.destroy());
        }// else container was likely falsy and never used
    }
}

export {Destroyable};
