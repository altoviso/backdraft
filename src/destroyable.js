function noop() {
}

function destroyable(proc, container, onEmpty) {
    let result = {proc: proc};
    if (container) {
        result.destroy = () => {
            result.destroy = result.proc = noop;
            let index = container.indexOf(result);
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

    return result;
}

function destroyAll(container) {
    // deterministic algorithm to destroy handles that works even when handle destructors
    // cause another handles to be destroyed
    if (Array.isArray(container)) {
        for (let i = 0, end = container.length; i < end && container.length; i++) {
            container.pop().destroy();
        }
    }// else container was likely falsey and never used
}

export {destroyable, destroyAll};
