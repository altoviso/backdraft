import {Component} from './Component.js';
import {destroyAll} from './destroyable.js';
import {UNKNOWN_OLD_VALUE, toWatchable, isWatchable, withWatchables} from './watchUtils.js';

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

export class Collection extends Component {
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
                        destroyAll(handles);
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

const onMutateNames = {};

function onMutateItemWatchable(propName, owner, newValue, oldValue) {
    let procName = onMutateNames[propName];
    if (procName === undefined) {
        procName = onMutateNames[propName] = typeof propName === 'symbol' ?
            false :
            `onMutate${propName.substring(0, 1).toUpperCase()}${propName.substring(1)}`;
    }
    procName && owner[procName] && owner[procName](newValue, oldValue);
}

export class CollectionChild extends Component {
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
                    onMutateItemWatchable(prop, this, newValue, oldValue, target, _prop);
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
