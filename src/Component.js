import { destroyAll } from './destroyable.js';
import {
    stringifyScalar,
    getAttr,
    setAttr,
    getStyle,
    getStyles,
    setStyle,
    setPosit,
    getPosit,
    create,
    insert,
    removeNode,
    connect
} from './dom.js';
import {adviseGlobal} from './global.js';
import {getPostProcessingFunction} from './postProcessingCatalog.js';
import {Element} from './element.js';
import {eventHub} from './eventHub.js';
import {WatchHub, withWatchables} from './watchUtils.js';

let document = 0;
adviseGlobal(window => {
    document = window.document;
});

function cleanClassName(s) {
    s = stringifyScalar(s);
    return s ? s.replace(/\s{2,}/g, ' ').trim() : '';
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
    return staticClassName && className ? (`${staticClassName} ${className}`) : (staticClassName || className || '');
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

function noop() {
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
                h.destroy = noop;
            };
            dest.push(h);
        }
    });
}

const ownedHandlesCatalog = new WeakMap();
const domNodeToComponent = new Map();

export class Component extends eventHub(WatchHub) {
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
                destroyAll(handles);
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
                    this.bdDom.root.tabIndex = this.bdTabIndex;
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
            destroyAll(this.bdDom.handles);
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

    ownWhileAttached(...handles) {
        pushHandles(this.bdAttachedHandles || (this.bdAttachedHandles = []), ...handles);
    }

    get parent() {
        return this.bdParent;
    }

    bdAdopt(child, refIndex) {
        const oldParent = child.bdParent;
        if (oldParent === this) {
            return;
        }
        if (oldParent) {
            const index = oldParent.children ? oldParent.children.indexOf(child) : -1;
            if (index !== -1) {
                oldParent.children.splice(index, 1);
            }
        }
        const children = this.children || (this.children = []);
        if (refIndex !== undefined) {
            children.splice(refIndex, 0, child);
        } else {
            children.push(child);
        }
        child.bdMutate('parent', 'bdParent', this);
        child.bdAttachToDoc(this.bdAttachedToDoc);
    }

    bdAttachToDoc(value) {
        value = !!value;
        if (value !== this.attachedToDoc) {
            this.children && this.children.forEach(child => child.bdAttachToDoc(value));
            if (value) {
                this.resize && this.resize();
            } else {
                this.bdAttachedHandles && destroyAll(this.bdAttachedHandles);
            }
            return this.bdMutate('attachedToDoc', 'bdAttachedToDoc', value);
        }// else no change, therefore, no op
        return false;
    }

    get attachedToDoc() {
        return !!this.bdAttachedToDoc;
    }

