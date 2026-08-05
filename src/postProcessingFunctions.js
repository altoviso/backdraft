import { Component } from './Component.js';
import { connect, setAttr } from './dom.js';
import { insPostProcessingFunction } from './postProcessingCatalog.js';
import { getWatchableRef } from './watchUtils.js';

insPostProcessingFunction(
    'bdAttach',
    (ppfOwner, ppfTarget, name) => {
        if (typeof name === 'function') {
            const result = name(ppfTarget, ppfOwner);
            result && result.destroy && ppfOwner.ownWhileRendered(result);
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
    'bdWatch',
    (prop, value) => {
        if (prop) {
            // e.g., bdWatch_prop: handler
            return { [prop]: value };
        }
        // e.g., bdWatch:{p1:handler, p2:handler, ...}
        return value;
    },
    (ppfOwner, ppfTarget, watchers) => {
        Reflect.ownKeys(watchers).forEach(name => {
            let watcher = watchers[name];
            if (typeof watcher !== 'function') {
                watcher = ppfOwner[name].bind(ppfOwner);
            }
            ppfTarget.ownWhileRendered(ppfTarget.watch(name, watcher));
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

        args = Array.isArray(args) ? args.slice() : [args];
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
    // for dom nodes, there is the synthetic attribute "inner" which says set the inner contents of the node as follows
    // if the value is an object that has its 'asHtml' property set true, then set innerHTML; otherwise, set innerText.
    //
    // if the caller intends to *always* set one or the other innerHTML or innerText, then those explicit properties should be used
    // it is only when the caller doesn't know...as is often the case when building generalized widgets

    'bdReflect',
    (prop, value) => {
        if (prop === null && value instanceof Object && !Array.isArray(value)) {
            // e.g., bdReflect:{p1:"someProp" -or- [[refObject,] "someProp" [, someFormatter], ...], p2:...}
            return value;
        } else if (prop) {
            // e.g., bdReflect_someProp: "someProp" -or- [[refObject,] "someOtherProp" [, someFormatter], ...]
            return { [prop]: value };
        } else {
            // e.g., bdReflect: "someProp" -or- [[refObject,] "someOtherProp" [, someFormatter], ...]
            return { innerHTML: value };
        }
    },
    (ppfOwner, ppfTarget, props) => {
        // props is a hash from property in ppfTarget to a property in ppfOwner or
        // an array of [[refObject, ] property [, formatter], ...]
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
                if (destProp === 'inner') {
                    const value = watchable.value;
                    setAttr(ppfTarget, value && value.asHtml ? 'innerHTML' : 'innerText', value);
                    ppfOwner.ownWhileRendered(watchable.watch(newValue => {
                        setAttr(ppfTarget, newValue && newValue.asHtml ? 'innerHTML' : 'innerText', newValue);
                    }));
                } else {
                    setAttr(ppfTarget, destProp, watchable.value);
                    ppfOwner.ownWhileRendered(watchable.watch(newValue => {
                        setAttr(ppfTarget, destProp, newValue);
                    }));
                }
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

const NO_INITIAL_VALUE = {};

insPostProcessingFunction(
    'bdPromise',
    (prop, value) => {
        if (prop === null && value instanceof Object && !(value instanceof Promise) && !Array.isArray(value)) {
            // e.g., bdPromise:{p1:somePromise -or- [somePromise [, initialValue] [, someFormatter], ...]}
            return value;
        } else if (prop) {
            // e.g., bdPromise_someProp: somePromise -or- [somePromise [, initialValue] [, someFormatter], ...]
            return { [prop]: value };
        } else {
            // e.g., bdPromise: somePromise -or- [somePromise [, initialValue] [, someFormatter], ...]
            return { innerHTML: value };
        }
    },
    (ppfOwner, ppfTarget, props) => {
        // props is a hash from property in ppfTarget to a promise or
        // an array of [promise [, initialValue, ] [, formatter], ...]
        let install;
        if (ppfTarget instanceof Component) {
            install = (destProp, promise, initialValue, formatter) => {
                if (initialValue !== NO_INITIAL_VALUE) {
                    ppfTarget[destProp] = initialValue;
                }
                promise.then(value => {
                    ppfTarget[destProp] = formatter ? formatter(value) : value;
                });
            };
        } else {
            install = (destProp, promise, initialValue, formatter) => {
                if (initialValue !== NO_INITIAL_VALUE) {
                    setAttr(ppfTarget, destProp, initialValue);
                }
                promise.then(value => {
                    setAttr(ppfTarget, destProp, formatter ? formatter(value) : value);
                });
            };
        }

        Reflect.ownKeys(props).forEach(destProp => {
            const args = Array.isArray(props[destProp]) ? props[destProp].slice() : [props[destProp]];

            while (args.length) {
                let initialValue = NO_INITIAL_VALUE;
                let formatter = 0;
                const promise = args.shift();
                if (args.length && !(args[0] instanceof Promise)) {
                    // this promise comes with initialValue and/or formatter...
                    initialValue = args.shift();
                    if (typeof initialValue === 'function') {
                        // just a formatter, no instanceof
                        formatter = initialValue;
                        initialValue = NO_INITIAL_VALUE;
                    } else if (args.length && typeof args[0] === 'function') {
                        // this promise comes with both initialValue and/or formatter...
                        formatter = args.shift();
                    }
                }
                install(destProp, promise, initialValue, formatter);
            }
        });
    }
);

insPostProcessingFunction(
    'bdAdvise', true,
    (ppfOwner, ppfTarget, listeners) => {
        Reflect.ownKeys(listeners).forEach(eventType => {
            let options;
            let listener = listeners[eventType];
            if (Array.isArray(listener)) {
                options = listener[1];
                listener = listener[0];
            }
            if (typeof listener !== 'function') {
                listener = ppfOwner[listener].bind(ppfOwner);
            }
            ppfOwner.ownWhileRendered(ppfTarget instanceof Component ? ppfTarget.advise(eventType, listener) : connect(ppfTarget, eventType, listener, options));
        });
    }
);
insPostProcessingFunction('bdAdvise', 'bdOn');
