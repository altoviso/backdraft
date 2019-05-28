let _global = 0;
let watchers = [];

export function global() {
    return _global;
}

export function setGlobal(global) {
    if (!_global) {
        _global = global;
        watchers.forEach(handler => handler(global));
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