    insChild(...args) {
        if (!this.rendered) {
            throw new Error('parent component must be rendered before explicitly inserting a child');
        }

        // we're going to ad a child, let's just make sure we have a children array from the start
        const children = this.children || (this.children = []);

        // decode, juggle; validate position as it makes the insert logic easier
        let { src, attachPoint, position } = decodeRender(args);
        if (/before|after|replace|only|first|last/.test(attachPoint) || typeof attachPoint === 'number') {
            position = attachPoint;
            attachPoint = 0;
        } else if (position === undefined) {
            position = 'last';
        } else if (!/before|after|replace|only|first|last/.test(position) && typeof position !== 'number') {
            throw new Error('unexpected');
        }
        if (typeof position == 'number') {
            if (position !== Math.floor(position) || position < 0 || children.length < position) {
                // not an integer or not in [0..children.length]
                throw new Error('unexpected');
            }
        }
        // position is now guaranteed one of {before, after, first, last, replace, only} or an integer in [0..children.length]

        // get the rendered child component instance
        let child;
        if (src instanceof Component) {
            child = src;
            child.render();
        } else {
            // src instanceof Element
            if (!src.isComponentType) {
                src = new Element(Component, { elements: src });
            }
            child = this.constructor.renderElements(this, src);
        }

        const childIndex = child => children.indexOf(child);
        const insChildDom = (child, refNode, position) => {
            const childRoot = child.bdDom.root;
            let result;
            if (Array.isArray(childRoot)) {
                const firstChildNode = childRoot[0];
                result = insert(firstChildNode, refNode, position);
                childRoot.slice(1).reduce((prevNode, node) => {
                    insert(node, prevNode, 'after');
                    return node;
                }, firstChildNode);
            } else {
                result = insert(childRoot, refNode, position);
            }
            return result;
        };

        // child is telling the parent where it wants to go
        // (this is more specific than bdChildrenAttachPoint or bdDom.root)
        if (!attachPoint && child.bdParentAttachPoint) {
            attachPoint = child.bdParentAttachPoint;
        }

        if (attachPoint instanceof Component) {
            // attachPoint must be a child already in this.children and position must be one of {before, after, replace}
            const refIndex = childIndex(attachPoint);
            if (refIndex === -1) {
                throw new Error('unexpected');
            }
            let refNode = attachPoint.bdDom.root;
            switch (position) {
                case 'before':
                case 'replace':
                    if (Array.isArray(refNode)) {
                        refNode = refNode[0];
                    }
                    insChildDom(child, refNode, 'before');
                    this.bdAdopt(child, refIndex);
                    if (position === 'replace') {
                        this.delChild(attachPoint);
                    }
                    break;
                case 'after':
                    if (Array.isArray(refNode)) {
                        refNode = refNode[refNode.length - 1];
                    }
                    insChildDom(child, refNode, 'after');
                    this.bdAdopt(child, refIndex + 1);
                    break;
                default:
                    throw new Error('unexpected');
            }
            return child;
        }

        // attachPoint was not a child; therefore it must be either a node or a reference to a node or one of the defaults
        if (typeof attachPoint === 'string') {
            // a reference...
            attachPoint = this[attachPoint] || document.getElementById(attachPoint);
        } else if (!attachPoint) {
            // the defaults...
            attachPoint = this.bdChildrenAttachPoint || this.bdDom.root;
        }// else attachPoint must be a dom node
        if (!(attachPoint instanceof window.Element)) {
            throw new Error('unexpected');
        }

        if (attachPoint === this.bdChildrenAttachPoint || attachPoint === this.bdDom.root) {
            // this is the normal path...attaching a child to the child container node
            // in this path, position is relative to this.children (before, after, replace are illegal)

            // simplify the switch a little
            if (position === 0) {
                position = 'first';
            } else if (position === children.length) {
                position = 'last';
            }

            switch (position) {
                case 'only':
                    children.slice().forEach(child => this.delChild(child));
                    insChildDom(child, attachPoint, 'last');
                    this.bdAdopt(child);
                    break;

                case 'first':
                    insChildDom(child, attachPoint, 'first');
                    this.bdAdopt(child, 0);
                    break;


                case 'last':
                    insChildDom(child, attachPoint, 'last');
                    this.bdAdopt(child, this.children.length);
                    break;

                case 'before':
                case 'after':
                case 'replace':
                    // these positions don't make sense in this context
                    throw new Error('unexpected');

                default: {
                    // position will be in [1..this.children.length-1]
                    let refNode = children[position].bdDom.root;
                    if (Array.isArray(refNode)) {
                        refNode = refNode[0];
                    }
                    insChildDom(child, refNode, 'before');
                    this.bdAdopt(child, position);
                    break;
                }
            }
            return child;
        }

        // attachPoint is just a dom node, position gives the dom node position relative to attachPoint and has
        // nothing to do with this.children
        unrender(insChildDom(child, attachPoint, position));
        this.bdAdopt(child);
        return child;
    }

