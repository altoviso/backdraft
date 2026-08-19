import { Component } from './Component.js';
import { connect } from './dom.js';
import { EventHub } from './eventHub.js';
import { adviseGlobal } from './global.js';
import { handleUnexpected } from './unexpectedHandler.js';
import { watchHub } from './watchUtils.js';

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

export const focusManager = new FocusManager();

function processNode_(node) {
    // send all the signals and twiddle all the variables upon a focus change

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
            try {
                component.bdOnBlur();
            } catch (e) {
                handleUnexpected(e);
            }
            focusManager.bdNotify({ type: 'blurComponent', component });
        }
    }

    // signal focus for all new components that just gained the focus
    for (j = i; j < newStackLength; j++) {
        focusStack.push(component = stack[j]);
        try {
            component.bdOnFocus();
        } catch (e) {
            handleUnexpected(e);
        }
        focusManager.bdNotify({ type: 'focusComponent', component });
    }

    previousFocusedComponent = focusedComponent;
    focusedComponent = nextFocusedComponent;
    focusManager.bdMutateNotify([['focusedComponent', focusedComponent, previousFocusedComponent], ['previousFocusedComponent', previousFocusedComponent, 0]]);
    nextFocusedComponent = 0;
}

let queue = [];
let processing = false;
const WATCHDOG_LIMIT = 10;

function processNode(node) {
    // it is possible this routine may be applied recursively. to protect
    // against infinite recursion, it guards against a maximum recursive depth
    // of WATCHDOG_LIMIT. When that limit is reached, focus events are
    // ignored for a short period (currently 50ms) to allow the system
    // to clear itself.

    queue.push(node);
    if (!processing) {
        processing = true;
        let watchdog = 0;
        while (queue.length && watchdog < WATCHDOG_LIMIT) {
            watchdog++;
            if (watchdog > 1) {
                // recursive application of processNode. this happens when code reacting to a focus
                // change causes another focus change and further that the browser fired  a recursive
                // focusin event on the same code path
                // console.log('recursive focus in', node);
            }
            try {
                // notice that an application of processNode_ will never be interrupted by a focus change
                processNode_(queue.shift());
            } catch (e) {
                // eslint-disable-next-line no-console
                console.log(e);
            }
        }
        if (watchdog >= WATCHDOG_LIMIT) {
            // eslint-disable-next-line no-console
            console.log('the focus watchdog barked');
            // let things settle again
            setTimeout(() => {
                queue = [];
                processing = false;
            }, 50);
        } else {
            processing = false;
        }
    }
}

adviseGlobal(window => {
    // recall focusin/focusout bubble and are not cancelable
    // see https://developer.mozilla.org/en-US/docs/Web/API/Element/focusin_event

    // recall the browser may raise focusin events recursively on the same code path

    const document = window.document;

    let focusWatcher = 0;

    connect(document.body, 'focusin', e => {
        const node = e.target;
        if (!node || !node.parentNode || node === focusedNode) {
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
