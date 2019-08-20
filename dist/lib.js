let _global = 0;
let watchers = [];

function global() {
    return _global;
}

function setGlobal(theGlobal) {
    if (!_global) {
        _global = theGlobal;
        watchers.forEach(handler => handler(theGlobal));
        watchers = null;
    } else {
        throw new Error('illegal to mutate global space');
    }
}

function adviseGlobal(handler) {
    if (_global) {
        handler(_global);
    } else {
        watchers.push(handler);
    }
}

const postProcessingFuncs = Object.create(null);

function insPostProcessingFunction(name, transform, func) {
    if (typeof transform === 'string') {
        // transform is an alias for name
        if (!postProcessingFuncs[name]) {
            throw Error(`cannot alias to a non-existing post-processing function: ${name}`);
        }
        postProcessingFuncs[transform] = postProcessingFuncs[name];
        return;
    }
    if (arguments.length === 3) {
        if (typeof transform !== 'function') {
            transform = (prop, value) => prop ? {[prop]: value} : value;
        }
    } else {
        func = transform;
        transform = (prop, value) => value;
    }
    func.bdTransform = transform;
    if (postProcessingFuncs[name]) {
        throw Error(`duplicate postprocessing function name: ${name}`);
    }
    postProcessingFuncs[name] = func;
}

function replacePostProcessingFunction(name, func) {
    postProcessingFuncs[name] = func;
}

function getPostProcessingFunction(name) {
    return postProcessingFuncs[name];
}

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

const STAR = Symbol('bd-star');

const eqlComparators = new Map();

function eql(refValue, otherValue) {
    if (!refValue) {
        return otherValue === refValue;
    }
    if (refValue instanceof Object) {
        const comparator = eqlComparators.get(refValue.constructor);
        if (comparator) {
            return comparator(refValue, otherValue);
        }
    }
    if (otherValue instanceof Object) {
        const comparator = eqlComparators.get(otherValue.constructor);
        if (comparator) {
            return comparator(otherValue, refValue);
        }
    }
    return refValue === otherValue;
}

const watcherCatalog = new WeakMap();
const OWNER = Symbol('bd-owner');
const OWNER_NULL = Symbol('bd-owner-null');
const PROP = Symbol('bd-prop');
const UNKNOWN_OLD_VALUE = {
    value: 'UNKNOWN_OLD_VALUE'
};

const pWatchableWatchers = Symbol('bd-pWatchableWatchers');
const pWatchableHandles = Symbol('bd-pWatchableHandles');
const pWatchableSetup = Symbol('bd-pWatchableSetup');

class WatchableRef {
    constructor(referenceObject, prop, formatter) {
        if (typeof prop === 'function') {
            // no prop,...star watcher
            formatter = prop;
            prop = STAR;
        }

        Object.defineProperty(this, 'value', {
            enumerable: true,
            // eslint-disable-next-line func-names
            get: ((function () {
                if (formatter) {
                    if (prop === STAR) {
                        return () => formatter(referenceObject);
                    } else {
                        return () => formatter(referenceObject[prop]);
                    }
                } else if (prop === STAR) {
                    return () => referenceObject;
                } else {
                    return () => referenceObject[prop];
                }
            })())
        });

        // if (referenceObject[OWNER] && prop === STAR), then we cValue===newValue===referenceObject...
        // therefore can't detect internal mutations to referenceObject, so don't try
        const cannotDetectMutations = prop === STAR && referenceObject[OWNER];

        this[pWatchableWatchers] = [];

        let cValue;
        const callback = (newValue, oldValue, target, referenceProp) => {
            if (formatter) {
                oldValue = oldValue === UNKNOWN_OLD_VALUE ? oldValue : formatter(oldValue);
                newValue = formatter(newValue);
            }
            if (cannotDetectMutations || oldValue === UNKNOWN_OLD_VALUE || !eql(cValue, newValue)) {
                this[pWatchableWatchers].slice().forEach(
                    destroyable => destroyable.proc((cValue = newValue), oldValue, target, referenceProp)
                );
            }
        };

        this[pWatchableSetup] = () => {
            cValue = this.value;
            if (referenceObject[OWNER]) {
                this[pWatchableHandles] = [watch(referenceObject, prop, (newValue, oldValue, receiver, _prop) => {
                    if (prop === STAR) {
                        callback(referenceObject, UNKNOWN_OLD_VALUE, referenceObject, _prop);
                    } else {
                        callback(newValue, oldValue, referenceObject, _prop);
                    }
                })];
            } else if (referenceObject.watch) {
                this[pWatchableHandles] = [
                    referenceObject.watch(prop, (newValue, oldValue, target) => {
                        callback(newValue, oldValue, target, prop);
                        if (this[pWatchableHandles].length === 2) {
                            this[pWatchableHandles].pop().destroy();
                        }
                        if (newValue && newValue[OWNER]) {
                            // value is a watchable
                            // eslint-disable-next-line no-shadow
                            this[pWatchableHandles].push(watch(newValue, (newValue, oldValue, receiver, referenceProp) => {
                                callback(receiver, UNKNOWN_OLD_VALUE, referenceObject, referenceProp);
                            }));
                        }
                    })
                ];
                const value = referenceObject[prop];
                if (value && value[OWNER]) {
                    // value is a watchable
                    this[pWatchableHandles].push(watch(value, (newValue, oldValue, receiver, referenceProp) => {
                        callback(receiver, UNKNOWN_OLD_VALUE, referenceObject, referenceProp);
                    }));
                }
                referenceObject.own && referenceObject.own(this);
            } else {
                throw new Error("don't know how to watch referenceObject");
            }
        };
    }

    destroy() {
        Destroyable.destroyAll(this[pWatchableWatchers]);
    }

    watch(watcher) {
        this[pWatchableHandles] || this[pWatchableSetup]();
        return new Destroyable(watcher, this[pWatchableWatchers], () => {
            Destroyable.destroyAll(this[pWatchableHandles]);
            delete this[pWatchableHandles];
        });
    }
}

WatchableRef.pWatchableWatchers = pWatchableWatchers;
WatchableRef.pWatchableHandles = pWatchableHandles;
WatchableRef.pWatchableSetup = pWatchableSetup;
WatchableRef.UNKNOWN_OLD_VALUE = UNKNOWN_OLD_VALUE;
WatchableRef.STAR = STAR;

function getWatchableRef(referenceObject, referenceProp, formatter) {
    // (referenceObject, referenceProp, formatter)
    // (referenceObject, referenceProp)
    // (referenceObject, formatter) => (referenceObject, STAR, formatter)
    // (referenceObject) => (referenceObject, STAR)
    if (typeof referenceProp === 'function') {
        // no referenceProp,...star watcher
        formatter = referenceProp;
        referenceProp = STAR;
    }
    return new WatchableRef(referenceObject, referenceProp || STAR, formatter);
}

function watch(watchable, name, watcher) {
    if (typeof name === 'function') {
        watcher = name;
        name = STAR;
    }

    let variables = watcherCatalog.get(watchable);
    if (!variables) {
        watcherCatalog.set(watchable, (variables = {}));
    }

    // eslint-disable-next-line no-shadow
    const insWatcher = (name, watcher) => new Destroyable(watcher, variables[name] || (variables[name] = []));
    if (!watcher) {
        const hash = name;
        // eslint-disable-next-line no-shadow
        return Reflect.ownKeys(hash).map(name => insWatcher(name, hash[name]));
    } else if (Array.isArray(name)) {
        // eslint-disable-next-line no-shadow
        return name.map(name => insWatcher(name, watcher));
    } else {
        return insWatcher(name, watcher);
    }
}

let holdStarNotifications = false;

function applyWatchers(newValue, oldValue, receiver, name) {
    const catalog = watcherCatalog.get(receiver);
    if (catalog) {
        if (name === STAR) {
            const watchers = catalog[STAR];
            watchers && watchers.slice().forEach(destroyable => destroyable.proc(receiver, oldValue, receiver, [STAR]));
        } else {
            const prop = name[0];
            let watchers = catalog[prop];
            watchers && watchers.slice().forEach(destroyable => destroyable.proc(receiver[prop], oldValue, receiver, name));
            if (!holdStarNotifications) {
                (watchers = catalog[STAR]) && watchers.slice().forEach(
                    destroyable => destroyable.proc(receiver, oldValue, receiver, name)
                );
            }
        }
    }
    if (watch.log) {
        // eslint-disable-next-line no-console
        console.log(name, newValue);
    }
    if (!holdStarNotifications && receiver[OWNER] !== OWNER_NULL) {
        name.unshift(receiver[PROP]);
        applyWatchers(receiver, UNKNOWN_OLD_VALUE, receiver[OWNER], name);
    }
}

let pauseWatchers = false;
const moving = false;
let _silentSet = false;

function set(target, prop, value, receiver) {
    if (_silentSet) {
        target[prop] = value;
        return true;
    } else {
        const oldValue = target[prop];
        if (value instanceof Object) {
            const holdPauseWatchers = pauseWatchers;
            try {
                pauseWatchers = true;
                value = moving ? value : createWatchable(value, receiver, prop);
                pauseWatchers = holdPauseWatchers;
            } catch (e) {
                pauseWatchers = holdPauseWatchers;
                throw e;
            }
        }
        // we would like to set and applyWatchers iff target[prop] !== value. Unfortunately, sometimes target[prop] === value
        // even though we haven't seen the mutation before, e.g., length in an Array instance
        const result = Reflect.set(target, prop, value, receiver);
        !pauseWatchers && applyWatchers(value, oldValue, receiver, [prop]);
        return result;
    }
}

const objectProxyHandler = {
    set
};

const SWAP_OLD_LENGTH = Symbol('SWAP_OLD_LENGTH');
const OLD_LENGTH = Symbol('old-length');
const NO_CHANGE = Symbol('splice-no-change');
const QUICK_COPY = Symbol('slice-quick-copy');
const BEFORE_ADVICE = Symbol('BEFORE_ADVICE');
const noop$1 = () => {
    // do nothing
};

const arrayProxyHandler = {
    set(target, prop, value, receiver) {
        if (prop === 'length') {
            const result = Reflect.set(target, prop, value, receiver);
            const oldValue = target[SWAP_OLD_LENGTH](value);
            !pauseWatchers && !_silentSet && applyWatchers(value, oldValue, receiver, ['length']);
            return result;
        } else {
            return set(target, prop, value, receiver);
        }
    }
};

function getAdvice(owner, method) {
    const advice = owner[BEFORE_ADVICE] && owner[BEFORE_ADVICE][method];
    return advice && advice.map(f => f());
}

class WatchableArray extends Array {
    // note: we can make all of these much more efficient, particularly shift and unshift.
    // But, it's probably rare that it will matter, so we'll do it when the need arises
    [SWAP_OLD_LENGTH](newLength) {
        const result = this[OLD_LENGTH];
        this[OLD_LENGTH] = newLength;
        return result;
    }

    before(method, proc) {
        let beforeAdvice = this[BEFORE_ADVICE];
        if (!beforeAdvice) {
            Object.defineProperty(this, BEFORE_ADVICE, {value: {}});
            beforeAdvice = this[BEFORE_ADVICE];
        }
        const stack = beforeAdvice[method] || (beforeAdvice[method] = []);
        stack.push(proc);
        const handle = {
            destroy() {
                handle.destroy = noop$1;
                const index = stack.indexOf(proc);
                if (index !== -1) stack.splice(index, 1);
            }
        };
        return handle;
    }

