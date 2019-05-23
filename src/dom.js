import {EventHub} from "./eventHub.js";
import {getWatchableRef} from "./watchUtils.js";
import {Component} from "./Component.js";
import {insPostProcessingFunction} from "./postProcessingCatalog.js";

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


function normalizeNodeArg(arg) {
    return arg instanceof Component ? arg.bdDom.root : (typeof arg === "string" ? document.getElementById(arg) : arg);
}

function setAttr(node, name, value) {
    node = normalizeNodeArg(node);
    if (arguments.length === 2) {
        let hash = name;
        Object.keys(hash).forEach(name => {
            setAttr(node, name, hash[name]);
        });
    } else {
        if (name === "style") {
            setStyle(node, value);
        } else if (name === "innerHTML" || (name in node && node instanceof HTMLElement)) {
            node[name] = value;
        } else {
            node.setAttribute(name, value);
        }
    }
}

function getAttr(node, name) {
    node = normalizeNodeArg(node);
    if (name in node && node instanceof HTMLElement) {
        return node[name];
    } else {
        return node.getAttribute(name);
    }
}

let lastComputedStyleNode = 0;
let lastComputedStyle = 0;

function getComputedStyle(node) {
    node = normalizeNodeArg(node);
    if (lastComputedStyleNode !== node) {
        lastComputedStyle = window.getComputedStyle((lastComputedStyleNode = node));
    }
    return lastComputedStyle;
}

function getStyle(node, property) {
    node = normalizeNodeArg(node);
    if (lastComputedStyleNode !== node) {
        lastComputedStyle = window.getComputedStyle((lastComputedStyleNode = node));
    }
    let result = lastComputedStyle[property];
    return (typeof result === "string" && /px$/.test(result)) ? parseFloat(result) : result;
}

function getStyles(node, ...styleNames) {
    node = normalizeNodeArg(node);
    if (lastComputedStyleNode !== node) {
        lastComputedStyle = window.getComputedStyle((lastComputedStyleNode = node));
    }

    let styles = [];
    styleNames.forEach((p) => {
        if (Array.isArray(p)) {
            styles = styles.concat(p);
        } else if (typeof p === "string") {
            styles.push(p);
        } else {
            Object.keys(p).forEach((p) => styles.push(p));
        }
    });

    let result = {};
    styles.forEach((property) => {
        let value = lastComputedStyle[property];
        result[property] = (typeof value === "string" && /px$/.test(value)) ? parseFloat(value) : value;
    });
    return result;
}

function setStyle(node, property, value) {
    node = normalizeNodeArg(node);
    if (arguments.length === 2) {
        if (typeof property === "string") {
            node.style = property;
        } else {
            let hash = property;
            Object.keys(hash).forEach(property => {
                node.style[property] = hash[property];
            });
        }
    } else {
        node.style[property] = value;
    }
}

function getPosit(node) {
    let result = normalizeNodeArg(node).getBoundingClientRect();
    result.t = result.top;
    result.b = result.bottom;
    result.l = result.left;
    result.r = result.right;
    result.h = result.height;
    result.w = result.width;
    return result;
}

function positStyle(v) {
    return v === false ? "" : `${v}px`;
}

function setPosit(node, posit) {
    node = normalizeNodeArg(node);
    for (let p in posit) {
        switch (p) {
            case "t":
                node.style.top = positStyle(posit.t);
                break;
            case "b":
                node.style.bottom = positStyle(posit.b);
                break;
            case "l":
                node.style.left = positStyle(posit.l);
                break;
            case "r":
                node.style.right = positStyle(posit.r);
                break;
            case "h":
                node.style.height = positStyle(posit.h);
                break;
            case "w":
                node.style.width = positStyle(posit.w);
                break;
            case "maxH":
                node.style.maxHeight = positStyle(posit.maxH);
                break;
            case "maxW":
                node.style.maxWidth = positStyle(posit.maxW);
                break;
            case "minH":
                node.style.minHeight = positStyle(posit.minH);
                break;
            case "minW":
                node.style.minWidth = positStyle(posit.minW);
                break;
            case "z":
                node.style.zIndex = posit.z === false ? "" : posit.z;
                break;
            default:
            // ignore...this allows clients to stuff other properties into posit for other reasons
        }
    }
}

function insertBefore(node, refNode) {
    refNode.parentNode.insertBefore(node, refNode);
}

