let _global = 0;
let watchers = [];

export function global() {
    return _global;
}

export function setGlobal(theGlobal) {
    if (!_global) {
        _global = theGlobal;
        watchers.forEach(handler => handler(theGlobal));
        watchers = null;
    } else {
        throw new Error('illegal to mutate global space');
    }
}

export function adviseGlobal(handler) {
    if (_global) {
        handler(_global);
    } else {
        watchers.push(handler);
    }
}