    _splice(...args) {
        const oldValues = this.slice(QUICK_COPY);
        const changeSet = [];
        let result;
        try {
            _silentSet = true;
            result = super.splice(...args);
            for (let i = 0, end = Math.max(oldValues.length, this.length); i < end; i++) {
                let value = this[i];
                if (value instanceof Object) {
                    if (value[OWNER]) {
                        if (value[OWNER] !== this) {
                            // a new item that came from another watchable
                            value = this[i] = createWatchable(value, this, i);
                            changeSet.push(value);
                            // eslint-disable-next-line eqeqeq
                        } else if (value[PROP] != i) { // INTENTIONAL !=
                            // an item that was moved within this
                            value[PROP] = i;
                            changeSet.push(value);
                        } else {
                            changeSet.push(NO_CHANGE);
                        }
                    } else {
                        // a new item that is not already a watchable
                        value = this[i] = createWatchable(value, this, i);
                        changeSet.push(value);
                    }
                } else if (value !== oldValues[i]) {
                    changeSet.push(value);
                } else {
                    changeSet.push(NO_CHANGE);
                }
            }
            _silentSet = false;
        } catch (e) {
            try {
                oldValues.forEach((value, i) => (this[i] = value));
            } catch (e) {
                // eslint-disable-next-line no-console
                console.error(e);
            }
            _silentSet = false;
            throw e;
        }
        try {
            holdStarNotifications = true;
            let change = false;
            changeSet.forEach((value, i) => {
                if (value !== NO_CHANGE) {
                    change = true;
                    applyWatchers(value, oldValues[i], this, [i]);
                }
            });
            if (this.length !== oldValues.length) {
                change = true;
                applyWatchers(this.length, oldValues.length, this, ['length']);
            }
            holdStarNotifications = false;
            if (change) {
                applyWatchers(this, UNKNOWN_OLD_VALUE, this, STAR);
            }
        } catch (e) {
            holdStarNotifications = false;
            throw e;
        }
        return result;
    }

    splice(...args) {
        const advice = getAdvice(this, 'splice');
        const result = this._splice(...args);
        advice && advice.map(f => f && f(result));
        return result;
    }

    pop() {
        const advice = getAdvice(this, 'pop');
        const result = fromWatchable(super.pop());
        advice && advice.map(f => f && f(result));
        return result;
    }

    shift() {
        const advice = getAdvice(this, 'shift');
        const result = fromWatchable(this._splice(0, 1)[0]);
        advice && advice.map(f => f && f(result));
        return result;
    }

    slice(...args) {
        return args[0] === QUICK_COPY ? super.slice() : fromWatchable(super.slice(...args));
    }

    unshift(...args) {
        const advice = getAdvice(this, 'unshift');
        this._splice(0, 0, ...args);
        advice && advice.map(f => f && f());
    }

    reverse() {
        const advice = getAdvice(this, 'reverse');
        const oldValues = this.slice(QUICK_COPY);
        try {
            _silentSet = true;
            for (let i = 0, j = this.length - 1; i < j; i++, j--) {
                const temp = this[i];
                this[i] = this[j];
                this[i][PROP] = i;
                this[j] = temp;
                temp[PROP] = j;
            }
            _silentSet = false;
        } catch (e) {
            _silentSet = false;
            throw e;
        }
        try {
            holdStarNotifications = true;
            if (this.length % 2) {
                for (let i = 0, end = Math.floor(this.length / 2); i < end; i++) {
                    applyWatchers(this[i], oldValues[i], this, [i]);
                }
                for (let i = Math.ceil(this.length / 2), end = this.length; i < end; i++) {
                    applyWatchers(this[i], oldValues[i], this, [i]);
                }
            } else {
                this.forEach((value, i) => applyWatchers(value, oldValues[i], this, [i]));
            }
            holdStarNotifications = false;
            if (this.length > 1) {
                applyWatchers(this, UNKNOWN_OLD_VALUE, this, STAR);
            }
        } catch (e) {
            holdStarNotifications = false;
            throw e;
        }
        advice && advice.map(f => f && f(this));
        return this;
    }

    _reorder(proc) {
        const oldValues = this.slice(QUICK_COPY);
        const changeSet = Array(this.length).fill(false);
        let changes = false;
        try {
            _silentSet = true;
            proc(this);
            this.forEach((value, i) => {
                // eslint-disable-next-line eqeqeq
                if (value[PROP] != i) { // INTENTIONAL !=
                    value[PROP] = i;
                    changeSet[i] = true;
                    changes = true;
                }
            });
            _silentSet = false;
        } catch (e) {
            _silentSet = false;
            throw e;
        }
        try {
            holdStarNotifications = true;
            changeSet.forEach((value, i) => {
                if (value) {
                    applyWatchers(this[i], oldValues[i], this, [i]);
                }
            });
            holdStarNotifications = false;
            if (changes) {
                applyWatchers(this, UNKNOWN_OLD_VALUE, this, STAR);
            }
        } catch (e) {
            holdStarNotifications = false;
            throw e;
        }
    }

    reorder(proc) {
        const advice = getAdvice(this, 'reorder');
        this._reorder(proc);
        advice && advice.map(f => f && f(this));
        return this;
    }

    sort(...args) {
        const advice = getAdvice(this, 'sort');
        this._reorder(theArray => super.sort.apply(theArray, args));
        advice && advice.map(f => f && f(this));
        return this;
    }
}

function silentSet(watchable, prop, value, enumerable, configurable) {
    try {
        _silentSet = true;
        if (value === undefined) {
            delete watchable[prop];
        } else if (enumerable !== undefined && !enumerable && !watchable.hasOwnProperty(prop)) {
            Object.defineProperty(watchable, prop, {
                writable: true,
                configurable: configurable !== undefined ? configurable : true,
                value
            });
        } else {
            watchable[prop] = value;
        }
        _silentSet = false;
    } catch (e) {
        _silentSet = false;
        throw e;
    }
}

function createWatchable(src, owner, prop) {
    const keys = Reflect.ownKeys(src);
    const isArray = Array.isArray(src);
    const result = isArray ? new Proxy(new WatchableArray(), arrayProxyHandler) : new Proxy({}, objectProxyHandler);
    if (isArray) {
        keys.forEach(k => k !== 'length' && (result[k] = src[k]));
        Object.defineProperty(result, OLD_LENGTH, {writable: true, value: result.length});
    } else {
        keys.forEach(k => (result[k] = src[k]));
    }

    const silentHold = _silentSet;
    _silentSet = true;
    Object.defineProperty(result, OWNER, {writable: true, value: owner});
    prop !== undefined && Object.defineProperty(result, PROP, {writable: true, value: prop});
    _silentSet = silentHold;
    return result;
}

function toWatchable(data) {
    if (!(data instanceof Object)) {
        throw new Error('scalar values are not watchable');
    }
    try {
        pauseWatchers = true;
        data = createWatchable(data, OWNER_NULL, false);
        pauseWatchers = false;
        return data;
    } catch (e) {
        pauseWatchers = false;
        throw e;
    }
}

function fromWatchable(data) {
    if (data instanceof Object) {
        if (!data) {
            return data;
        }
        if (!data[OWNER]) {
            return data;
        }
        const result = Array.isArray(data) ? Array(data.length) : {};
        Reflect.ownKeys(data).forEach(k => {
            if (k !== OWNER && k !== PROP && k !== OLD_LENGTH) {
                result[k] = fromWatchable(data[k]);
            }
        });
        return result;
    } else {
        return data;
    }
}

const onMutateBeforeNames = {};
const onMutateNames = {};

function mutate(owner, name, privateName, newValue) {
    const oldValue = owner[privateName];
    if (eql(oldValue, newValue)) {
        return false;
    } else {
        let onMutateBeforeName,
            onMutateName;
        if (typeof name !== 'symbol') {
            onMutateBeforeName = onMutateBeforeNames[name];
            if (!onMutateBeforeName) {
                const suffix = name.substring(0, 1).toUpperCase() + name.substring(1);
                onMutateBeforeName = onMutateBeforeNames[name] = `onMutateBefore${suffix}`;
                onMutateName = onMutateNames[name] = `onMutate${suffix}`;
            } else {
                onMutateName = onMutateNames[name];
            }
        }

        if (onMutateBeforeName && owner[onMutateBeforeName]) {
            if (owner[onMutateBeforeName](newValue, oldValue) === false) {
                // the proposed mutation is illegal
                return false;
            }
        }
        if (owner.hasOwnProperty(privateName)) {
            owner[privateName] = newValue;
        } else {
            // not enumerable or configurable
            Object.defineProperty(owner, privateName, {writable: true, value: newValue});
        }
        onMutateName && owner[onMutateName] && owner[onMutateName](newValue, oldValue);
        return [name, newValue, oldValue];
    }
}

function getWatcher(owner, watcher) {
    return typeof watcher === 'function' ? watcher : owner[watcher].bind(owner);
}

function watchHub(superClass) {
    return class extends (superClass || class {
    }) {
        // protected interface...
        bdMutateNotify(name, newValue, oldValue) {
            const variables = watcherCatalog.get(this);
            if (!variables) {
                return;
            }
            if (Array.isArray(name)) {
                // each element in name is either a triple ([name, oldValue, newValue]) or false
                let doStar = false;
                name.forEach(p => {
                    if (p) {
                        doStar = true;
                        const watchers = variables[p[0]];
                        if (watchers) {
                            newValue = p[1];
                            oldValue = p[2];
                            watchers.slice().forEach(destroyable => destroyable.proc(newValue, oldValue, this, name));
                        }
                    }
                });
                if (doStar) {
                    const watchers = variables[STAR];
                    if (watchers) {
                        watchers.slice().forEach(destroyable => destroyable.proc(this, oldValue, this, name));
                    }
                }
            } else {
                let watchers = variables[name];
                if (watchers) {
                    watchers.slice().forEach(destroyable => destroyable.proc(newValue, oldValue, this, name));
                }
                watchers = variables[STAR];
                if (watchers) {
                    watchers.slice().forEach(destroyable => destroyable.proc(newValue, oldValue, this, name));
                }
            }
        }

        bdMutate(name, privateName, newValue) {
            if (arguments.length > 3) {
                let i = 0;
                const results = [];
                let mutateOccurred = false;
                while (i < arguments.length) {
                    // eslint-disable-next-line prefer-rest-params
                    const mutateResult = mutate(this, arguments[i++], arguments[i++], arguments[i++]);
                    mutateOccurred = mutateOccurred || mutateResult;
                    results.push(mutateResult);
                }
                if (mutateOccurred) {
                    this.bdMutateNotify(results);
                    return results;
                }
                return false;
            } else {
                const result = mutate(this, name, privateName, newValue);
                if (result) {
                    this.bdMutateNotify(...result);
                    return result;
                }
                return false;
            }
        }

        // public interface...
        get isBdWatchHub() {
            return true;
        }

        watch(...args) {
            // possible sigs:
            // 1: name, watcher
            // 2: name[], watcher
            // 3: hash: name -> watcher
            // 4: watchable, name, watcher
            // 5: watchable, name[], watcher
            // 6: watchable, hash: name -> watcher
            // 7: watchable, watcher // STAR watcher

            if (arguments.length === 1) {
                // sig 3
                const hash = args[0];
                return Reflect.ownKeys(hash).map(name => this.watch(name, hash[name]));
            }
            if (args[0][OWNER]) {
                // sig 4-6
                let result;
                if (arguments.length === 2) {
                    if (typeof args[1] === 'object') {
                        // sig 6
                        const hash = args[1];
                        Reflect.ownKeys(hash).map(name => (hash[name] = getWatcher(this, hash[name])));
                        result = watch(args[0], hash);
                    } else {
                        // sig 7
                        result = watch(args[0], STAR, getWatcher(this, args[1]));
                    }
                } else {
                    // sig 4 or 5
                    result = watch(args[0], args[1], getWatcher(this, args[2]));
                }
                this.own && this.own(result);
                return result;
            }
            if (Array.isArray(args[0])) {
                // sig 2
                return args[0].map(name => this.watch(name, getWatcher(this, args[1])));
            }
            // sig 1
            const name = args[0];
            const watcher = getWatcher(this, args[1]);
            let variables = watcherCatalog.get(this);
            if (!variables) {
                watcherCatalog.set(this, (variables = {}));
            }
            const result = new Destroyable(watcher, variables[name] || (variables[name] = []));
            this.own && this.own(result);
            return result;
        }

        destroyWatch(name) {
            const variables = watcherCatalog.get(this);

            function destroyList(list) {
                if (list) {
                    while (list.length) list.shift().destroy();
                }
            }

            if (variables) {
                if (name) {
                    destroyList(variables[name]);
                    delete variables[name];
                } else {
                    Reflect.ownKeys(variables).forEach(k => destroyList(variables[k]));
                    watcherCatalog.delete(this);
                }
            }
        }

        getWatchableRef(name, formatter) {
            const result = new WatchableRef(this, name, formatter);
            this.own && this.own(result);
            return result;
        }
    };
}

