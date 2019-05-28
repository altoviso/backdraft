import {adviseGlobal} from './global.js';

let window = 0;
let document = 0;
adviseGlobal(global => {
    window = global;
    document = window.document;
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

function normalizeNodeArg(arg) {
    // eslint-disable-next-line no-nested-ternary
    return arg instanceof Component ? arg.bdDom.root : (typeof arg === 'string' ? document.getElementById(arg) : arg);
}

function setAttr(node, name, value) {
    node = normalizeNodeArg(node);
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
    const result = lastComputedStyle[property];
    return (typeof result === 'string' && /px$/.test(result)) ? parseFloat(result) : result;
}

function getStyles(node, ...styleNames) {
    node = normalizeNodeArg(node);
    if (lastComputedStyleNode !== node) {
        lastComputedStyle = window.getComputedStyle((lastComputedStyleNode = node));
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
    node = normalizeNodeArg(node);
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
    const result = normalizeNodeArg(node).getBoundingClientRect();
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
    node = normalizeNodeArg(node);
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
        node = normalizeNodeArg(node);
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
        node = normalizeNodeArg(node);
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
    const isComponent = node instanceof Component;
    if (isComponent && !node.rendered) {
        return;
    }
    const h = connect(isComponent ? node.bdDom.root : node, 'animationend', e => {
        if (e.animationName === className) {
            h.destroy();
            if (isComponent) {
                !node.destroyed && node.removeClassName(className);
            } else {
                node.classList.remove(className);
            }
            if (onComplete) {
                onComplete.destroy ? onComplete.destroy() : onComplete();
            }
        }
    });
    if (isComponent) {
        if (!node.containsClassName(className)) {
            node.addClassName(className);
        }
    } else {
        node.classList.add(className);
    }
}


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
    animate,
    stopEvent
};
