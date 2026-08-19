import { adviseGlobal } from './global.js';
import { handleUnexpected } from './unexpectedHandler.js';


let window = 0;
let document = 0;
let supportsPassive = false;
adviseGlobal(global => {
    window = global;
    document = window.document;

    // test via a getter in the options object to see if the passive property is accessed
    // this is tricky; see https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#improving_scrolling_performance_with_passive_listeners
    // for a complete explanation
    try {
        const opts = Object.defineProperty({}, 'passive', {
            get() {
                supportsPassive = true;
                return false;
            }
        });
        window.addEventListener('testPassive', null, opts);
        window.removeEventListener('testPassive', null, opts);
    } catch (e) {
        supportsPassive = false;
    }
});

// dom node attribute values are generally strings; it's easy and natural to slip into the idea that "clearing"
// an attribute value can be accomplished by setting it to false, null, or undefined. But then the programmer is
// surprised when, e.g., the title of a dom node is "undefined". Properly employed, the follow function allows
// components to be built that allow the easy and natural idea to "just work".
//
// note that the scalar zero (i.e., a Number with value===0) stringifyScalar's to '0'. So using "x = 0" to
// intend "x = false" will _not_ get you what you want. We choose this because it seems irrational to say that
// stringifyScalar(1) === '1', stringifyScalar(2) === '2', ..., but stringifyScalar(0) === ''
function stringifyScalar(v) {
    // '', false, null, undefined => ''
    return v === 0 ? '0' : (v ? `${v}` : '');
}

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
        if (name === 'className') {
            // note: the other mappings we have to worry about are htmlfor=>for, and for
            // iexplorer, tabindex=>tabIndex and readonly=>readOnly. but all of those are
            // only relevant for an HTMLElement type nodes, so we won't get here.
            // we *do* get here for, e.g., svg nodes though.
            name = 'class';
        }
        node.setAttribute(name, value);
    }
}

function getAttr(node, name) {
    if (name in node.constructor.prototype) {
        return node[name];
    }
    return node.getAttribute(name);
}

let lastComputedStyleNode = 0;
let lastComputedStyle = 0;

function getComputedStyle(node) {
    if (lastComputedStyleNode !== node) {
        lastComputedStyle = window.getComputedStyle((lastComputedStyleNode = node));
    }
    return lastComputedStyle;
}

function getStyle(node, property) {
    if (lastComputedStyleNode !== node) {
        lastComputedStyle = window.getComputedStyle((lastComputedStyleNode = node));
    }
    const result = lastComputedStyle[property];
    return (typeof result === 'string' && /px$/.test(result)) ? parseFloat(result) : result;
}

function getStyles(node, ...styleNames) {
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
    if (arguments.length === 2) {
        if (typeof property === 'string') {
            node.style.cssText = property;
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

const abbrToStyleProp = {
    t: 'top',
    b: 'bottom',
    l: 'left',
    r: 'right',
    h: 'height',
    w: 'width',
    maxH: 'maxHeight',
    maxW: 'maxWidth',
    minH: 'minHeight',
    minW: 'minWidth',
    m: 'margin',
    mt: 'marginTop',
    mb: 'marginBottom',
    ml: 'marginLeft',
    mr: 'marginRight',
    p: 'padding',
    pt: 'paddingTop',
    pb: 'paddingBottom',
    pl: 'paddingLeft',
    pr: 'paddingRight',
    bw: 'borderWidth',
    bwt: 'borderTopWidth',
    bwb: 'borderBottomWidth',
    bwl: 'borderLeftWidth',
    bwr: 'borderRightWidth',
    br: 'borderRadius',
    brtl: 'borderTopLeftRadius',
    brtr: 'borderTopRightRadius',
    brbl: 'borderBottomLeftRadius',
    brbr: 'borderBottomRightRadius'
};

function setPosit(node, posit) {
    Object.keys(posit).forEach(p => {
        const styleProp = abbrToStyleProp[p];
        if (styleProp) {
            const value = posit[p];
            node.style[styleProp] = value === false ? '' : `${value}px`;
        }
    });
    if ('z' in posit) {
        node.style.zIndex = posit.z === false ? '' : posit.z;
    }
    if ('posit' in posit) {
        node.style.position = posit.posit === false ? '' : posit.posit;
    }
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
                return refNode;
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

function create(tag, props, refNode, position) {
    const result = Array.isArray(tag) ? document.createElementNS(`${tag[0]}`, tag[1]) : document.createElement(tag);
    if (props) {
        Reflect.ownKeys(props).forEach(p => setAttr(result, p, props[p]));
    }
    if (refNode) {
        create.replacedNodes = insert(result, refNode, position);
    }
    return result;
}

let scratch = 0;

function createHtml(html) {
    (scratch || (scratch = document.createElement('div'))).innerHTML = html;
    const children = scratch.children;
    const end = children.length;
    let result;

    // incredibly, IE9 won't let you just take and keep references to the nodes in children
    // and will instead destroy those children when you set scratch.innerHTML to '';
    // therefore, we must actually remove the nodes...
    if (end === 1) {
        result = scratch.removeChild(children[0]);
    } else {
        result = [];
        for (let i = 0; i < end; i++) {
            result.push(scratch.removeChild(children[0]));
        }
    }
    scratch.innerHTML = '';
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

function removeChildren(node) {
    let childNode;
    const result = [];
    while ((childNode = node.lastChild)) {
        result.push(node.removeChild(childNode));
    }
    return result.reverse();
}

function removeNode(node) {
    return node && node.parentNode && node.parentNode.removeChild(node);
}

function removeNodes(nodes) {
    return nodes ? nodes.map(removeNode) : [];
}

function connect(target, type, listener, options) {
    try {
        let destroyed = false;
        if (options === undefined) {
            // do nothing, this is the common case
        } else if (!supportsPassive) {
            if (typeof options === 'object') {
                // options as an object is not supported, capture is the only argument that is meaningful
                options = !!options.capture;
            } else {
                // ensure a boolean
                options = !!options;
            }
        } else if (typeof options !== 'object') {
            // options was given as a boolean, indicating it was really passed as a capture argument; ensure a boolean
            options = !!options;
        }

        target.addEventListener(type, listener, options);
        return {
            destroy() {
                if (!destroyed) {
                    destroyed = true;
                    target.removeEventListener(type, listener, options);
                }
            }
        };
    } catch (e) {
        handleUnexpected(e);
        return {
            destroy() {
            },
            failed: true
        };
    }
}

function stopEvent(event) {
    if (event && event.preventDefault) {
        event.preventDefault();
        event.stopPropagation();
    }
}

function closest(element, predicate) {
    if (!element) {
        return null;
    }
    if (typeof predicate === 'string') {
        const selector = predicate;
        predicate = element => element.matches && element.matches(selector);
    }
    while (element) {
        if (predicate(element)) {
            return element;
        }
        element = element.parentElement;
    }
    return null;
}

export {
    stringifyScalar,
    getAttributeValueFromEvent,
    setAttr,
    getAttr,
    getComputedStyle,
    getStyle,
    getStyles,
    setStyle,
    setPosit,
    create,
    createHtml,
    insert,
    hide,
    show,
    getPosit,
    getMaxZIndex,
    removeChildren,
    removeNode,
    removeNodes,
    connect,
    stopEvent,
    closest
};