const WatchHub = watchHub();

function isWatchable(target) {
    return target && target[OWNER];
}

function withWatchables(superClass, ...args) {
    const publicPropNames = [];

    function def(name) {
        let pname;
        if (Array.isArray(name)) {
            pname = name[1];
            name = name[0];
        } else {
            pname = `_${name}`;
        }
        publicPropNames.push(name);
        // eslint-disable-next-line no-use-before-define
        Object.defineProperty(prototype, name, {
            enumerable: true,
            get() {
                return this[pname];
            },
            set(value) {
                this.bdMutate(name, pname, value);
            }
        });
    }

    function init(owner, kwargs) {
        publicPropNames.forEach(name => {
            if (kwargs.hasOwnProperty(name)) {
                owner[name] = kwargs[name];
            }
        });
    }

    const result = class extends superClass {
        constructor(kwargs) {
            kwargs = kwargs || {};
            super(kwargs);
            init(this, kwargs);
        }
    };
    const prototype = result.prototype;
    args.forEach(def);
    result.watchables = publicPropNames.concat(superClass.watchables || []);
    return result;
}

function bind(src, srcProp, dest, destProp) {
    dest[destProp] = src[srcProp];
    if (src.isBdWatchHub) {
        return src.watch(srcProp, newValue => (dest[destProp] = newValue));
    } else if (src[OWNER]) {
        return watch(srcProp, newValue => (dest[destProp] = newValue));
    } else {
        throw new Error('src is not watchable');
    }
}

function biBind(src1, prop1, src2, prop2) {
    src2[prop2] = src1[prop1];
    return [bind(src1, prop1, src2, prop2), bind(src2, prop2, src1, prop1)];
}

let window$1 = 0;
let document = 0;
adviseGlobal(global => {
    window$1 = global;
    document = window$1.document;
});

function getAttributeValueFromEvent(e, attributeName, stopNode) {
    let node = e.target;
    while (node && node !== stopNode) {
        if (node.getAttributeNode(attributeName)) {
            return node.getAttribute(attributeName);
        }
        node = node.parentNode;
    }
    return undefined;
}

function setAttr(node, name, value) {
    if (arguments.length === 2) {
        // name is a hash
        Object.keys(name).forEach(n => setAttr(node, n, name[n]));
    } else if (name === 'style') {
        setStyle(node, value);
    } else if (name === 'innerHTML' || (name in node && node instanceof HTMLElement)) {
        node[name] = value;
    } else {
        node.setAttribute(name, value);
    }
}

function getAttr(node, name) {
    if (name in node && node instanceof HTMLElement) {
        return node[name];
    } else {
        return node.getAttribute(name);
    }
}

let lastComputedStyleNode = 0;
let lastComputedStyle = 0;

function getComputedStyle(node) {
    if (lastComputedStyleNode !== node) {
        lastComputedStyle = window$1.getComputedStyle((lastComputedStyleNode = node));
    }
    return lastComputedStyle;
}

function getStyle(node, property) {
    if (lastComputedStyleNode !== node) {
        lastComputedStyle = window$1.getComputedStyle((lastComputedStyleNode = node));
    }
    const result = lastComputedStyle[property];
    return (typeof result === 'string' && /px$/.test(result)) ? parseFloat(result) : result;
}

function getStyles(node, ...styleNames) {
    if (lastComputedStyleNode !== node) {
        lastComputedStyle = window$1.getComputedStyle((lastComputedStyleNode = node));
    }

    let styles = [];
    styleNames.forEach(styleName => {
        if (Array.isArray(styleName)) {
            styles = styles.concat(styleName);
        } else if (typeof styleName === 'string') {
            styles.push(styleName);
        } else {
            // styleName is a hash
            Object.keys(styleName).forEach(p => styles.push(p));
        }
    });

    const result = {};
    styles.forEach(property => {
        const value = lastComputedStyle[property];
        result[property] = (typeof value === 'string' && /px$/.test(value)) ? parseFloat(value) : value;
    });
    return result;
}

function setStyle(node, property, value) {
    if (arguments.length === 2) {
        if (typeof property === 'string') {
            node.style = property;
        } else {
            // property is a hash
            Object.keys(property).forEach(p => {
                node.style[p] = property[p];
            });
        }
    } else {
        node.style[property] = value;
    }
}

function getPosit(node) {
    const result = node.getBoundingClientRect();
    result.t = result.top;
    result.b = result.bottom;
    result.l = result.left;
    result.r = result.right;
    result.h = result.height;
    result.w = result.width;
    return result;
}

function positStyle(v) {
    return v === false ? '' : `${v}px`;
}

function setPosit(node, posit) {
    // eslint-disable-next-line guard-for-in,no-restricted-syntax
    Object.keys(posit).forEach(p => {
        switch (p) {
            case 't':
                node.style.top = positStyle(posit.t);
                break;
            case 'b':
                node.style.bottom = positStyle(posit.b);
                break;
            case 'l':
                node.style.left = positStyle(posit.l);
                break;
            case 'r':
                node.style.right = positStyle(posit.r);
                break;
            case 'h':
                node.style.height = positStyle(posit.h);
                break;
            case 'w':
                node.style.width = positStyle(posit.w);
                break;
            case 'maxH':
                node.style.maxHeight = positStyle(posit.maxH);
                break;
            case 'maxW':
                node.style.maxWidth = positStyle(posit.maxW);
                break;
            case 'minH':
                node.style.minHeight = positStyle(posit.minH);
                break;
            case 'minW':
                node.style.minWidth = positStyle(posit.minW);
                break;
            case 'z':
                node.style.zIndex = posit.z === false ? '' : posit.z;
                break;
            default:
            // ignore...this allows clients to stuff other properties into posit for other reasons
        }
    });
}

function insertBefore(node, refNode) {
    refNode.parentNode.insertBefore(node, refNode);
}

function insertAfter(node, refNode) {
    const parent = refNode.parentNode;
    if (parent.lastChild === refNode) {
        parent.appendChild(node);
    } else {
        parent.insertBefore(node, refNode.nextSibling);
    }
}

function insert(node, refNode, position) {
    if (position === undefined || position === 'last') {
        // short circuit the common case
        refNode.appendChild(node);
    } else {
        switch (position) {
            case 'before':
                insertBefore(node, refNode);
                break;
            case 'after':
                insertAfter(node, refNode);
                break;
            case 'replace':
                refNode.parentNode.replaceChild(node, refNode);
                return (refNode);
            case 'only': {
                const result = [];
                while (refNode.firstChild) {
                    result.push(refNode.removeChild(refNode.firstChild));
                }
                refNode.appendChild(node);
                return result;
            }
            case 'first':
                if (refNode.firstChild) {
                    insertBefore(node, refNode.firstChild);
                } else {
                    refNode.appendChild(node);
                }
                break;
            default:
                if (typeof position === 'number') {
                    const children = refNode.childNodes;
                    if (!children.length || children.length <= position) {
                        refNode.appendChild(node);
                    } else {
                        insertBefore(node, children[position < 0 ? Math.max(0, children.length + position) : position]);
                    }
                } else {
                    throw new Error('illegal position');
                }
        }
    }
    return 0;
}

function create(tag, props) {
    const result = Array.isArray(tag) ? document.createElementNS(`${tag[0]}`, tag[1]) : document.createElement(tag);
    if (props) {
        Reflect.ownKeys(props).forEach(p => setAttr(result, p, props[p]));
    }
    return result;
}

const DATA_BD_HIDE_SAVED_VALUE = 'data-bd-hide-saved-value';

function hide(...nodes) {
    nodes.forEach(node => {
        if (node) {
            if (!node.hasAttribute(DATA_BD_HIDE_SAVED_VALUE)) {
                node.setAttribute(DATA_BD_HIDE_SAVED_VALUE, node.style.display);
                node.style.display = 'none';
            }// else, ignore, multiple calls to hide
        }
    });
}

function show(...nodes) {
    nodes.forEach(node => {
        if (node) {
            let displayValue = '';
            if (node.hasAttribute(DATA_BD_HIDE_SAVED_VALUE)) {
                displayValue = node.getAttribute(DATA_BD_HIDE_SAVED_VALUE);
                node.removeAttribute(DATA_BD_HIDE_SAVED_VALUE);
            }
            node.style.display = displayValue;
        }
    });
}

function getMaxZIndex(parent) {
    const children = parent.childNodes;
    const end = children.length;
    let node,
        cs,
        max = 0,
        i = 0;
    while (i < end) {
        node = children[i++];
        cs = node && node.nodeType === 1 && getComputedStyle(node);
        max = Math.max(max, (cs && cs.zIndex && Number(cs.zIndex)) || 0);
    }
    return max;
}

function destroyDomChildren(node) {
    let childNode;
    while ((childNode = node.lastChild)) {
        node.removeChild(childNode);
    }
}

function destroyDomNode(node) {
    node && node.parentNode && node.parentNode.removeChild(node);
}

function connect(target, type, listener, useCapture) {
    let destroyed = false;
    useCapture = !!useCapture;
    target.addEventListener(type, listener, useCapture);
    return {
        destroy() {
            if (!destroyed) {
                destroyed = true;
                target.removeEventListener(type, listener, useCapture);
            }
        }
    };
}

function stopEvent(event) {
    if (event && event.preventDefault) {
        event.preventDefault();
        event.stopPropagation();
    }
}

function animate(node, className, onComplete) {
    const h = connect(node, 'animationend', e => {
        if (e.animationName === className) {
            h.destroy();
            node.classList.remove(className);
            if (onComplete) {
                onComplete.destroy ? onComplete.destroy() : onComplete();
            }
        }
    });
    node.classList.add(className);
}

function flattenChildren(children) {
    // children can be falsey, single children (of type Element or string), or arrays of single children, arbitrarily deep
    const result = [];

    function flatten_(child) {
        if (Array.isArray(child)) {
            child.forEach(flatten_);
        } else if (child) {
            result.push(child);
        }
    }

    flatten_(children);
    return result;
}

