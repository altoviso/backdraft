import {destroyable, destroyAll} from './destroyable.js';
import {STAR} from './symbols.js';

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
    constructor(referenceObject, referenceProp, formatter) {
        if (typeof referenceProp === 'function') {
            // no referenceProp,...star watcher
            formatter = referenceProp;
            referenceProp = STAR;
        }

        Object.defineProperty(this, 'value', {
            enumerable: true,
            // eslint-disable-next-line func-names
            get: ((function () {
                if (formatter) {
                    if (referenceProp === STAR) {
                        return () => formatter(referenceObject);
                    } else {
                        return () => formatter(referenceObject[referenceProp]);
                    }
                } else if (referenceProp === STAR) {
                    return () => referenceObject;
                } else {
                    return () => referenceObject[referenceProp];
                }
            })())
        });

        // if (referenceObject[OWNER] && referenceProp === STAR), then we cValue===newValue===referenceObject...
        // therefore can't detect internal mutations to referenceObject, so don't try
        const cannotDetectMutations = referenceProp === STAR && referenceObject[OWNER];

        this[pWatchableWatchers] = [];

        let cValue;
        const callback = (newValue, oldValue, target, referenceProp) => {
            if (formatter) {
                oldValue = oldValue === UNKNOWN_OLD_VALUE ? oldValue : formatter(oldValue);
                newValue = formatter(newValue);
            }
            if (cannotDetectMutations || oldValue === UNKNOWN_OLD_VALUE || !eql(cValue, newValue)) {
                this[pWatchableWatchers].slice().forEach(destroyable => destroyable.proc((cValue = newValue), oldValue, target, referenceProp));
            }
        };

        this[pWatchableSetup] = () => {
            cValue = this.value;
            if (referenceObject[OWNER]) {
                this[pWatchableHandles] = [watch(referenceObject, referenceProp, (newValue, oldValue, receiver, _prop) => {
                    if (referenceProp === STAR) {
                        callback(referenceObject, UNKNOWN_OLD_VALUE, referenceObject, _prop);
                    } else {
                        callback(newValue, oldValue, referenceObject, _prop);
                    }
                })];
            } else if (referenceObject.watch) {
                this[pWatchableHandles] = [
                    referenceObject.watch(referenceProp, (newValue, oldValue, target) => {
                        callback(newValue, oldValue, target, referenceProp);
                        if (this[pWatchableHandles].length === 2) {
                            this[pWatchableHandles].pop().destroy();
                        }
                        if (newValue && newValue[OWNER]) {
                            // value is a watchable
                            this[pWatchableHandles].push(watch(newValue, (newValue, oldValue, receiver, referenceProp) => {
                                callback(receiver, UNKNOWN_OLD_VALUE, referenceObject, referenceProp);
                            }));
                        }
                    })
                ];
                const value = referenceObject[referenceProp];
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
        destroyAll(this[pWatchableWatchers]);
    }

    watch(watcher) {
        this[pWatchableHandles] || this[pWatchableSetup]();
        return destroyable(watcher, this[pWatchableWatchers], () => {
            destroyAll(this[pWatchableHandles]);
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

    const insWatcher = (name, watcher) => destroyable(watcher, variables[name] || (variables[name] = []));
    if (!watcher) {
        const hash = name;
        return Reflect.ownKeys(hash).map(name => insWatcher(name, hash[name]));
    } else if (Array.isArray(name)) {
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
                (watchers = catalog[STAR]) && watchers.slice().forEach(destroyable => destroyable.proc(receiver, oldValue, receiver, name));
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

const watcher = {
    set
};

const SWAP_OLD_LENGTH = Symbol('SWAP_OLD_LENGTH');
const OLD_LENGTH = Symbol('old-length');
const NO_CHANGE = Symbol('splice-no-change');
const QUICK_COPY = Symbol('slice-quick-copy');
const BEFORE_ADVICE = Symbol('BEFORE_ADVICE');
const noop = () => {
    // do nothing
};

const arrayWatcher = {
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
                handle.destroy = noop;
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
    const result = isArray ? new Proxy(new WatchableArray(), arrayWatcher) : new Proxy({}, watcher);
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
            const result = destroyable(watcher, variables[name] || (variables[name] = []));
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

export {
    eqlComparators,
    eql,
    UNKNOWN_OLD_VALUE,
    OWNER,
    OWNER_NULL,
    PROP,
    silentSet,
    WatchableRef,
    getWatchableRef,
    watch,
    toWatchable,
    fromWatchable,
    watchHub,
    WatchHub,
    isWatchable,
    withWatchables,
    bind,
    biBind
};
