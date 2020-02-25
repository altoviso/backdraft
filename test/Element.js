import {smoke} from '../node_modules/bd-smoke/smoke.js';
import {e, Element, Component} from '../lib.js';

const assert = smoke.assert;

smoke.defTest({
    id: 'Element',
    order: 1,
    tests: [
        ['constructor', function () {
            // here's a typical Element with all constructor arguments utilized
            // (imagine a div that has CSS that changes its :after content and color based on it's class)
            const e = new Element('div', {className: 'status', tabIndex: -1, bdReflectClass: 'label'}, 'status:');
            assert(e.type === 'div');
            assert(!e.isComponentType);
            assert(e.ctorProps.className === 'status');
            assert(e.ctorProps.tabIndex === -1);
            assert(e.ppFuncs.bdReflectClass === 'label');
            assert(e.children === 'status:');
        }],
        ['immutable', function () {
            // Elements are immutable
            const e = new Element('div', {className: 'status', tabIndex: -1, bdReflectClass: 'label'}, 'status:');
            try {
                e.type = 'p';
                assert(false);
            } catch (e) {
            }
            try {
                e.isComponentType = true;
                assert(false);
            } catch (e) {
            }
            try {
                e.ctorProps = {tabIndex: 2};
                assert(false);
            } catch (e) {
            }
            try {
                e.ctorProps.tabIndex = 2;
                assert(false);
            } catch (e) {
            }
            try {
                e.ppFuncs = {};
                assert(false);
            } catch (e) {
            }
            try {
                e.ppFuncs.bdReflectClass = 'somethingElse';
                assert(false);
            } catch (e) {
            }
            try {
                e.children = 'another';
                assert(false);
            } catch (e) {
            }
        }],
        ['type', function () {
            // at least type  must be provided at construction
            let e = new Element('div');
            assert(e.type === 'div');
            assert(!e.isComponentType);
            assert(e.hasOwnProperty('ctorProps'));
            assert(!e.hasOwnProperty('ppFuncs'));
            assert(!e.hasOwnProperty('children'));
            try {
                e = new Element();
            } catch (e) {
                assert((`${e}`).indexOf('type is required') !== -1);
            }

            // if type is a function, then it's assumed a contructor
            // eslint-disable-next-line no-empty-function
            function myConstructor() {
            }

            e = new Element(myConstructor);
            assert(e.type === myConstructor);
            assert(e.isComponentType);

            class myOtherConstructor {
            }

            e = new Element(myOtherConstructor);
            assert(e.type === myOtherConstructor);
            assert(e.isComponentType);

            // if type is not a function, then type is whatever it is converted to a string
            // this usage is unusual and advanced
            e = new Element({
                toString() {
                    return 'test1';
                }
            });
            assert(e.type === 'test1');
            assert(!e.isComponentType);

            // but if type is neither a function nor convertible to a string, then an exception is thrown
            try {
                e = new Element(Symbol('illegal-type'));
                assert(false);
            } catch (e) {
            }
        }],
        ['props', function () {
            // props can be provided without children
            let props = {tabIndex: -1, bdReflectClass: 'label'};
            let e = new Element('div', props);
            assert(e.ctorProps.tabIndex === -1);
            assert(e.ppFuncs.bdReflectClass === 'label');
            assert(!e.hasOwnProperty('children'));

            // if props doesn't have any ppFuncs, then ppFuncs isn't defined
            props = {tabIndex: -1};
            e = new Element('div', props);
            assert(e.ctorProps.tabIndex === -1);
            assert(!e.hasOwnProperty('ppFuncs'));

            // if props doesn't have any ctorProps, then ctorProps isn't defined
            props = {bdReflectClass: 'label'};
            e = new Element('div', props);
            assert(e.hasOwnProperty('ctorProps'));
            assert(e.ppFuncs.bdReflectClass === 'label');

            // and no ctorProps nor ppFuncs on props, then neither is defined
            props = {bdReflectClass: 'label'};
            e = new Element('div', {});
            assert(e.hasOwnProperty('ctorProps'));
            assert(!e.hasOwnProperty('ppFuncs'));

            // recall props must be an object, children can only be Elements or convertible to string
            // if the second arg is an object, then it is assumed to be props
            const reallyAChild = {
                toString() {
                    return 'some computed content';
                }
            };
            e = new Element('div', reallyAChild);
            assert(e.ctorProps.hasOwnProperty('toString'));
            assert(!e.hasOwnProperty('children'));
        }],
        ['children', function () {
            // children can be provided with props
            let e = new Element('div', 'OK');
            assert(e.hasOwnProperty('ctorProps'));
            assert(!e.hasOwnProperty('ppFuncs'));
            assert(e.children === 'OK');

            let person = 'Joe';
            e = new Element('div', 'hello, ', person);
            assert(e.hasOwnProperty('ctorProps'));
            assert(!e.hasOwnProperty('ppFuncs'));
            assert(e.children[0] === 'hello, ');
            assert(e.children[1] === 'Joe');

            const greeting = new Element('div', 'hello, ');
            person = new Element('div', 'Joe');
            e = new Element('div', greeting, person);
            assert(e.hasOwnProperty('ctorProps'));
            assert(!e.hasOwnProperty('ppFuncs'));
            assert(e.children[0] instanceof Element);
            assert(e.children[1] instanceof Element);
            assert(e.children[0].children === 'hello, ');
            assert(e.children[1].children === 'Joe');

            // a single child can be falsey (meaning no child), an Element or anything convertible to an string
            const child1 = new Element('div', 'Larry');
            const child2 = 'Curly';
            const child3 = {
                toString() {
                    return 'Moe';
                }
            };
            const illegalChild = Symbol('illegalChild');

            e = new Element('div', child1);
            assert(e.children === child1);
            e = new Element('div', child2);
            assert(e.children === child2);

            e = new Element('div', false);
            assert(!e.hasOwnProperty('children'));
            e = new Element('div', 0);
            assert(!e.hasOwnProperty('children'));
            e = new Element('div', null);
            assert(!e.hasOwnProperty('children'));
            e = new Element('div', {}, false);
            assert(!e.hasOwnProperty('children'));
            e = new Element('div', {}, 0);
            assert(!e.hasOwnProperty('children'));
            e = new Element('div', {}, null);
            assert(!e.hasOwnProperty('children'));

            // be careful to always provide props if the first child is an object; otherwise that child would
            // be interpreted as props
            e = new Element('div', {}, child3);
            assert(e.children === 'Moe');

            // a child that's neither an Element nor can be converted to a string is illegal
            try {
                e = new Element('div', illegalChild);
                assert(false);
            } catch (e) {
                assert(true);
            }

            // children can be single children and/or arrays of (children and/or arrays of (children and/or arrays ...))
            // whatever is provided is flattened into a single array (if more than one child)
            // or a single child (if that's all that was given)

            // a single child
            e = new Element('div', child1);
            assert(e.children === child1);

            // two child args, each a child
            e = new Element('div', child1, child2);
            assert(e.children[0] === child1);
            assert(e.children[1] === child2);

            // an array of a single child
            e = new Element('div', [child1]);
            assert(e.children === child1);

            // an array of a two children
            e = new Element('div', [child1, child2]);
            assert(e.children[0] === child1);
            assert(e.children[1] === child2);

            // an empty array
            e = new Element('div', []);
            assert(!e.hasOwnProperty('children'));

            // nests from hell
            e = new Element('div', [[], [], false, 0, null, [child1, child2], [child3], [], false, 0, null]);
            assert(e.children[0] === child1);
            assert(e.children[1] === child2);
            assert(e.children[2] === 'Moe');
            e = new Element('div', [[[[[child1, child2]]], [child3]], [], false, 0, null]);
            assert(e.children[0] === child1);
            assert(e.children[1] === child2);
            assert(e.children[2] === 'Moe');

            // if illegal children are found anywhere, an exception is thrown
            try {
                e = new Element('div', [[], [], false, 0, null, [child1, child2], [illegalChild], [], false, 0, null]);
                assert(false);
            } catch (e) {
            }
        }],
        {
            // just a repeat all the tests above, but using "e" rather than "new Element"; yet another example of why we need lisp macros
            id: 'element',
            tests: [
                ['constructor', function () {
                    // here's a typical Element with all constructor arguments utilized
                    // (imagine a div that has CSS that changes its :after content and color based on it's class)
                    const result = e('div', {className: 'status', tabIndex: -1, bdReflectClass: 'label'}, 'status:');
                    assert(result.type === 'div');
                    assert(!result.isComponentType);
                    assert(result.ctorProps.className === 'status');
                    assert(result.ctorProps.tabIndex === -1);
                    assert(result.ppFuncs.bdReflectClass === 'label');
                    assert(result.children === 'status:');
                }],
                ['immutable', function () {
                    // Elements are immutable
                    const result = e('div', {className: 'status', tabIndex: -1, bdReflectClass: 'label'}, 'status:');
                    try {
                        result.type = 'p';
                        assert(false);
                    } catch (e) {
                    }
                    try {
                        result.isComponentType = true;
                        assert(false);
                    } catch (e) {
                    }
                    try {
                        result.ctorProps = {tabIndex: 2};
                        assert(false);
                    } catch (e) {
                    }
                    try {
                        result.ctorProps.tabIndex = 2;
                        assert(false);
                    } catch (e) {
                    }
                    try {
                        result.ppFuncs = {};
                        assert(false);
                    } catch (e) {
                    }
                    try {
                        result.ppFuncs.bdReflectClass = 'somethingElse';
                        assert(false);
                    } catch (e) {
                    }
                    try {
                        result.children = 'another';
                        assert(false);
                    } catch (e) {
                    }
                }],
                ['type', function () {
                    // at least type  must be provided at construction
                    let result = e('div');
                    assert(result.type === 'div');
                    assert(!result.isComponentType);
                    assert(result.hasOwnProperty('ctorProps'));
                    assert(!Reflect.ownKeys(result.ctorProps).length);
                    assert(!result.hasOwnProperty('ppFuncs'));
                    assert(!result.hasOwnProperty('children'));
                    try {
                        result = e();
                    } catch (e) {
                        assert((`${e}`).indexOf('type is required') !== -1);
                    }

                    // if type is a function, then it's assumed a contructor
                    function myConstructor() {
                    }

                    result = e(myConstructor);
                    assert(result.type === myConstructor);
                    assert(result.isComponentType);

                    class myOtherConstructor {
                    }

                    result = e(myOtherConstructor);
                    assert(result.type === myOtherConstructor);
                    assert(result.isComponentType);

                    // if type is not a function, then type is whatever it is converted to a string
                    // this usage is unusual and advanced
                    result = e({
                        toString() {
                            return 'test1';
                        }
                    });
                    assert(result.type === 'test1');
                    assert(!result.isComponentType);

                    // but if type is neither a function nor convertible to a string, then an exception is thrown
                    try {
                        result = e(Symbol('illegal-type'));
                        assert(false);
                    } catch (e) {
                    }
                }],
                ['props', function () {
                    // props can be provided without children
                    let props = {tabIndex: -1, bdReflectClass: 'label'};
                    let result = e('div', props);
                    assert(result.ctorProps.tabIndex === -1);
                    assert(result.ppFuncs.bdReflectClass === 'label');
                    assert(!result.hasOwnProperty('children'));

                    // if props doesn't have any ppFuncs, then ppFuncs isn't defined
                    props = {tabIndex: -1};
                    result = e('div', props);
                    assert(result.ctorProps.tabIndex === -1);
                    assert(!result.hasOwnProperty('ppFuncs'));

                    // if props doesn't have any ctorProps, then ctorProps defaults to {}
                    props = {bdReflectClass: 'label'};
                    result = e('div', props);
                    assert(!Reflect.ownKeys(result.ctorProps).length);
                    assert(result.ppFuncs.bdReflectClass === 'label');

                    // And no ctorProps nor ppFuncs on props.
                    result = e('div');
                    assert(!Reflect.ownKeys(result.ctorProps).length);
                    assert(!result.hasOwnProperty('ppFuncs'));

                    // recall props must be an object, children can only be Elements or convertible to string
                    // if the second arg is an object, then it is assumed to be props
                    const reallyAChild = {
                        toString() {
                            return 'some computed content';
                        }
                    };
                    result = e('div', reallyAChild);
                    assert(result.ctorProps.hasOwnProperty('toString'));
                    assert(!result.hasOwnProperty('children'));
                }],
                ['children', function () {
                    // children can be provided with props
                    let result = e('div', 'OK');
                    assert(result.hasOwnProperty('ctorProps'));
                    assert(!Reflect.ownKeys(result.ctorProps).length);
                    assert(!result.hasOwnProperty('ppFuncs'));
                    assert(result.children === 'OK');

                    let person = 'Joe';
                    result = e('div', 'hello, ', person);
                    assert(result.hasOwnProperty('ctorProps'));
                    assert(!Reflect.ownKeys(result.ctorProps).length);
                    assert(!result.hasOwnProperty('ppFuncs'));
                    assert(result.children[0] === 'hello, ');
                    assert(result.children[1] === 'Joe');

                    const greeting = e('div', 'hello, ');
                    person = e('div', 'Joe');
                    result = e('div', greeting, person);
                    assert(result.hasOwnProperty('ctorProps'));
                    assert(!Reflect.ownKeys(result.ctorProps).length);
                    assert(!result.hasOwnProperty('ppFuncs'));
                    assert(result.children[0] instanceof Element);
                    assert(result.children[1] instanceof Element);
                    assert(result.children[0].children === 'hello, ');
                    assert(result.children[1].children === 'Joe');

                    // a single child can be falsey (meaning no child), an Element or anything convertible to an string
                    const child1 = e('div', 'Larry');
                    const child2 = 'Curly';
                    const child3 = {
                        toString() {
                            return 'Moe';
                        }
                    };
                    const illegalChild = Symbol('illegalChild');

                    result = e('div', child1);
                    assert(result.children === child1);
                    result = e('div', child2);
                    assert(result.children === child2);

                    result = e('div', false);
                    assert(!result.hasOwnProperty('children'));
                    result = e('div', 0);
                    assert(!result.hasOwnProperty('children'));
                    result = e('div', null);
                    assert(!result.hasOwnProperty('children'));
                    result = e('div', {}, false);
                    assert(!result.hasOwnProperty('children'));
                    result = e('div', {}, 0);
                    assert(!result.hasOwnProperty('children'));
                    result = e('div', {}, null);
                    assert(!result.hasOwnProperty('children'));

                    // be careful to always provide props if the first child is an object; otherwise that child would
                    // be interpreted as props
                    result = e('div', {}, child3);
                    assert(result.children === 'Moe');

                    // a child that's neither an Element nor can be converted to a string is illegal
                    try {
                        result = e('div', illegalChild);
                        assert(false);
                    } catch (e) {
                        assert(true);
                    }

                    // children can be single children and/or arrays of (children and/or arrays of (children and/or arrays ...))
                    // whatever is provided is flattened into a single array (if more than one child)
                    // or a single child (if that's all that was given)

                    // a single child
                    result = e('div', child1);
                    assert(result.children === child1);

                    // two child args, each a child
                    result = e('div', child1, child2);
                    assert(result.children[0] === child1);
                    assert(result.children[1] === child2);

                    // an array of a single child
                    result = e('div', [child1]);
                    assert(result.children === child1);

                    // an array of a two children
                    result = e('div', [child1, child2]);
                    assert(result.children[0] === child1);
                    assert(result.children[1] === child2);

                    // an empty array
                    result = e('div', []);
                    assert(!result.hasOwnProperty('children'));

                    // nests from hell
                    result = e('div', [[], [], false, 0, null, [child1, child2], [child3], [], false, 0, null]);
                    assert(result.children[0] === child1);
                    assert(result.children[1] === child2);
                    assert(result.children[2] === 'Moe');
                    result = e('div', [[[[[child1, child2]]], [child3]], [], false, 0, null]);
                    assert(result.children[0] === child1);
                    assert(result.children[1] === child2);
                    assert(result.children[2] === 'Moe');

                    // if illegal children are found anywhere, an exception is thrown
                    try {
                        result = e('div', [[], [], false, 0, null, [child1, child2], [illegalChild], [], false, 0, null]);
                        assert(false);
                    } catch (e) {
                    }
                }],
                ['html-node-types', function () {
                    class Parent extends Component {
                        bdElements() {
                            return e.div(
                            );
                        }
                    }
                    const parent = new Parent();
                    parent.render();
                    assert(parent.bdDom.root.tagName === 'DIV');

                    class Child extends Component {
                        bdElements() {
                            return this.kwargs.test;
                        }
                    }

                    function exercise(test) {
                        const child = parent.insChild(new Child({test: e[test]()}));
                        const pass = parent.bdDom.root.firstChild.tagName === test.toUpperCase();
                        if (!pass) {
                            console.log('html-node-types fail:', test);
                        }
                        assert(pass);
                        parent.delChild(child);
                    }

                    'a.abbr.address.area.article.aside.audio.base.bdi.bdo.blockquote.br.button.canvas.caption.cite.code.col.colgroup.data.datalist.dd.del.details.dfn.div.dl.dt.em.embed.fieldset.figcaption.figure.footer.form.h1.head.header.hr.html.i.iframe.img.input.ins.kbd.label.legend.li.link.main.map.mark.meta.meter.nav.noscript.object.ol.optgroup.option.output.p.param.picture.pre.progress.q.rb.rp.rt.rtc.ruby.s.samp.script.section.select.slot.small.source.span.strong.style.sub.summary.sup.table.tbody.td.template.textarea.tfoot.th.thead.time.title.tr.track.u.ul.var.video.wbr'.split('.').forEach(exercise);
                }]
            ]
        }
    ]
});
//