class Element {
    constructor(type, props, ...children) {
        if (type instanceof Element) {
            // copy constructor
            this.type = type.type;
            type.isComponentType && (this.isComponentType = type.isComponentType);
            type.ctorProps && (this.ctorProps = type.ctorProps);
            type.ppFuncs && (this.ppFuncs = type.ppFuncs);
            type.children && (this.children = type.children);
        } else {
            // type must either be a constructor (a function) or a string; guarantee that as follows...
            if (type instanceof Function) {
                this.isComponentType = true;
                this.type = type;
            } else if (type) {
                // leave this.isComponentType === undefined
                this.type = Array.isArray(type) ? type : `${type}`;
            } else {
                throw new Error('type is required');
            }

            // if the second arg is an Object and not an Element or and Array, then it is props...
            if (props) {
                if (props instanceof Element || Array.isArray(props)) {
                    children.unshift(props);
                    this.ctorProps = {};
                } else if (props instanceof Object) {
                    const ctorProps = {};
                    const ppFuncs = {};
                    let ppFuncsExist = false;
                    let match,
                        ppf;
                    const setPpFuncs = (ppKey, value) => {
                        if (ppFuncs[ppKey]) {
                            const dest = ppFuncs[ppKey];
                            Reflect.ownKeys(value).forEach(k => (dest[k] = value[k]));
                        } else {
                            ppFuncsExist = true;
                            ppFuncs[ppKey] = value;
                        }
                    };
                    Reflect.ownKeys(props).forEach(k => {
                        if ((ppf = getPostProcessingFunction(k))) {
                            const value = ppf.bdTransform(null, props[k]);
                            setPpFuncs(k, value);
                        } else if ((match = k.match(/^([A-Za-z0-9$]+)_(.+)$/)) && (ppf = getPostProcessingFunction(match[1]))) {
                            const ppKey = match[1];
                            const value = ppf.bdTransform(match[2], props[k]);
                            setPpFuncs(ppKey, value);
                        } else {
                            ctorProps[k] = props[k];
                        }
                    });
                    this.ctorProps = Object.freeze(ctorProps);
                    if (ppFuncsExist) {
                        this.ppFuncs = Object.freeze(ppFuncs);
                    }
                } else {
                    children.unshift(props);
                    this.ctorProps = {};
                }
            } else {
                this.ctorProps = {};
            }

            const flattenedChildren = flattenChildren(children);
            if (flattenedChildren.length === 1) {
                const child = flattenedChildren[0];
                this.children = child instanceof Element ? child : `${child}`;
            } else if (flattenedChildren.length) {
                this.children = flattenedChildren.map(child => (child instanceof Element ? child : `${child}`));
                Object.freeze(this.children);
            }// else children.length===0; therefore, no children
        }
        Object.freeze(this);
    }
}

function element(type, props, ...children) {
    // make elements without having to use new
    return new Element(type, props, children);
}

element.addElementType = function addElementType(type) {
    // type is either a constructor (a function) or a string
    if (typeof type === 'function') {
        if (type.name in element) {
            // eslint-disable-next-line no-console
            console.error(type.name, 'already in element');
        } else {
            element[type.name] = (props, ...children) => new Element(type, props, children);
        }
    } else {
        // eslint-disable-next-line no-lonely-if
        if (type in element) {
            // eslint-disable-next-line no-console
            console.error(type, 'already in element');
        } else {
            element[type] = (props, ...children) => new Element(type, props, children);
        }
    }
};

'a.abbr.address.area.article.aside.audio.base.bdi.bdo.blockquote.br.button.canvas.caption.cite.code.col.colgroup.data.datalist.dd.del.details.dfn.div.dl.dt.em.embed.fieldset.figcaption.figure.footer.form.h1.head.header.hr.html.i.iframe.img.input.ins.kbd.label.legend.li.link.main.map.mark.meta.meter.nav.noscript.object.ol.optgroup.option.output.p.param.picture.pre.progress.q.rb.rp.rt.rtc.ruby.s.samp.script.section.select.slot.small.source.span.strong.style.sub.summary.sup.table.tbody.td.template.textarea.tfoot.th.thead.time.title.tr.track.u.ul.var.video.wbr'.split('.').forEach(element.addElementType);

function div(props, ...children) {
    // eslint-disable-next-line no-console
    console.warn('deprecated: use e.div');
    return new Element('div', props, children);
}

const SVG = Object.create(null, {
    toString: {
        value: () => 'http://www.w3.org/2000/svg'
    }
});
Object.freeze(SVG);

function svg(type, props, ...children) {
    if (typeof type !== 'string') {
        children.unshift(props);
        props = type;
        type = 'svg';
    }
    return new Element([SVG, type], props, children);
}

'altGlyph.altGlyphDef.altGlyphItem.animate.animateColor.animateMotion.animateTransform.circle.clipPath.colorprofile.cursor.defs.desc.ellipse.feBlend.feColorMatrix.feComponentTransfer.feComposite.feConvolveMatrix.feDiffuseLighting.feDisplacementMap.feDistantLight.feFlood.feFuncA.feFuncB.feFuncG.feFuncR.feGaussianBlur.feImage.feMerge.feMergeNode.feMorphology.feOffset.fePointLight.feSpecularLighting.feSpotLight.feTile.feTurbulence.filter.font.fontface.fontfaceformat.fontfacename.fontfacesrc.fontfaceuri.foreignObject.g.glyph.glyphRef.hkern.image.line.linearGradient.marker.mask.metadata.missingglyph.mpath.path.pattern.polygon.polyline.radialGradient.rect.script.set.stop.style.svg.switch.symbol.text.textPath.title.tref.tspan.use.view.vkern'.split('.').forEach(tag => {
    svg[tag] = (props, ...children) => svg(tag, props, children);
});

const listenerCatalog = new WeakMap();

function eventHub(superClass) {
    return class extends (superClass || class {
    }) {
        // protected interface...
        bdNotify(e) {
            const events = listenerCatalog.get(this);
            if (!events) {
                return;
            }

            let handlers;
            if (e instanceof Event) {
                handlers = events[e.type];
            } else {
                // eslint-disable-next-line no-lonely-if
                if (e.type) {
                    handlers = events[e.type];
                    e.target = this;
                } else if (!e.name) {
                    handlers = events[e];
                    e = {type: e, name: e, target: this};
                } else {
                    // eslint-disable-next-line no-console
                    console.warn('event.name is deprecated; use event.type');
                    handlers = events[e.name];
                    e.type = e.name;
                    e.target = this;
                }
            }

            if (handlers) {
                handlers.slice().forEach(theDestroyable => theDestroyable.proc(e));
            }
            if ((handlers = events[STAR])) {
                handlers.slice().forEach(theDestroyable => theDestroyable.proc(e));
            }
        }

        // public interface...
        get isBdEventHub() {
            return true;
        }

        advise(eventName, handler) {
            if (!handler) {
                const hash = eventName;
                return Reflect.ownKeys(hash).map(key => this.advise(key, hash[key]));
            } else if (Array.isArray(eventName)) {
                return eventName.map(name => this.advise(name, handler));
            } else {
                let events = listenerCatalog.get(this);
                if (!events) {
                    listenerCatalog.set(this, (events = {}));
                }
                const result = new Destroyable(handler, events[eventName] || (events[eventName] = []));
                this.own && this.own(result);
                return result;
            }
        }

        destroyAdvise(eventName) {
            const events = listenerCatalog.get(this);
            if (!events) {
                return;
            }
            if (eventName) {
                const handlers = events[eventName];
                if (handlers) {
                    handlers.forEach(h => h.destroy());
                    delete events[eventName];
                }
            } else {
                // eslint-disable-next-line no-shadow
                Reflect.ownKeys(events).forEach(eventName => {
                    events[eventName].forEach(h => h.destroy());
                });
                listenerCatalog.delete(this);
            }
        }
    };
}

const EventHub = eventHub();

let document$1 = 0;
adviseGlobal(window => {
    document$1 = window.document;
});

function cleanClassName(s) {
    return s.replace(/\s{2,}/g, ' ').trim();
}

function conditionClassNameArgs(args) {
    return args.reduce((acc, item) => {
        if (item instanceof RegExp) {
            acc.push(item);
        } else if (item) {
            acc = acc.concat(cleanClassName(item).split(' '));
        }
        return acc;
    }, []);
}

function classValueToRegExp(v, args) {
    return v instanceof RegExp ? v : RegExp(` ${v} `, args);
}

function calcDomClassName(component) {
    const staticClassName = component.staticClassName;
    const className = component.bdClassName;
    return staticClassName && className ? (`${staticClassName} ${className}`) : (staticClassName || className);
}

function addChildToDomNode(parent, domNode, child, childIsComponent) {
    if (childIsComponent) {
        const childDomRoot = child.bdDom.root;
        if (Array.isArray(childDomRoot)) {
            childDomRoot.forEach(node => insert(node, domNode));
        } else {
            insert(childDomRoot, domNode);
        }
        parent.bdAdopt(child);
    } else {
        insert(child, domNode);
    }
}

function validateElements(elements) {
    if (Array.isArray(elements)) {
        elements.forEach(validateElements);
    } else if (elements.isComponentType) {
        throw new Error('Illegal: root element(s) for a Component cannot be Components');
    }
}

function postProcess(ppFuncs, owner, target) {
    Reflect.ownKeys(ppFuncs).forEach(ppf => {
        const args = ppFuncs[ppf];
        if (Array.isArray(args)) {
            getPostProcessingFunction(ppf)(owner, target, ...args);
        } else {
            getPostProcessingFunction(ppf)(owner, target, args);
        }
    });
}

function noop$2() {
    // do nothing
}

function pushHandles(dest, ...handles) {
    handles.forEach(h => {
        if (Array.isArray(h)) {
            pushHandles(dest, ...h);
        } else if (h) {
            const destroy = h.destroy.bind(h);
            h.destroy = () => {
                destroy();
                const index = dest.indexOf(h);
                if (index !== -1) {
                    dest.splice(index, 1);
                }
                h.destroy = noop$2;
            };
            dest.push(h);
        }
    });
}

const ownedHandlesCatalog = new WeakMap();
const domNodeToComponent = new Map();

class Component extends eventHub(WatchHub) {
    constructor(kwargs = {}) {
        // notice that this class requires only the per-instance data actually used by its subclass/instance
        super();

        if (!this.constructor.noKwargs) {
            this.kwargs = kwargs;
        }

        // id, if provided, is read-only
        if (kwargs.id) {
            Object.defineProperty(this, 'id', { value: `${kwargs.id}`, enumerable: true });
        }

        if (kwargs.className) {
            Array.isArray(kwargs.className) ? this.addClassName(...kwargs.className) : this.addClassName(kwargs.className);
        }

        if (kwargs.tabIndex !== undefined) {
            this.tabIndex = kwargs.tabIndex;
        }

        if (kwargs.title) {
            this.title = kwargs.title;
        }

        if (kwargs.disabled || (kwargs.enabled !== undefined && !kwargs.enabled)) {
            this.disabled = true;
        }

        if (kwargs.visible !== undefined) {
            this.visible = kwargs.visible;
        }

        if (kwargs.elements) {
            if (typeof kwargs.elements === 'function') {
                this.bdElements = kwargs.elements;
            } else {
                this.bdElements = () => kwargs.elements;
            }
        }

        if (kwargs.postRender) {
            this.postRender = kwargs.postRender;
        }

        if (kwargs.mix) {
            Reflect.ownKeys(kwargs.mix).forEach(p => (this[p] = kwargs.mix[p]));
        }

        if (kwargs.callbacks) {
            const events = this.constructor.events;
            Reflect.ownKeys(kwargs.callbacks).forEach(key => {
                if (events.indexOf(key) !== -1) {
                    this.advise(key, kwargs.callbacks[key]);
                } else {
                    this.watch(key, kwargs.callbacks[key]);
                }
            });
        }
    }

