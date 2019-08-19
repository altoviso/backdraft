import {insPostProcessingFunction} from './postProcessingCatalog.js';
import {getWatchableRef} from './watchUtils.js';
import {connect, setAttr} from './dom.js';
import {Component} from './Component.js';

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