    delChild(child, preserve) {
        const index = this.children ? this.children.indexOf(child) : -1;
        if (index !== -1) {
            const root = child.bdDom && child.bdDom.root;
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
        return this.children && this.children.slice().map(child => this.delChild(child, preserve));
    }

    reorderChildren(children) {
        if (!this.children || !this.children.length) {
            return false;
        }

        if (this.children.length !== children.length) {
            return false;
        }

        // the following must be true for this routine to work!
        if (!children.every(child => child.parent === this)) {
            return false;
        }

        // at this point we are reasonably sure children has the same contents as this.children, but maybe in a different order

        const parentNode = Array.isArray(children[0].bdDom.root) ? children[0].bdDom.root[0].parentNode : children[0].bdDom.root.parentNode;
        const existingNodes = parentNode.childNodes;
        let existingNodePtr = 0;
        const reorderedChildrenArray = [];
        children.forEach(child => {
            reorderedChildrenArray.push(child);
            const childRoot = child.bdDom.root;
            if (existingNodePtr < existingNodes.length) {
                if (Array.isArray(childRoot)) {
                    childRoot.forEach(node => parentNode.insertBefore(node, existingNodes[existingNodePtr++]));
                } else {
                    parentNode.insertBefore(childRoot, existingNodes[existingNodePtr++]);
                }
            } else if (Array.isArray(childRoot)) {
                childRoot.forEach(node => parentNode.appentChild(node));
            } else {
                parentNode.appentChild(childRoot);
            }
        });

        // reorder this.children in place
        reorderedChildrenArray.forEach((child, i) => (this.children[i] = child));

        return true;
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

    twiddleClassName(set, onValue, offValue) {
        // if set then ensure className contains onValue (if any); otherwise ensure className contains offValue (if any)
        // by example
        // assume className starts out as ''
        // twiddleClassName(true, "turn-on", "turn-off") => className contains "turn-on"
        // twiddleClassName(true, "turn-on", "turn-off") => className still contains one "turn-on"
        // twiddleClassName(false, "turn-on", "turn-off") => className contains "turn-off" and does not contain "turn-on"
        // twiddleClassName(false, "turn-on", "turn-off") => className still contains just one "turn-off" and does not contain "turn-on"
        //
        // sometimes there is no "on" value...
        // twiddleClassName(true, 0, "turn-off") => no mutation to className
        // twiddleClassName(false, 0, "turn-off") => className contains "turn-off"
        // twiddleClassName(false, 0, "turn-off") => className still contains just one "turn-off"

        if (set) {
            if (onValue && !this.containsClassName(onValue)) {
                this.addClassName(onValue);
            }
            if (offValue && this.containsClassName(offValue)) {
                this.removeClassName(offValue);
            }
        } else {
            if (onValue && this.containsClassName(onValue)) {
                this.removeClassName(onValue);
            }
            if (offValue && !this.containsClassName(offValue)) {
                this.addClassName(offValue);
            }
        }
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

    get posit() {
        // WARNING: does not work for multi-root components
        return this.bdDom && getPosit(this.bdDom.root);
    }

    set posit(posit) {
        // WARNING: does not work for multi-root components
        this.bdDom && setPosit(this.bdDom.root, posit);
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
        // WARNING: does not work for multi-root components
        value = stringifyScalar(value);
        if (this.bdMutate('title', 'bdTitle', value)) {
            this.rendered && ((this.bdDom.titleNode || this.bdDom.root).title = value);
        }
    }

    qs(selector) {
        if (this.rendered) {
            const root = this.bdDom.root;
            if (Array.isArray(root)) {
                let result;
                root.find(node => (result = node.querySelector(selector)));
                return result;
            } else {
                return root.querySelector(selector);
            }
        }
        return null;
    }

    qsa(selector) {
        if (this.rendered) {
            const root = this.bdDom.root;
            if (Array.isArray(root)) {
                const result = [];
                root.foreEach(node => {
                    node.querySelectorAll(selector).forEach(node => result.push(node));
                });
                return result;
            } else {
                return Array.from(root.querySelectorAll(selector));
            }
        }
        return [];
    }

    scrollIntoView() {
        this.bdDom && this.bdDom.root && this.bdDom.root.scrollIntoView();
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
            return document.createTextNode(e);
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

export function render(...args) {
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
        attachPoint = document.getElementById(attachPoint);
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
        result.bdAttachToDoc(document.body.contains(attachPoint));
    }
    return result;
}