    destroy() {
        if (!this.destroyed) {
            this.destroyed = 'in-prog';
            this.unrender();
            const handles = ownedHandlesCatalog.get(this);
            if (handles) {
                Destroyable.destroyAll(handles);
                ownedHandlesCatalog.delete(this);
            }
            this.destroyWatch();
            this.destroyAdvise();
            delete this.kwargs;
            this.destroyed = true;
        }
    }

    render(
        proc // [function, optional] called after this class's render work is done, called in context of this
    ) {
        if (!this.bdDom) {
            const dom = this.bdDom = this._dom = {};
            const elements = this.bdElements();
            validateElements(elements);
            const root = dom.root = this.constructor.renderElements(this, elements);
            if (Array.isArray(root)) {
                root.forEach(node => domNodeToComponent.set(node, this));
            } else {
                domNodeToComponent.set(root, this);
                if (this.id) {
                    root.id = this.id;
                }
                this.addClassName(root.getAttribute('class') || '');
                const className = calcDomClassName(this);
                if (className) {
                    root.setAttribute('class', className);
                }

                if (this.bdDom.tabIndexNode) {
                    if (this.bdTabIndex === undefined) {
                        this.bdTabIndex = this.bdDom.tabIndexNode.tabIndex;
                    } else {
                        this.bdDom.tabIndexNode.tabIndex = this.bdTabIndex;
                    }
                } else if (this.bdTabIndex !== undefined) {
                    (this.bdDom.tabIndexNode || this.bdDom.root).tabIndex = this.bdTabIndex;
                }
                if (this.bdTitle !== undefined) {
                    (this.bdDom.titleNode || this.bdDom.root).title = this.bdTitle;
                }
                this[this.bdDisabled ? 'addClassName' : 'removeClassName']('bd-disabled');
                if (!this.visible) {
                    this._hiddenDisplayStyle = root.style.display;
                    root.style.display = 'none';
                }
            }
            this.ownWhileRendered(this.postRender());
            proc && proc.call(this);
            this.bdMutateNotify('rendered', true, false);
        }
        return this.bdDom.root;
    }

    postRender() {
        // no-op
    }

    bdElements() {
        return new Element('div', {});
    }

    unrender() {
        if (this.rendered) {
            if (this.bdParent) {
                this.bdParent.delChild(this, true);
            }

            if (this.children) {
                this.children.slice().forEach(child => {
                    child.destroy();
                });
            }
            delete this.children;

            const root = this.bdDom.root;
            if (Array.isArray(root)) {
                root.forEach(node => {
                    domNodeToComponent.delete(node);
                    node.parentNode && node.parentNode.removeChild(node);
                });
            } else {
                domNodeToComponent.delete(root);
                root.parentNode && root.parentNode.removeChild(root);
            }
            Destroyable.destroyAll(this.bdDom.handles);
            delete this.bdDom;
            delete this._dom;
            delete this._hiddenDisplayStyle;
            this.bdAttachToDoc(false);
            this.bdMutateNotify('rendered', false, true);
        }
    }

    get rendered() {
        return !!(this.bdDom && this.bdDom.root);
    }

    own(...handles) {
        let _handles = ownedHandlesCatalog.get(this);
        if (!_handles) {
            ownedHandlesCatalog.set(this, (_handles = []));
        }
        pushHandles(_handles, ...handles);
    }

    ownWhileRendered(...handles) {
        pushHandles(this.bdDom.handles || (this.bdDom.handles = []), ...handles);
    }

    get parent() {
        return this.bdParent;
    }

    bdAdopt(child) {
        if (child.bdParent) {
            throw new Error('unexpected');
        }
        (this.children || (this.children = [])).push(child);

        child.bdMutate('parent', 'bdParent', this);
        child.bdAttachToDoc(this.bdAttachedToDoc);
    }

    bdAttachToDoc(value) {
        if (this.bdMutate('attachedToDoc', 'bdAttachedToDoc', !!value)) {
            if (value && this.resize) {
                this.resize();
            }
            this.children && this.children.forEach(child => child.bdAttachToDoc(value));
            return true;
        } else {
            return false;
        }
    }

    get attachedToDoc() {
        return !!this.bdAttachedToDoc;
    }

    insChild(...args) {
        if (!this.rendered) {
            throw new Error('parent component must be rendered before explicitly inserting a child');
        }
        let { src, attachPoint, position } = decodeRender(args);
        let child;
        if (src instanceof Component) {
            child = src;
            if (child.parent) {
                child.parent.delChild(child, true);
            }
            child.render();
        } else { // child instanceof Element
            if (!src.isComponentType) {
                src = new Element(Component, { elements: src });
            }
            child = this.constructor.renderElements(this, src);
        }

        if (/before|after|replace|only|first|last/.test(attachPoint) || typeof attachPoint === 'number') {
            position = attachPoint;
            attachPoint = 0;
        }

        if (attachPoint) {
            if (attachPoint in this) {
                // node reference
                attachPoint = this[attachPoint];
            } else if (typeof attachPoint === 'string') {
                attachPoint = document$1.getElementById(attachPoint);
                if (!attachPoint) {
                    throw new Error('unexpected');
                }
            } else if (position !== undefined) {
                // attachPoint must be a child Component
                const index = this.children ? this.children.indexOf(attachPoint) : -1;
                if (index !== -1) {
                    // attachPoint is a child
                    attachPoint = attachPoint.bdDom.root;
                    if (Array.isArray(attachPoint)) {
                        switch (position) {
                            case 'replace':
                            case 'only':
                            case 'before':
                                attachPoint = attachPoint[0];
                                break;
                            case 'after':
                                attachPoint = attachPoint[attachPoint.length - 1];
                                break;
                            default:
                                throw new Error('unexpected');
                        }
                    }
                } else {
                    throw new Error('unexpected');
                }
            } else {
                // attachPoint without a position must give a node reference
                throw new Error('unexpected');
            }
        } else if (child.bdParentAttachPoint) {
            // child is telling the parent where it wants to go; this is more specific than pChildrenAttachPoint
            if (child.bdParentAttachPoint in this) {
                attachPoint = this[child.bdParentAttachPoint];
            } else {
                throw new Error('unexpected');
            }
        } else {
            attachPoint = this.bdChildrenAttachPoint || this.bdDom.root;
            if (Array.isArray(attachPoint)) {
                throw new Error('unexpected');
            }
        }

        const childRoot = child.bdDom.root;
        if (Array.isArray(childRoot)) {
            const firstChildNode = childRoot[0];
            unrender(insert(firstChildNode, attachPoint, position));
            childRoot.slice(1).reduce((prevNode, node) => {
                insert(node, prevNode, 'after');
                return node;
            }, firstChildNode);
        } else {
            unrender(insert(childRoot, attachPoint, position));
        }

        this.bdAdopt(child);
        return child;
    }

    delChild(child, preserve) {
        const index = this.children ? this.children.indexOf(child) : -1;
        if (index !== -1) {
            const root = child.bdDom && child.bdDom.root;
            const removeNode = node => {
                node.parentNode && node.parentNode.removeChild(node);
            };
            Array.isArray(root) ? root.forEach(removeNode) : removeNode(root);
            child.bdMutate('parent', 'bdParent', null);
            child.bdAttachToDoc(false);
            this.children.splice(index, 1);
            if (!preserve) {
                child.destroy();
                child = false;
            } else if (preserve === 'unrender') {
                child.unrender();
            }
            return child;
        }
        return false;
    }

    delChildren(preserve) {
        return this.children.slice().map(child => this.delChild(child, preserve));
    }

    reorderChildren(children) {
        if (children === this.children) {
            children = this.children.slice();
        }
        const thisChildren = this.children;
        if (thisChildren && thisChildren.length) {
            const node = children.bdDom.root.parentNode;
            children.forEach((child, i) => {
                if (thisChildren[i] !== child) {
                    const index = thisChildren.indexOf(child, i + 1);
                    thisChildren.splice(index, 1);
                    node.insertBefore(child.bdDom.root, thisChildren[i].bdDom.root);
                    thisChildren.splice(i, 0, child);
                }
            });
        }
    }

    get staticClassName() {
        return this.kwargs.hasOwnProperty('staticClassName') ?
            this.kwargs.staticClassName : (this.constructor.className || '');
    }

    get className() {
        // WARNING: if a staticClassName was given as a constructor argument, then that part of node.className is NOT returned
        if (this.rendered) {
            // if rendered, then look at what's actually in the document...maybe client code _improperly_ manipulated directly
            let root = this.bdDom.root;
            if (Array.isArray(root)) {
                root = root[0];
            }
            let className = root.className;
            const staticClassName = this.staticClassName;
            if (staticClassName) {
                staticClassName.split(' ').forEach(s => (className = className.replace(s, '')));
            }
            return cleanClassName(className);
        } else {
            return this.bdClassName || '';
        }
    }

    set className(value) {
        // WARNING: if a staticClassName was given as a constructor argument, then that part of node.className is NOT affected

        // clean up any space sloppiness, sometimes caused by client-code algorithms that manipulate className
        value = cleanClassName(value);
        if (!this.bdClassName) {
            this.bdSetClassName(value, '');
        } else if (!value) {
            this.bdSetClassName('', this.bdClassName);
        } else if (value !== this.bdClassName) {
            this.bdSetClassName(value, this.bdClassName);
        }
    }

    containsClassName(value) {
        // WARNING: if a staticClassName was given as a constructor argument, then that part of node.className is NOT considered

        value = cleanClassName(value);
        return (` ${this.bdClassName || ''} `).indexOf(value) !== -1;
    }

    addClassName(...values) {
        const current = this.bdClassName || '';
        this.bdSetClassName(conditionClassNameArgs(values).reduce((className, value) => {
            return classValueToRegExp(value).test(className) ? className : `${className + value} `;
        }, ` ${current} `).trim(), current);
        return this;
    }

    removeClassName(...values) {
        // WARNING: if a staticClassName was given as a constructor argument, then that part of node.className is NOT considered
        const current = this.bdClassName || '';
        this.bdSetClassName(conditionClassNameArgs(values).reduce((className, value) => {
            return className.replace(classValueToRegExp(value, 'g'), ' ');
        }, ` ${current} `).trim(), current);
        return this;
    }

    toggleClassName(...values) {
        // WARNING: if a staticClassName was given as a constructor argument, then that part of node.className is NOT considered
        const current = this.bdClassName || '';
        this.bdSetClassName(conditionClassNameArgs(values).reduce((className, value) => {
            if (classValueToRegExp(value).test(className)) {
                return className.replace(classValueToRegExp(value, 'g'), ' ');
            } else {
                return `${className + value} `;
            }
        }, ` ${current} `).trim(), current);
        return this;
    }

    get classList() {
        if (!this._classList) {
            const self = this;
            this._classList = {
                get() {
                    return self.className;
                },

                set(value) {
                    return (self.className = value);
                },

                add(...values) {
                    return self.addClassName(...values);
                },

                ins(...values) {
                    return self.addClassName(...values);
                },

                remove(...values) {
                    return self.removeClassName(...values);
                },

                del(...values) {
                    return self.removeClassName(...values);
                },

                toggle(...values) {
                    return self.toggleClassName(...values);
                },

                contains(...values) {
                    return self.containsClassName(...values);
                },

                has(...values) {
                    return self.containsClassName(...values);
                }
            };
        }
        return this._classList;
    }

