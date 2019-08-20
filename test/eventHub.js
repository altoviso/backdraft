import {eventHub} from '../lib.js';

const smoke = typeof window !== 'undefined' ? window.smoke : require('bd-smoke');

const assert = smoke.assert;

smoke.defBrowserTest({
    id: 'eventHub',
    tests: [
        ['usage', function () {
            // eventHub is used to signal events. Notice that eventHub
            // is _not_ a class, but rather a function that returns a class.
            class SomeClass extends eventHub() {
                method1() {
                    // If eventHub::bdNotify is applied to a string, then the even object is implied; in this example
                    // the event object is === {type:"someEvent-1"}
                    this.bdNotify('someEvent-1');
                }

                method2(...args) {
                    // Signal an event that has some kind of computed event object
                    const eo = {
                        type: 'someEvent-2',
                        otherStuff: args.join('-')
                    };
                    this.bdNotify(eo);
                }

                method3() {
                    // Reflect a DOM event object...made synthetically here, but in a real program, usually its an object
                    // generated by an actual DOM event.
                    this.bdNotify(new Event('click'));
                }
            }

            // Here's a trivial handler for demonstration purposes.
            let expected;
            let handlerApplyCount = 0;

            function handler(e) {
                handlerApplyCount++;
                Object.keys(expected).forEach(key => {
                    assert(expected[key] === e[key]);
                });
            }

            // Create a new instance of SomeClass and hook up some handlers. We'll remember the connection handles
            // so we can demostrate destroying them later.
            const instance = new SomeClass();
            assert(instance.isBdEventHub);
            const h1 = instance.advise('someEvent-1', handler);
            const h2 = instance.advise('someEvent-2', handler);
            const h3 = instance.advise('click', handler);

            // SomeClass::method1 signals this kind of event object:
            expected = {type: 'someEvent-1', target: instance};
            instance.method1();
            assert(handlerApplyCount === 1);

            // SomeClass::method2 signals an event object based on a calculation method2
            expected = {type: 'someEvent-2', otherStuff: 'this-that-and the other', target: instance};
            instance.method2('this', 'that', 'and the other');
            assert(handlerApplyCount === 2);

            // SomeClass::method3 signals a DOM click event
            expected = {type: 'click', target: null};
            instance.method3();
            assert(handlerApplyCount === 3);

            // Multiple handles can be connected at one time.
            instance.advise({
                'someEvent-1': handler,
                'someEvent-2': handler,
                click: handler
            });

            // Now there are two handlers connected to each event.
            // SomeClass::method1 signals this kind of event object:
            expected = {type: 'someEvent-1', target: instance};
            instance.method1();
            assert(handlerApplyCount === 5);

            // SomeClass::method2 signals an event object based on a calculation method2
            expected = {type: 'someEvent-2', otherStuff: 'yet-another-example', target: instance};
            instance.method2('yet', 'another', 'example');
            assert(handlerApplyCount === 7);

            // SomeClass::method3 signals a DOM click event
            expected = {type: 'click', target: null};
            instance.method3();
            assert(handlerApplyCount === 9);

            // Destroy the first someEvent-1 handler.
            h1.destroy();
            expected = {type: 'someEvent-1', target: instance};
            // And the handler is only called once.
            instance.method1();
            assert(handlerApplyCount === 10);

            // All the handlers for an event can be destroyed at once.
            instance.destroyAdvise('someEvent-2');
            instance.method2('no handler will be called');
            assert(handlerApplyCount === 10);

            // At this point, there is one handler on "someEvent-1", non on "someEvent-2" and two on "click".

            // All the handlers on all the events can be destroyed at once.
            instance.destroyAdvise();
            instance.method1();
            instance.method2('no handler will be called');
            instance.method3();
            assert(handlerApplyCount === 10);
        }],
        ['structure', function () {
            // eventHubs do not define any instance variables.
            class Useless extends eventHub() {
                constructor() {
                    super();
                    this.pi = 3.14;
                }
            }

            const useless = new Useless();
            const ownKeys = Reflect.ownKeys(useless);
            assert(ownKeys.length === 1);
            assert(ownKeys[0] === 'pi');

            // eventHubs can be in the middle of a derivation chain.
            class Base {
                constructor() {
                    this.base = 'BASE';
                }
            }

            class SubClass extends eventHub(Base) {
                method1() {
                    this.bdNotify('event1');
                }
            }

            const sub = new SubClass();
            assert(sub.base === 'BASE');

            // Hook up a handler.
            let appliedCount = 0;
            sub.advise('event1', e => {
                appliedCount++;
                assert(e.type === 'event1');
                assert(e.target === sub);
            });

            // And watch it get applied.
            sub.method1();
            assert(appliedCount === 1);

            // eventHubs can be at the start of a derivation chain.
            class Incomplete {
                method1() {
                    // This won't work unless a eventHubs is mixed in.
                    this.bdNotify('event1');
                }
            }

            // Incomplete will throw when attempting to apply method1 since bdNotify isn't defined
            let instance = new Incomplete();
            try {
                instance.method1();
                assert(false);
            } catch (e) {
            }

            // Mix in a eventHub, and it works.
            class Complete extends eventHub(Incomplete) {}
            instance = new Complete();
            instance.method1();
        }]
    ]
});