import {e, render, Component, destroyDomChildren, focusManager, viewportWatcher} from '../lib.js';

class C1 extends Component {
    // no tab index
    _elements() {
        return e('div',
            e('div', 'C1-n1'),
            e('div', 'C1-n2'),);
    }
}

class C2 extends Component {
    // tab index on default (root)
    _elements() {
        return e('div',
            e('div', 'C2-n1'),
            e('div', 'C2-n2'),);
    }
}


class C3 extends Component {
    // tab index on explicit
    _elements() {
        return e('div',
            e('div', {bdTabIndexNode: true}, 'C3-n1'),
            e('div', 'C3-n2'),);
    }
}

render(Component, {
    id: 1,
    elements: e(
        'div',
        e(C1, {id: 2}),
        e(C2, {id: 3, tabIndex: 1}),
        e(C3, {id: 4, tabIndex: 2})
    )
}, document.getElementById('root'));

let eventid = 0;
function logEvent(event) {
    console.log(
        `event: ${++eventid}:${event.name}, 
		event-component: ${event.component ? event.component.id : 'none'},
		focusedComponent: ${focusManager.focusedComponent ? focusManager.focusedComponent.id : 'none'},
		focusedNode: ${focusManager.focusedNode},
		focusedStack: ${focusManager.focusedStack.map(c => c.id).join('.')},
		previousFocusedComponent: ${focusManager.previousFocusedComponent ? focusManager.previousFocusedComponent.id : 'none'},
		previousFocusedNode: ${focusManager.previousFocusedNode}`
    );
}

focusManager.advise('blurComponent', logEvent);
focusManager.advise('focusComponent', logEvent);
focusManager.advise('focusedComponent', logEvent);

viewportWatcher.advise('resize', () => { console.log('resized'); });
viewportWatcher.advise('scroll', () => { console.log('scrolled'); });