    bdSetClassName(newValue, oldValue) {
        if (newValue !== oldValue) {
            this.bdClassName = newValue;
            if (this.rendered) {
                this.bdDom.root.setAttribute('class', calcDomClassName(this));
            }
            if (this.rendered && !Array.isArray(this.bdDom.root)) {
                this.bdDom.root.setAttribute('class', calcDomClassName(this));
            }
            this.bdMutateNotify('className', newValue, oldValue);
            const oldVisibleValue = oldValue ? oldValue.indexOf('bd-hidden') === -1 : true,
                newVisibleValue = newValue ? newValue.indexOf('bd-hidden') === -1 : true;
            if (oldVisibleValue !== newVisibleValue) {
                this.bdMutateNotify('visible', newVisibleValue, oldVisibleValue);
            }
        }
    }

    bdOnFocus() {
        this.addClassName('bd-focused');
        this.bdMutate('hasFocus', 'bdHasFocus', true);
    }

    bdOnBlur() {
        this.removeClassName('bd-focused');
        this.bdMutate('hasFocus', 'bdHasFocus', false);
    }

    get hasFocus() {
        return !!this.bdHasFocus;
    }

    focus() {
        if (this.bdDom) {
            (this.bdDom.tabIndexNode || this.bdDom.root).focus();
        }
    }

    setItem(...args) {
        let data = this.bdData || {};
        let i = 0;
        const end = args.length - 2;
        while (i < end) {
            data = data[args[i]] || (data[args[i]] = {});
            i++;
        }
        data[args[i]] = args[i + 1];
    }

    getItem(...args) {
        let data = this.bdData;
        for (let i = 0, end = args.length; data !== undefined && i < end;) {
            data = data[args[i++]];
        }
        return data;
    }

    removeItem(...args) {
        let data = this.bdData;
        const i = 0;
        for (const end = args.length - 1; data !== undefined && i < end;) {
            data = data[args[i]++];
        }
        if (data) {
            const result = data[args[i]];
            delete data[args[i]];
            return result;
        } else {
            return undefined;
        }
    }

    getAttr(name) {
        return getAttr(this.bdDom.root, name);
    }

    setAttr(name, value) {
        return setAttr(this.bdDom.root, name, value);
    }

    getStyle(property) {
        return getStyle(this.bdDom.root, property);
    }

    getStyles(...styleNames) {
        return getStyles(this.bdDom.root, styleNames);
    }

    setStyle(property, value) {
        return setStyle(this.bdDom.root, property, value);
    }

    animate(className, onComplete) {
        if (this.rendered) {
            const h = connect(this.bdDom.root, 'animationend', e => {
                if (e.animationName === className) {
                    h.destroy();
                    !this.destroyed && this.removeClassName(className);
                    if (onComplete) {
                        onComplete.destroy ? onComplete.destroy() : onComplete();
                    }
                }
            });
            if (!this.containsClassName(className)) {
                this.addClassName(className);
            }
        }
    }

    getPosit() {
        return getPosit(this.bdDom.root);
    }

    setPosit(posit) {
        setPosit(this.bdDom.root, posit);
    }

    get uid() {
        return this.bdUid || (this.bdUid = Symbol('component-instance-uid'));
    }

    get tabIndex() {
        if (this.rendered) {
            // unconditionally make sure this.bdTabIndex and the dom is synchronized on each get
            return (this.bdTabIndex = (this.bdDom.tabIndexNode || this.bdDom.root).tabIndex);
        } else {
            return this.bdTabIndex;
        }
    }

    set tabIndex(value) {
        if (!value && value !== 0) {
            value = '';
        }
        if (value !== this.bdTabIndex) {
            this.rendered && ((this.bdDom.tabIndexNode || this.bdDom.root).tabIndex = value);
            this.bdMutate('tabIndex', 'bdTabIndex', value);
        }
    }

    get enabled() {
        return !this.bdDisabled;
    }

    set enabled(value) {
        this.disabled = !value;
    }

    get disabled() {
        return !!this.bdDisabled;
    }

    set disabled(value) {
        value = !!value;
        if (this.bdDisabled !== value) {
            this.bdDisabled = value;
            this.bdMutateNotify([['disabled', value, !value], ['enabled', !value, value]]);
            this[value ? 'addClassName' : 'removeClassName']('bd-disabled');
        }
    }

    get visible() {
        return !this.containsClassName('bd-hidden');
    }

    set visible(value) {
        value = !!value;
        if (value !== !this.containsClassName('bd-hidden')) {
            if (value) {
                this.removeClassName('bd-hidden');
                const node = this.bdDom && this.bdDom.root;
                if (this._hiddenDisplayStyle !== undefined) {
                    node && (node.style.display = this._hiddenDisplayStyle);
                    delete this._hiddenDisplayStyle;
                }
                this.resize && this.resize();
            } else {
                this.addClassName('bd-hidden');
                const node = this.bdDom && this.bdDom.root;
                if (node) {
                    this._hiddenDisplayStyle = node.style.display;
                    node.style.display = 'none';
                }
            }
            this.bdMutateNotify('visible', value, !value);
        }
    }

    get title() {
        if (this.rendered) {
            return (this.bdDom.titleNode || this.bdDom.root).title;
        } else {
            return this.bdTitle;
        }
    }

    set title(value) {
        if (this.bdMutate('title', 'bdTitle', value)) {
            this.rendered && ((this.bdDom.titleNode || this.bdDom.root).title = value);
        }
    }

    static get(domNode) {
        return domNodeToComponent.get(domNode);
    }

    static renderElements(owner, e) {
        if (Array.isArray(e)) {
            // eslint-disable-next-line no-shadow
            return e.map(e => Component.renderElements(owner, e));
        } else if (e instanceof Element) {
            const { type, ctorProps, ppFuncs, children } = e;
            let result;
            if (e.isComponentType) {
                // eslint-disable-next-line new-cap
                const componentInstance = result = new type(ctorProps);
                componentInstance.render();
                ppFuncs && postProcess(ppFuncs, owner, componentInstance);
                if (children) {
                    const renderedChildren = Component.renderElements(owner, children);
                    if (Array.isArray(renderedChildren)) {
                        renderedChildren.forEach(child => result.insChild(child));
                    } else {
                        result.insChild(renderedChildren);
                    }
                }
            } else {
                const domNode = result = create(type, ctorProps);
                if ('tabIndex' in ctorProps && ctorProps.tabIndex !== false) {
                    owner.bdDom.tabIndexNode = domNode;
                }
                ppFuncs && postProcess(ppFuncs, owner, domNode);
                if (children) {
                    const renderedChildren = Component.renderElements(owner, children);
                    if (Array.isArray(renderedChildren)) {
                        renderedChildren.forEach(
                            (child, i) => addChildToDomNode(owner, domNode, child, children[i].isComponentType)
                        );
                    } else {
                        addChildToDomNode(owner, domNode, renderedChildren, children.isComponentType);
                    }
                }
            }
            return result;
        } else {
            // e must be convertible to a string
            return document$1.createTextNode(e);
        }
    }
}

Component.watchables = ['rendered', 'parent', 'attachedToDoc', 'className', 'hasFocus', 'tabIndex', 'enabled', 'visible', 'title'];
Component.events = [];
Component.withWatchables = (...args) => withWatchables(Component, ...args);

function isComponentDerivedCtor(f) {
    return f === Component || (f && isComponentDerivedCtor(Object.getPrototypeOf(f)));
}

const prototypeOfObject = Object.getPrototypeOf({});

function decodeRender(args) {
    // eight signatures...
    // Signatures 1-2 render an element, 3-6 render a Component, 7-8 render an instance of a Component
    //
    // Each of the above groups may or may not have the args node:domNode[, position:Position="last"]
    // which indicate where to attach the rendered Component instance (or not).
    //
    // when this decode routine is used by Component::insertChild, then node can be a string | symbol, indicating
    // an instance property that holds the node
    //
    // 1. render(e:Element)
    // => isComponentDerivedCtor(e.type), then render e.type(e.props); otherwise, render Component({elements:e})
    //
    // 2. render(e:Element, node:domNode[, position:Position="last"])
    //    => [1] with attach information
    //
    // 3. render(C:Component)
    // => render(C, {})
    //
    // 4. render(C:Component, args:kwargs)
    // => render(C, args)
    // // note: args is kwargs for C's constructor; therefore, postprocessing instructions are meaningless unless C's
    // // construction defines some usage for them (atypical)
    //
    // 5. render(C:Component, node:domNode[, position:Position="last"])
    // => [3] with attach information
    //
    // 6. render(C:Component, args:kwargs, node:domNode[, position:Position="last"])
    // => [4] with attach information
    //
    // 7. render(c:instanceof Component)
    // => c.render()
    //
    // 8. render(c:instanceof Component, node:domNode[, position:Position="last"])
    //    => [7] with attach information
    //
    // Position one of "first", "last", "before", "after", "replace", "only"; see dom::insert
    //
    // returns {
    //        src: instanceof Component | Element
    //        attachPoint: node | string | undefined
    //        position: string | undefined
    // }
    //
    // for signatures 3-6, an Element is manufactured given the arguments

    const [arg1, arg2, arg3, arg4] = args;
    if (arg1 instanceof Element || arg1 instanceof Component) {
        // [1] or [2] || [7] or [8]
        return { src: arg1, attachPoint: arg2, position: arg3 };
    } else {
        if (!isComponentDerivedCtor(arg1)) {
            throw new Error('first argument must be an Element, Component, or a class derived from Component');
        }
        if (args.length === 1) {
            // [3]
            return { src: new Element(arg1) };
        } else {
            // more than one argument; the second argument is either props or not
            // eslint-disable-next-line no-lonely-if
            if (Object.getPrototypeOf(arg2) === prototypeOfObject) {
                // [4] or [6]
                // WARNING: this signature requires kwargs to be a plain Javascript Object (which is should be!)
                return { src: new Element(arg1, arg2), attachPoint: arg3, position: arg4 };
            } else {
                // [5]
                return { src: new Element(arg1), attachPoint: arg2, position: arg3 };
            }
        }
    }
}

function unrender(node) {
    function unrender_(n) {
        const component = domNodeToComponent.get(n);
        if (component) {
            component.destroy();
        }
    }

    Array.isArray(node) ? node.forEach(unrender_) : (node && unrender_(node));
}

function render(...args) {
    let result;
    let { src, attachPoint, position } = decodeRender(args);
    if (src instanceof Element) {
        if (src.isComponentType) {
            // eslint-disable-next-line new-cap
            result = new src.type(src.ctorProps);
        } else {
            result = new Component({ elements: src });
        }
        result.render();
    } else { // src instanceof Component
        result = src;
        result.render();
    }

    if (typeof attachPoint === 'string') {
        attachPoint = document$1.getElementById(attachPoint);
    }

    if (attachPoint) {
        const root = result.bdDom.root;
        if (Array.isArray(root)) {
            const firstChildNode = root[0];
            unrender(insert(firstChildNode, attachPoint, position));
            root.slice(1).reduce((prevNode, node) => {
                insert(node, prevNode, 'after');
                return node;
            }, firstChildNode);
        } else {
            unrender(insert(root, attachPoint, position));
        }
        result.bdAttachToDoc(document$1.body.contains(attachPoint));
    }
    return result;
}