function insertAfter(node, refNode) {
    let parent = refNode.parentNode;
    if (parent.lastChild === refNode) {
        parent.appendChild(node);
    } else {
        parent.insertBefore(node, refNode.nextSibling);
    }
}

function insert(node, refNode, position) {
    if (position === undefined || position === "last") {
        // short circuit the common case
        refNode.appendChild(node);
    } else switch (position) {
        case "before":
            insertBefore(node, refNode);
            break;
        case "after":
            insertAfter(node, refNode);
            break;
        case "replace":
            refNode.parentNode.replaceChild(node, refNode);
            return (refNode);
        case "only": {
            let result = [];
            while (refNode.firstChild) {
                result.push(refNode.removeChild(refNode.firstChild));
            }
            refNode.appendChild(node);
            return result;
        }
        case "first":
            if (refNode.firstChild) {
                insertBefore(node, refNode.firstChild);
            } else {
                refNode.appendChild(node);
            }
            break;
        default:
            if (typeof position === "number") {
                let children = refNode.childNodes;
                if (!children.length || children.length <= position) {
                    refNode.appendChild(node);
                } else {
                    insertBefore(node, children[position < 0 ? Math.max(0, children.length + position) : position]);
                }
            } else {
                throw new Error("illegal position");
            }
    }
}

function create(tag, props) {
    let result = Array.isArray(tag) ? document.createElementNS(tag[0] + "", tag[1]) : document.createElement(tag);
    if (props) {
        Reflect.ownKeys(props).forEach(p => setAttr(result, p, props[p]));
    }
    return result;
}


const DATA_BD_HIDE_SAVED_VALUE = "data-bd-hide-saved-value";

function hide(...nodes) {
    nodes.forEach((node) => {
        node = normalizeNodeArg(node);
        if (node) {
            if (!node.hasAttribute(DATA_BD_HIDE_SAVED_VALUE)) {
                node.setAttribute(DATA_BD_HIDE_SAVED_VALUE, node.style.display);
                node.style.display = "none";
            }//else, ignore, multiple calls to hide
        }
    });
}

function show(...nodes) {
    nodes.forEach((node) => {
        node = normalizeNodeArg(node);
        if (node) {
            let displayValue = "";
            if (node.hasAttribute(DATA_BD_HIDE_SAVED_VALUE)) {
                displayValue = node.getAttribute(DATA_BD_HIDE_SAVED_VALUE);
                node.removeAttribute(DATA_BD_HIDE_SAVED_VALUE);
            }
            node.style.display = displayValue;
        }
    });
}

