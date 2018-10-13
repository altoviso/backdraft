import {e, render, Component, destroyDomChildren, withWatchables, watchHub, getAttr} from "../lib.js"

const smoke = typeof window !== "undefined" ? window.smoke : require("bd-smoke");
const assert = smoke.assert;
const root = document.getElementById("bd-smoke-root");

smoke.defBrowserTest({
	id: "post-processing",
	tests: [
		["advise", function(){
			class Component1 extends Component {
			}

			let component1;
			let results = {};

			class Component2 extends Component {
				bdElements(){
					return e("div", e(Component1, {
						bdAttach: function(child){
							component1 = child
						},
						bdAdvise: {
							event1: (e) => results.event1 = e,
							event2: (e) => results.event2 = e
						},
						bdAdvise_event3: (e) => results.event3 = e,
						bdAdvise_event4: (e) => results.event4 = e,
						bdOn: {
							event5: (e) => results.event5 = e,
							event6: (e) => results.event6 = e
						},
						bdOn_event7: (e) => results.event7 = e,
						bdOn_event8: (e) => results.event8 = e
					}))
				}
			}

			let c = new Component2();
			c.render();

			let event1 = {type: "event1"};
			let event2 = {type: "event2"};
			let event3 = {type: "event3"};
			let event4 = {type: "event4"};
			let event5 = {type: "event5"};
			let event6 = {type: "event6"};
			let event7 = {type: "event7"};
			let event8 = {type: "event8"};
			component1.bdNotify(event1);
			component1.bdNotify(event2);
			component1.bdNotify(event3);
			component1.bdNotify(event4);
			component1.bdNotify(event5);
			component1.bdNotify(event6);
			component1.bdNotify(event7);
			component1.bdNotify(event8);
			assert(results.event1.type === "event1");
			assert(results.event2.type === "event2");
			assert(results.event3.type === "event3");
			assert(results.event4.type === "event4");
			assert(results.event5.type === "event5");
			assert(results.event6.type === "event6");
			assert(results.event7.type === "event7");
			assert(results.event8.type === "event8");

			c.destroy();
		}],
		["attach", function(){
			class Component1 extends Component {
				bdElements(){
					return e("div",
						e("div", {bdAttach: "attachTest"})
					);
				}
			}

			let c = new Component1({});
			assert(!("attachTest" in c));
			c.render();
			assert(c.attachTest === c._dom.root.firstChild);
			c.unrender();
			assert(!("attachTest" in c));

			c = new Component({
				elements: e("div",
					e("div", {bdAttach: "attachTest"})
				)
			});
			assert(!("attachTest" in c));
			c.render();
			assert(c.attachTest === c._dom.root.firstChild);
			c.unrender();
			assert(!("attachTest" in c));

			c = render(e("div",
				e("div", {bdAttach: "attachTest"})
			));
			assert(c.attachTest === c._dom.root.firstChild);
			c.unrender();
			assert(!("attachTest" in c));

			c.destroy();
		}],
		["watch", function(){
			let v11 = 0;
			let v12 = 0;
			let v21 = 0;
			let v22 = 0;
			let v11_expected = 0;
			let v12_expected = 0;
			let v21_expected = 0;
			let v22_expected = 0;
			let firstComponent2;
			let secondComponent2;

			function handle_v11(newValue, oldValue, owner){
				assert(oldValue === v11);
				assert(newValue === v11_expected);
				assert(owner === c.firstComponent2);
				v11 = newValue;
			}


			function handle_v12(newValue, oldValue, owner){
				assert(oldValue === v12);
				assert(newValue === v12_expected);
				assert(owner === c.firstComponent2);
				v12 = newValue;
			}

			function handle_v21(newValue, oldValue, owner){
				assert(oldValue === v21);
				assert(newValue === v21_expected);
				assert(owner === c.secondComponent2);
				v21 = newValue;
			}


			function handle_v22(newValue, oldValue, owner){
				assert(oldValue === v22);
				assert(newValue === v22_expected);
				assert(owner === c.secondComponent2);
				v22 = newValue;
			}


			class Component2 extends Component {
				constructor(kwargs){
					super(kwargs);
					this._v1 = 0;
					this._v2 = 0;
				}

				get v1(){
					return this._v1;
				}

				set v1(value){
					this.bdMutate("v1", "_v1", value);
				}

				get v2(){
					return this._v2;
				}

				set v2(value){
					this.bdMutate("v2", "_v2", value);
				}
			}

			let c = new Component({
				elements: e("div",
					e(Component2, {
						bdAttach: "firstComponent2",
						bdWatch: {
							v1: handle_v11, v2: handle_v12
						}
					}),
					e(Component2, {
						bdAttach: "secondComponent2",
						bdWatch: {
							v1: handle_v21, v2: handle_v22
						}
					})
				)
			});
			c.render();

			c.firstComponent2.v1 = v11_expected = 1;
			c.firstComponent2.v1 = v11_expected = 2;
			c.firstComponent2.v1 = v11_expected = 3;
			c.firstComponent2.v1 = v11_expected = 4;

			c.destroy();

			v11 = 0;
			v12 = 0;
			v21 = 0;
			v22 = 0;
			v11_expected = 0;
			v12_expected = 0;
			v21_expected = 0;
			v22_expected = 0;


			c = new Component({
				elements: e("div",
					e(Component2, {
						bdAttach: "firstComponent2",
						bdWatch_v1: handle_v11,
						bdWatch_v2: handle_v12
					}),
					e(Component2, {
						bdAttach: "secondComponent2",
						bdWatch_v1: handle_v21,
						bdWatch_v2: handle_v22
					})
				)
			});
			c.render();

			c.firstComponent2.v1 = v11_expected = 1;
			c.firstComponent2.v1 = v11_expected = 2;
			c.firstComponent2.v1 = v11_expected = 3;
			c.firstComponent2.v1 = v11_expected = 4;

			c.destroy();
		}],
		["apply method", function(){
			class Component3 extends Component {
				constructor(kwargs){
					super(kwargs);
					this.test = "initial-value";
				}

				testMethod(value){
					this.test = value;
				}
			}

			let c = new Component({
				elements: e("div",
					e(Component3, {bdAttach: "c3", bdExec: ["testMethod", [3.14]]})
				)
			});
			assert(!("c3" in c));
			c.render();
			assert(c.c3.test === 3.14);
			c.destroy();
		}],

		["tabindex and title nodes", function(){
			class Component4 extends Component {
				bdElements(){
					return e("div",
						e("div", {bdAttach: "node1", tabIndex: -1}),
						e("div", {bdAttach: "node2", bdTitleNode: "any-value"})
					);
				}
			}

			let c = new Component4({});
			assert(c.tabIndex === undefined);
			c.render();
			assert(c._dom.tabIndexNode === c.node1);
			assert(c.node1.tabIndex === -1);
			c.tabIndex = 2;
			assert(c.tabIndex === 2);
			assert(c.node1.tabIndex === 2);
			assert(c._dom.titleNode === c.node2);
			c.destroy();

			c = new Component4({});
			c.tabIndex = 3;
			assert(c.tabIndex === 3);
			c.render();
			assert(c._dom.tabIndexNode === c.node1);
			assert(c.node1.tabIndex === 3);
			c.destroy();

			c = new Component4({tabIndex: 4});
			assert(c.tabIndex === 4);
			c.render();
			assert(c._dom.tabIndexNode === c.node1);
			assert(c.node1.tabIndex === 4);
			c.destroy();
		}],

		["parent attach point", function(){
			class Component6 extends Component {
				bdElements(){
					return e("div",
						e("div", {bdAttach: "node1"}),
						e("div", {bdAttach: "node2"})
					);
				}
			}

			let c = new Component6({});
			c.render();

			let child1 = c.insChild(e(Component, {}));
			let child2 = c.insChild(e(Component, {bdParentAttachPoint: "node1"}));
			let child3 = c.insChild(e(Component, {bdParentAttachPoint: "node2"}));
			assert(child1._dom.root.parentNode === c._dom.root);
			assert(child2._dom.root.parentNode === c.node1);
			assert(child3._dom.root.parentNode === c.node2);

			c.destroy();
		}],

		["children attach point", function(){
			class Component7 extends Component {
				bdElements(){
					return e("div",
						e("div", {bdChildrenAttachPoint: false}),
						e("div", {bdAttach: "theAttachPoint", bdChildrenAttachPoint: true})
					);
				}
			}

			let c = new Component7({});
			c.render();

			let child = c.insChild(e(Component, {}));
			assert(child._dom.root.parentNode === c.theAttachPoint);

			c.destroy();
		}],
		['reflect', function(){
			class SomeClass extends withWatchables(watchHub(), "value") {
			}

			let someClass = new SomeClass({value: 1});
			assert(someClass.value === 1);

			class TestReflect extends Component.withWatchables("value") {
				bdElements(){
					let formatter = s => 'formatted-' + s;
					return e('div',
						// string arg
						e('div', {bdAttach: 'n1', bdReflect: 'value', bdReflect_testProp: "value"}),

						// string arg with a formatter
						e('div', {
							bdAttach: 'n2',
							bdReflect: ['value', formatter],
							bdReflect_testProp: ['value', formatter]
						}),

						// watchable
						e('div', {
							bdAttach: 'n3',
							bdReflect: [someClass, "value"],
							bdReflect_testProp: [someClass, "value"]
						}),

						// watchable with a formatter
						e('div', {
							bdAttach: 'n4',
							bdReflect: [someClass, "value", formatter],
							bdReflect_testProp: [someClass, "value", formatter]
						}),
					);
				}
			}

			let c = new TestReflect({value: 2});
			assert(c.value === 2);

			someClass.value = 'a';
			c.value = 'b';
			assert(someClass.value === 'a');
			assert(c.value === 'b');

			function check(){
				assert(c.n1.innerHTML === c.value);
				assert(c.n2.innerHTML === 'formatted-' + c.value);
				assert(c.n3.innerHTML === someClass.value);
				assert(c.n4.innerHTML === 'formatted-' + someClass.value);
				assert(getAttr(c.n1, "testProp") === c.value);
				assert(getAttr(c.n2, "testProp") === 'formatted-' + c.value);
				assert(getAttr(c.n3, "testProp") === someClass.value);
				assert(getAttr(c.n4, "testProp") === 'formatted-' + someClass.value);
			}

			c.render();
			check();


			c.value = 'c';
			someClass.value = 'd';
			assert(c.value === 'c');
			assert(someClass.value === 'd');
			check();

			c.unrender();
			c.value = 'e';
			someClass.value = 'f';
			c.render();
			assert(c.value === 'e');
			assert(someClass.value === 'f');
			check();

			c.destroy();
		}],
		['reflect-class-part', function(){
			class SomeClass extends withWatchables(watchHub(), "value") {
			}

			let instanceOfSomeClass = new SomeClass({value: "test1"});
			assert(instanceOfSomeClass.value === "test1");

			class TestReflectClassPart extends Component.withWatchables("value") {
				constructor(kwargs){
					super(kwargs);
					this.value = "test2";
				}
			}

			let theComponent;

			theComponent = new TestReflectClassPart({
				elements: () => e("div", {
					bdReflectClass: 'value'
				})
			});
			theComponent.render();
			assert(theComponent.className === "test2");
			theComponent.value = 'test3';
			assert(theComponent.className === "test3");
			theComponent.destroy();

			theComponent = new TestReflectClassPart({
				elements: () => e("div", {
					bdReflectClass: ['value', s => 'formatted-' + s]
				})
			});
			theComponent.render();
			assert(theComponent.className === "formatted-test2");
			theComponent.value = 'test3';
			assert(theComponent.className === "formatted-test3");
			theComponent.destroy();

			function check(someClassValue, thisValue, noMutate){
				if(!noMutate){
					theComponent.value = thisValue;
					instanceOfSomeClass.value = someClassValue;
				}
				assert(theComponent.value === thisValue);
				assert(instanceOfSomeClass.value === someClassValue);
				assert(theComponent.containsClassName(thisValue));
				assert(theComponent.containsClassName(someClassValue));
				assert(theComponent.className.length-1 === (thisValue + someClassValue).length);
			}

			theComponent = new TestReflectClassPart({
				elements: () => e("div", {
					bdReflectClass: [instanceOfSomeClass, "value", "value"]
				})
			});
			theComponent.render();
			check("test1", "test2", true);
			check("test3", "test4", false);
			theComponent.destroy();

			instanceOfSomeClass.value = "test1";
			theComponent = new TestReflectClassPart({
				elements: () => e("div", {
					bdReflectClass: ["value", instanceOfSomeClass, "value"]
				})
			});
			theComponent.render();
			check("test1", "test2", true);
			check("test3", "test4", false);
			theComponent.destroy();

			function check2(someClassValue, componentValue, noMutate){
				if(!noMutate){
					theComponent.value = componentValue;
					instanceOfSomeClass.value = someClassValue;
				}
				assert(theComponent.value === componentValue);
				assert(instanceOfSomeClass.value === someClassValue);
				assert(theComponent.containsClassName("formatted1-" + someClassValue));
				assert(theComponent.containsClassName("formatted2-" + componentValue));
				assert(theComponent.className.length-1 === ("formatted1-" + componentValue + "formatted2-" + someClassValue).length);
			}


			instanceOfSomeClass.value = "test1";
			theComponent = new TestReflectClassPart({
				elements: () => e("div", {
					bdReflectClass: [instanceOfSomeClass, "value", s => "formatted1-" + s, "value", s => "formatted2-" + s]
				})
			});
			theComponent.render();
			check2("test1", "test2", true);
			check2("test3", "test4", false);
			theComponent.destroy();

			instanceOfSomeClass.value = "test1";
			theComponent = new TestReflectClassPart({
				elements: () => e("div", {
					bdReflectClass: ["value", s => "formatted2-" + s, instanceOfSomeClass, "value", s => "formatted1-" + s]
				})
			});
			theComponent.render();
			check2("test1", "test2", true);
			check2("test3", "test4", false);
			theComponent.destroy();
		}]
	]
});