insPostProcessingFunction(
    'bdAttach',
    (ppfOwner, ppfTarget, name) => {
        if (typeof name === 'function') {
            ppfOwner.ownWhileRendered(name(ppfTarget, ppfOwner));
        } else {
            ppfOwner[name] = ppfTarget;
            ppfOwner.ownWhileRendered({
                destroy() {
                    delete ppfOwner[name];
                }
            });
        }
    }
);

insPostProcessingFunction(
    'bdWatch', true,
    (ppfOwner, ppfTarget, watchers) => {
        Reflect.ownKeys(watchers).forEach(eventType => {
            let watcher = watchers[eventType];
            if (typeof watcher !== 'function') {
                watcher = ppfOwner[eventType].bind(ppfOwner);
            }
            ppfTarget.ownWhileRendered(ppfTarget.watch(eventType, watcher));
        });
    }
);

insPostProcessingFunction(
    'bdExec',
    (ppfOwner, ppfTarget, ...args) => {
        for (let i = 0; i < args.length;) {
            const f = args[i++];
            if (typeof f === 'function') {
                f(ppfOwner, ppfTarget);
            } else if (typeof f === 'string') {
                if (!(typeof ppfTarget[f] === 'function')) {
                    // eslint-disable-next-line no-console
                    console.error('unexpected');
                }
                if (i < args.length && Array.isArray(args[i])) {
                    ppfTarget[f](...args[i++], ppfOwner, ppfTarget);
                } else {
                    ppfTarget[f](ppfOwner, ppfTarget);
                }
            } else {
                // eslint-disable-next-line no-console
                console.error('unexpected');
            }
        }
    }
);

insPostProcessingFunction(
    'bdTitleNode',
    (ppfOwner, ppfTarget) => {
        ppfOwner.bdDom.titleNode = ppfTarget;
    }
);

insPostProcessingFunction(
    'bdParentAttachPoint',
    (ppfOwner, ppfTarget, propertyName) => {
        ppfTarget.bdParentAttachPoint = propertyName;
    }
);

insPostProcessingFunction(
    'bdChildrenAttachPoint',
    (ppfOwner, ppfTarget) => {
        ppfOwner.bdChildrenAttachPoint = ppfTarget;
    }
);

insPostProcessingFunction(
    'bdReflectClass',
    (ppfOwner, ppfTarget, ...args) => {
        // args is a list of ([owner, ] property, [, formatter])...
        // very much like bdReflect, except we're adding/removing components (words) from this.classname

        function normalize(value) {
            return !value ? '' : `${value}`;
        }

        function install(owner, prop, formatter) {
            const watchable = getWatchableRef(owner, prop, formatter);
            ppfOwner.ownWhileRendered(watchable);
            const value = normalize(watchable.value);
            if (value) {
                if (ppfOwner.bdDom.root === ppfTarget) {
                    // mutating className on the root node of a component
                    ppfOwner.addClassName(value);
                } else {
                    ppfTarget.classList.add(value);
                }
            }
            ppfOwner.ownWhileRendered(watchable.watch((newValue, oldValue) => {
                newValue = normalize(newValue);
                oldValue = normalize(oldValue);
                if (newValue !== oldValue) {
                    if (ppfOwner.bdDom.root === ppfTarget) {
                        // mutating className on the root node of a component
                        oldValue && ppfOwner.removeClassName(oldValue);
                        newValue && ppfOwner.addClassName(newValue);
                    } else {
                        oldValue && ppfTarget.classList.remove(oldValue);
                        newValue && ppfTarget.classList.add(newValue);
                    }
                }
            }));
        }

        args = args.slice();
        let owner,
            prop;
        while (args.length) {
            owner = args.shift();
            if (typeof owner === 'string' || typeof owner === 'symbol') {
                prop = owner;
                owner = ppfOwner;
            } else {
                prop = args.shift();
            }
            install(owner, prop, typeof args[0] === 'function' ? args.shift() : null);
        }
    }
);

insPostProcessingFunction(
    'bdReflect',
    (prop, value) => {
        if (prop === null && value instanceof Object && !Array.isArray(value)) {
            // e.g., bdReflect:{p1:"someProp", p2:[refObject, "someOtherProp", someFormatter]}
            return value;
        } else if (prop) {
            // e.g., bdReflect_someProp: [refObject, ] prop [, someFormatter]
            return {[prop]: value};
        } else {
            // e.g., bdReflect: [refObject, ] prop [, someFormatter]
            return {innerHTML: value};
        }
    },
    (ppfOwner, ppfTarget, props) => {
        // props is a hash from property in ppfTarget to a list of ([refObject, ] property, [, formatter])...
        let install,
            watchable;
        if (ppfTarget instanceof Component) {
            install = (destProp, refObject, prop, formatter) => {
                ppfOwner.ownWhileRendered((watchable = getWatchableRef(refObject, prop, formatter)));
                ppfTarget[destProp] = watchable.value;
                ppfOwner.ownWhileRendered(watchable.watch(newValue => {
                    ppfTarget[destProp] = newValue;
                }));
            };
        } else {
            install = (destProp, refObject, prop, formatter) => {
                ppfOwner.ownWhileRendered((watchable = getWatchableRef(refObject, prop, formatter)));
                setAttr(ppfTarget, destProp, watchable.value);
                ppfOwner.ownWhileRendered(watchable.watch(newValue => {
                    setAttr(ppfTarget, destProp, newValue);
                }));
            };
        }

        Reflect.ownKeys(props).forEach(destProp => {
            const args = Array.isArray(props[destProp]) ? props[destProp].slice() : [props[destProp]];
            let refObject,
                prop;
            while (args.length) {
                refObject = args.shift();
                if (typeof refObject === 'string' || typeof refObject === 'symbol') {
                    prop = refObject;
                    refObject = ppfOwner;
                } else {
                    prop = args.shift();
                }
                install(destProp, refObject, prop, typeof args[0] === 'function' ? args.shift() : null);
            }
        });
    }
);

insPostProcessingFunction(
    'bdAdvise', true,
    (ppfOwner, ppfTarget, listeners) => {
        Reflect.ownKeys(listeners).forEach(eventType => {
            let listener = listeners[eventType];
            if (typeof listener !== 'function') {
                listener = ppfOwner[listener].bind(ppfOwner);
            }
            ppfOwner.ownWhileRendered(
                ppfTarget instanceof Component ?
                    ppfTarget.advise(eventType, listener) :
                    connect(ppfTarget, eventType, listener)
            );
        });
    }
);
insPostProcessingFunction('bdAdvise', 'bdOn');

let focusedNode = null;
let previousFocusedNode = null;
let focusedComponent = null;
let previousFocusedComponent = null;
let nextFocusedComponent = null;
const focusStack = [];

class FocusManager extends watchHub(EventHub) {
    get focusedNode() {
        return focusedNode;
    }

    get previousFocusedNode() {
        return previousFocusedNode;
    }

    get focusedComponent() {
        return focusedComponent;
    }

    get previousFocusedComponent() {
        return previousFocusedComponent;
    }

    get focusStack() {
        return focusStack.slice();
    }

    get nextFocusedComponent() {
        return nextFocusedComponent;
    }
}

const focusManager = new FocusManager();

function processNode(node) {
    const previousPreviousFocusedNode = previousFocusedNode;
    previousFocusedNode = focusedNode;
    focusedNode = node;
    if (previousFocusedNode === focusedNode) {
        return;
    }
    focusManager.bdMutateNotify([['focusedNode', focusedNode, previousFocusedNode], ['previousFocusedNode', previousFocusedNode, previousPreviousFocusedNode]]);

    // find the focused component, if any
    nextFocusedComponent = 0;
    while (node && (!(nextFocusedComponent = Component.get(node)))) {
        node = node.parentNode;
    }

    const stack = [];
    if (nextFocusedComponent) {
        let p = nextFocusedComponent;
        while (p) {
            stack.unshift(p);
            p = p.parent;
        }
    }

    const newStackLength = stack.length;
    const oldStackLength = focusStack.length;
    let i = 0,
        j,
        component;
    while (i < newStackLength && i < oldStackLength && stack[i] === focusStack[i]) {
        i++;
    }
    // at this point [0..i-1] are identical in each stack

    // signal blur from the path end to the first identical component (not including the first identical component)
    for (j = i; j < oldStackLength; j++) {
        component = focusStack.pop();
        if (!component.destroyed) {
            component.bdOnBlur();
            focusManager.bdNotify({type: 'blurComponent', component});
        }
    }

    // signal focus for all new components that just gained the focus
    for (j = i; j < newStackLength; j++) {
        focusStack.push(component = stack[j]);
        component.bdOnFocus();
        focusManager.bdNotify({type: 'focusComponent', component});
    }

    previousFocusedComponent = focusedComponent;
    focusedComponent = nextFocusedComponent;
    focusManager.bdMutateNotify([['focusedComponent', focusedComponent, previousFocusedComponent], ['previousFocusedComponent', previousFocusedComponent, 0]]);
    nextFocusedComponent = 0;
}


adviseGlobal(window => {
    const document = window.document;

    let focusWatcher = 0;

    connect(document.body, 'focusin', e => {
        const node = e.target;
        if (!node || node.parentNode || node === focusedNode) {
            return;
        }

        if (focusWatcher) {
            clearTimeout(focusWatcher);
            focusWatcher = 0;
        }
        processNode(node);
    });

    // eslint-disable-next-line no-unused-vars
    connect(document.body, 'focusout', () => {
        // If the blur event isn't followed by a focus event, it means the focus left the document

        // set up a new focus watcher each time the focus changes...
        if (focusWatcher) {
            clearTimeout(focusWatcher);
        }
        focusWatcher = setTimeout(processNode.bind(null, null), 5);
    });
});

let vh = 0;
let vw = 0;

class ViewportWatcher extends watchHub(EventHub) {
    constructor(throttle) {
        super({});
        this.throttle = throttle || 300;
    }

    get vh() {
        return vh;
    }

    get vw() {
        return vw;
    }
}

const viewportWatcher = new ViewportWatcher();

adviseGlobal(window => {
    const document = window.document;

    vh = document.documentElement.clientHeight;
    vw = document.documentElement.clientWidth;

    let scrollTimeoutHandle = 0;

    connect(window, 'scroll', () => {
        if (scrollTimeoutHandle) {
            return;
        }
        scrollTimeoutHandle = setTimeout(() => {
            scrollTimeoutHandle = 0;
            viewportWatcher.bdNotify({type: 'scroll'});
        }, viewportWatcher.throttle);
    }, true);


    let resizeTimeoutHandle = 0;

    connect(window, 'resize', () => {
        if (resizeTimeoutHandle) {
            return;
        }
        resizeTimeoutHandle = setTimeout(() => {
            resizeTimeoutHandle = 0;
            const vhOld = vh;
            const vwOld = vw;
            vh = document.documentElement.clientHeight;
            vw = document.documentElement.clientWidth;
            viewportWatcher.bdMutateNotify([['vh', vh, vhOld], ['vw', vw, vwOld]]);
            viewportWatcher.bdNotify({type: 'resize', vh, vw});
        }, viewportWatcher.throttle);
    }, true);
});

function applyLengthWatchers(owner, newValue, oldValue) {
    if (oldValue !== newValue) {
        owner.children.forEach(child => {
            child.onMutateCollectionLength && child.onMutateCollectionLength(newValue, oldValue);
            child.bdMutateNotify('collectionLength', newValue, oldValue);
        });
    }
}