function getMaxZIndex(parent) {
    let node, cs, max = 0, children = parent.childNodes, i = 0, end = children.length;
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
        destroy: function () {
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


let focusedComponent = null,
    focusedNode = null,
    focusedStack = [],
    previousFocusedComponent = null,
    previousFocusedNode = null;

class FocusManager extends EventHub {
    get focusedComponent() {
        return focusedComponent;
    }

    get focusedNode() {
        return focusedNode;
    }

    get focusedStack() {
        return focusedStack;
    }

    get previousFocusedComponent() {
        return previousFocusedComponent;
    }

    get previousFocusedNode() {
        return previousFocusedNode;
    }
}

let focusManager = new FocusManager();
let focusWatcher = 0;

function processNode(node) {
    if (focusWatcher) {
        clearTimeout(focusWatcher);
        focusWatcher = 0;
    }

    previousFocusedNode = focusedNode;
    focusedNode = node;
    if (previousFocusedNode === focusedNode) {
        return;
    }

    // find the focused component, if any
    while (node && (!Component.get(node))) {
        node = node.parentNode;
    }
    let focusedComponent_ = node && Component.get(node),
        stack = [];
    if (focusedComponent_) {
        let p = focusedComponent_;
        while (p) {
            stack.unshift(p);
            p = p.parent;
        }
    }

    let focusStack = focusedStack,
        newStackLength = stack.length,
        oldStackLength = focusStack.length,
        i = 0,
        j, component;
    while (i < newStackLength && i < oldStackLength && stack[i] === focusStack[i]) {
        i++;
    }
    // [0..i-1] are identical in each stack


    // signal blur from the path end to the first identical component (not including the first identical component)
    for (j = i; j < oldStackLength; j++) {
        component = focusStack.pop();
        component.bdOnBlur();
        focusManager.bdNotify({type: "blurComponent", component: component});
    }

    // signal focus for all new components that just gained the focus
    for (j = i; j < newStackLength; j++) {
        focusStack.push(component = stack[j]);
        component.bdOnFocus();
        focusManager.bdNotify({type: "focusComponent", component: component});
    }

    previousFocusedComponent = focusedComponent;
    focusedComponent = focusedComponent_;
    focusManager.bdNotify({type: "focusedComponent", component: focusedComponent_});
}

connect(document.body, "focusin", function (e) {
    let node = e.target;
    if (!node || node.parentNode == null || node === self[focusedNode]) {
        return;
    }
    processNode(node);
});

// eslint-disable-next-line no-unused-vars
connect(document.body, "focusout", function () {
    // If the blur event isn't followed by a focus event, it means the user clicked on something unfocusable,
    // so clear focus.
    if (focusWatcher) {
        clearTimeout(focusWatcher);
    }

    focusWatcher = setTimeout(function () {
        processNode(null);
    }, 5);
});

let viewportWatcher = new EventHub;

let scrollTimeoutHandle = 0;

// eslint-disable-next-line no-unused-vars
connect(window, "scroll", function () {
    if (scrollTimeoutHandle) {
        clearTimeout(scrollTimeoutHandle);
    }
    scrollTimeoutHandle = setTimeout(function () {
        scrollTimeoutHandle = 0;
        viewportWatcher.bdNotify({type: "scroll"});
    }, 10);
}, true);


let resizeTimeoutHandle = 0;

// eslint-disable-next-line no-unused-vars
connect(window, "resize", function () {
    if (resizeTimeoutHandle) {
        clearTimeout(resizeTimeoutHandle);
    }
    resizeTimeoutHandle = setTimeout(function () {
        resizeTimeoutHandle = 0;
        viewportWatcher.bdNotify({type: "resize"});
    }, 10);
}, true);


insPostProcessingFunction("bdReflect",
    function (prop, value) {
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
    function (ppfOwner, ppfTarget, props) {
        // props is a hash from property in ppfTarget to a list of ([refObject, ] property, [, formatter])...
        let install, watchable;
        if (ppfTarget instanceof Component) {
            install = function (destProp, refObject, prop, formatter) {
                ppfOwner.ownWhileRendered((watchable = getWatchableRef(refObject, prop, formatter)));
                ppfTarget[destProp] = watchable.value;
                ppfOwner.ownWhileRendered(watchable.watch(newValue => {
                    ppfTarget[destProp] = newValue;
                }));
            };
        } else {
            install = function (destProp, refObject, prop, formatter) {
                ppfOwner.ownWhileRendered((watchable = getWatchableRef(refObject, prop, formatter)));
                setAttr(ppfTarget, destProp, watchable.value);
                ppfOwner.ownWhileRendered(watchable.watch(newValue => {
                    setAttr(ppfTarget, destProp, newValue);
                }));
            };
        }

        Reflect.ownKeys(props).forEach(destProp => {
            let args = Array.isArray(props[destProp]) ? props[destProp].slice() : [props[destProp]];
            let refObject, prop;
            while (args.length) {
                refObject = args.shift();
                if (typeof refObject === "string" || typeof refObject === "symbol") {
                    prop = refObject;
                    refObject = ppfOwner;
                } else {
                    prop = args.shift();
                }
                install(destProp, refObject, prop, typeof args[0] === "function" ? args.shift() : null);
            }
        });
    }
);

insPostProcessingFunction("bdAdvise", true,
    function (ppfOwner, ppfTarget, listeners) {
        Reflect.ownKeys(listeners).forEach(eventType => {
            let listener = listeners[eventType];
            if (typeof listener !== "function") {
                listener = ppfOwner[listener].bind(ppfOwner);
            }
            ppfOwner.ownWhileRendered(ppfTarget instanceof Component ? ppfTarget.advise(eventType, listener) : connect(ppfTarget, eventType, listener));
        });
    }
);
insPostProcessingFunction("bdAdvise", "bdOn");

export {
    getAttributeValueFromEvent,
    setAttr,
    getAttr,
    getComputedStyle,
    getStyle,
    getStyles,
    setStyle,
    setPosit,
    create,
    insert,
    hide,
    show,
    getPosit,
    getMaxZIndex,
    destroyDomChildren,
    destroyDomNode,
    connect,
    stopEvent,
    focusManager,
    viewportWatcher
};
