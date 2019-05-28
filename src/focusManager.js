import {adviseGlobal} from './global.js';
import {connect} from "./dom.js";
import {EventHub} from "./eventHub.js";
import {watchHub} from "./watchUtils.js";
import {Component} from "./Component.js";

let focusedNode = null;
let previousFocusedNode = null;
let focusedComponent = null;
let previousFocusedComponent = null;
let nextFocusedComponent = null;
let focusStack = [];

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

export const focusManager = new FocusManager();

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