function updateChildren(collection, owner, oldLength) {
    const children = owner.children;
    const newLength = collection.length;
    for (let i = 0, end = newLength; i < end; i++) {
        const item = collection[i];
        const childrenCount = children.length;
        let child,
            j = i;
        // eslint-disable-next-line no-cond-assign
        while (j < childrenCount && (child = children[j]) && child.collectionItem !== item) j++;
        if (j >= childrenCount) {
            // new item
            owner.insChild(i);
        } else {
            if (j !== i) {
                // moved child
                Component.insertNode(child.bdDom.root, child.bdDom.root.parentNode, i);
                children.splice(j, 1);
                children.splice(i, 0, child);
            }
            // child may have moved by inserting new children before it; therefore...
            child.collectionIndex = i;
        }
    }
    children.slice(newLength).forEach(child => owner.delChild(child));
    applyLengthWatchers(owner, newLength, oldLength);
}

function setSpliceAdvice(collection, owner) {
    return collection.before('splice', () => {
        if (!owner.rendered) {
            return false;
        }
        const oldLength = collection.length;
        const holdSuspendWatchAdvise = owner.suspendWatchAdvise;
        owner.suspendWatchAdvise = true;
        return () => {
            owner.suspendWatchAdvise = holdSuspendWatchAdvise;
            updateChildren(collection, owner, oldLength);
        };
    });
}

function setShiftAdvice(collection, owner) {
    return collection.before('shift', () => {
        if (!owner.rendered || !collection.length) {
            return false;
        }
        const holdSuspendWatchAdvise = owner.suspendWatchAdvise;
        owner.suspendWatchAdvise = true;
        return () => {
            owner.suspendWatchAdvise = holdSuspendWatchAdvise;
            const children = owner.children;
            owner.delChild(children[0]);
            const newLength = collection.length;
            const oldLength = newLength + 1;
            children.forEach((child, i) => (child.collectionIndex = i));
            applyLengthWatchers(owner, newLength, oldLength);
        };
    });
}

function setUnshiftAdvice(collection, owner) {
    return collection.before('unshift', () => {
        if (!owner.rendered) {
            return false;
        }
        const oldLength = collection.length;
        const holdSuspendWatchAdvise = owner.suspendWatchAdvise;
        owner.suspendWatchAdvise = true;
        return () => {
            owner.suspendWatchAdvise = holdSuspendWatchAdvise;
            const newLength = collection.length;
            for (let i = 0, end = newLength - oldLength; i < end; i++) {
                owner.insChild(i);
            }
            for (let children = owner.children, i = newLength - oldLength; i < newLength; i++) {
                children[i].collectionIndex = i;
            }
            applyLengthWatchers(owner, newLength, oldLength);
        };
    });
}

function setReverseAdvice(collection, owner) {
    return collection.before('reverse', () => {
        if (!owner.rendered) {
            return false;
        }
        const holdSuspendWatchAdvise = owner.suspendWatchAdvise;
        owner.suspendWatchAdvise = true;
        return () => {
            owner.suspendWatchAdvise = holdSuspendWatchAdvise;
            const children = owner.children;
            for (let i = children.length - 1; i >= 0; i--) {
                const node = children[i].bdDom.root;
                node.parentNode.appendChild(node);
            }
            children.reverse();
            children.forEach((child, i) => (child.collectionIndex = i));
        };
    });
}

function setSortAdvice(collection, owner) {
    return collection.before('sort', () => {
        if (!owner.rendered) {
            return false;
        }
        const holdSuspendWatchAdvise = owner.suspendWatchAdvise;
        owner.suspendWatchAdvise = true;
        return () => {
            owner.suspendWatchAdvise = holdSuspendWatchAdvise;
            updateChildren(collection, owner, collection.length);
        };
    });
}

function setOrderAdvice(collection, owner) {
    return collection.before('order', () => {
        if (!owner.rendered) {
            return false;
        }
        const holdSuspendWatchAdvise = owner.suspendWatchAdvise;
        owner.suspendWatchAdvise = true;
        return () => {
            owner.suspendWatchAdvise = holdSuspendWatchAdvise;
            updateChildren(collection, owner, collection.length);
        };
    });
}

class Collection extends Component {
    constructor(kwargs) {
        super(kwargs);
        this.collection = kwargs.collection;
    }

    set collection(value) {
        // always an array
        value = value || toWatchable([]);
        if (this.bdMutate('collection', 'bdCollection', value)) {
            this.bdSetupHandle && this.bdSetupHandle.destroy();
            const collection = this.bdCollection;

            if (this.rendered) {
                const children = this.children;
                const oldLength = children.length;
                const newLength = collection.length;
                const mutateLength = oldLength !== newLength;
                for (let i = 0, end = Math.min(oldLength, newLength); i < end; i++) {
                    const child = children[i];
                    child.collectionItem = collection[i];
                    if (mutateLength) {
                        child.onMutateCollectionLength && child.onMutateCollectionLength(newLength, oldLength);
                        child.bdMutateNotify('collectionLength', newLength, oldLength);
                    }
                }
                this.bdSynchChildren();
            }

            if (isWatchable(collection) && !this.kwargs.collectionIsScalars) {
                const handles = [
                    this.watch(collection, 'length', (newValue, oldValue) => {
                        if (!this.suspendWatchAdvise && this.rendered) {
                            this.bdSynchChildren();
                            applyLengthWatchers(this, newValue, oldValue);
                        }
                    }),
                    setSpliceAdvice(collection, this),
                    setShiftAdvice(collection, this),
                    setUnshiftAdvice(collection, this),
                    setReverseAdvice(collection, this),
                    setSortAdvice(collection, this),
                    setOrderAdvice(collection, this)
                ];
                const setupHandle = this.bdSetupHandle = {
                    destroy() {
                        // multiple calls imply no-op
                        setupHandle.destroy = () => 0;
                        Destroyable.destroyAll(handles);
                    }
                };
                this.own(setupHandle);
            }
        }
    }

    get collection() {
        return this.bdCollection;
    }

    render(proc) {
        if (!this.bdDom) {
            super.render();
            this.children = [];
            this.bdSynchChildren();
            proc && proc();
        }
        return this.bdDom.root;
    }

    insChild(collectionIndex) {
        // eslint-disable-next-line new-cap
        const child = new this.kwargs.childType({parent: this, collectionIndex});
        Component.insertNode(child.render(), this.bdChildrenAttachPoint || this.bdDom.root, collectionIndex);
        this.children.splice(collectionIndex, 0, child);
        child.bdAttachToDoc(this.bdAttachedToDoc);
        return child;
    }

    bdSynchChildren() {
        const children = this.children;
        const collection = this.collection;
        while (children.length < collection.length) {
            this.insChild(children.length);
        }
        while (children.length > collection.length) {
            this.delChild(children[children.length - 1]);
        }
    }
}

const onMutateNames$1 = {};

function onMutateItemWatchable(propName, owner, newValue, oldValue) {
    let procName = onMutateNames$1[propName];
    if (procName === undefined) {
        procName = onMutateNames$1[propName] = typeof propName === 'symbol' ?
            false :
            `onMutate${propName.substring(0, 1).toUpperCase()}${propName.substring(1)}`;
    }
    procName && owner[procName] && owner[procName](newValue, oldValue);
}

class CollectionChild extends Component {
    constructor(kwargs) {
        super(kwargs);
        this._itemWatchHandles = [];
        this.bdParent = kwargs.parent;
        this.bdCollectionIndex = kwargs.collectionIndex;
        this.bdCollectionItem = kwargs.parent.collection[kwargs.collectionIndex];
        this.constructor.itemWatchables.forEach(prop => Object.defineProperty(this, prop, {
            enumerable: true,
            get: () => this.bdCollectionItem[prop]
        }));
        this._connectWatchers();
    }

    get collectionIndex() {
        // watchable
        return this.bdCollectionIndex;
    }

    set collectionIndex(newValue) {
        if (newValue !== this.bdCollectionIndex) {
            const oldValue = this.bdCollectionIndex;
            this.bdCollectionIndex = newValue;
            this.onMutateCollectionIndex && this.onMutateCollectionIndex(newValue, oldValue);
            this.bdMutateNotify('collectionIndex', newValue, oldValue);
            this._connectWatchers();
        }
    }

    get collectionLength() {
        // watchable iff the parent, like Collection, applies the watchers
        return this.parent.collection.length;
    }

    get collectionItem() {
        // watchable, see setter and _connectWatchers
        return this.bdCollectionItem;
    }

    set collectionItem(newValue) {
        this._applyWatchers(newValue, this.bdCollectionItem);
        this.bdCollectionItem = newValue;
        this._connectWatchers();
    }

    _applyWatchers(newValue, oldValue) {
        if (newValue !== oldValue) {
            this.onMutateCollectionItem && this.onMutateCollectionItem(newValue, oldValue);
            this.bdMutateNotify('collectionItem', newValue, oldValue);
            this.constructor.itemWatchables.forEach(prop => {
                onMutateItemWatchable(prop, this, newValue[prop], oldValue[prop]);
                this.bdMutateNotify(prop, newValue[prop], oldValue[prop]);
            });
        }
    }

    _connectWatchers() {
        this._itemWatchHandles.forEach(h => h.destroy());
        const handles = this._itemWatchHandles = [];
        if (isWatchable(this.parent.collection)) {
            const collectionItem = this.bdCollectionItem;
            handles.push(this.watch(this.parent.collection, this.collectionIndex, (newValue, oldValue, target, prop) => {
                if (this.parent.suspendWatchAdvise) return;
                if (prop.length === 1) {
                    // the whole item changed; therefore, reset the watch
                    this._applyWatchers(newValue, oldValue);
                    this._connectWatchers();
                } else {
                    this.onMutateCollectionItem && this.onMutateCollectionItem(collectionItem, UNKNOWN_OLD_VALUE);
                    this.bdMutateNotify('collectionItem', collectionItem, UNKNOWN_OLD_VALUE);
                }
            }));
            this.constructor.itemWatchables.forEach(prop =>
                handles.push(this.watch(collectionItem, prop, (newValue, oldValue, target, _prop) => {
                    if (this.parent.suspendWatchAdvise) return;
                    onMutateItemWatchable(prop, this, newValue, oldValue);
                    this.bdMutateNotify(prop, newValue, oldValue);
                })));
        }
    }
}

CollectionChild.itemWatchables = [];

CollectionChild.withWatchables = (...args) => {
    const superclass = typeof args[0] === 'function' ? args.shift() : CollectionChild;
    let itemWatchables = [];
    args = args.filter(prop => {
        const match = prop.match(/^item:(.+)/);
        if (match) {
            itemWatchables = itemWatchables.concat(match[1].split(',').map(p => p.trim()).filter(p => !!p));
            return false;
        }
        return true;
    });
    const result = withWatchables(superclass, ...args);
    result.itemWatchables = itemWatchables;
    return result;
};

setGlobal(window);

const version = '3.1.0';

export { Collection, CollectionChild, Component, Destroyable, Element, EventHub, OWNER, OWNER_NULL, PROP, STAR, UNKNOWN_OLD_VALUE, WatchHub, WatchableRef, adviseGlobal, animate, biBind, bind, connect, create, destroyDomChildren, destroyDomNode, div, element as e, element, eql, eqlComparators, eventHub, focusManager, fromWatchable, getAttr, getAttributeValueFromEvent, getComputedStyle, getMaxZIndex, getPosit, getPostProcessingFunction, getStyle, getStyles, getWatchableRef, global, hide, insPostProcessingFunction, insert, isWatchable, render, replacePostProcessingFunction, setAttr, setGlobal, setPosit, setStyle, show, silentSet, stopEvent, svg, toWatchable, version, viewportWatcher, watch, watchHub, withWatchables };
