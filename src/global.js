let global = 0;
let watchers = [];

export function getGlobal() {
    return global;
}

export function setGlobal(theGlobal) {
    if (!global) {
        global = theGlobal;
        watchers.forEach(handler => handler(theGlobal));
        watchers = null;
    } else {
        throw new Error('global.setGlobal: illegal to mutate global space');
    }
}

export function adviseGlobal(handler) {
    if (global) {
        handler(global);
    } else {
        watchers.push(handler);
    }
}
