import {e, render, Component, destroyDomChildren} from "../lib.js"

const smoke = typeof window !== "undefined" ? window.smoke : require("bd-smoke");
const assert = smoke.assert;
const root = document.getElementById("bd-smoke-root");

smoke.defBrowserTest({
	id: "post-processing",
	tests: [
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

		["static classname", function(){
			class Component5 extends Component {
			}

			Component5.className = "ctorStaticClassNameExample";

			let c = new Component5({});
			assert(c.className === "");
			c.className = "test";
			assert(c.className === "test");
			c.render();
			assert(c.className === "test");
			assert(c._dom.root.className === "ctorStaticClassNameExample test");
			c.className = "test2";
			assert(c.className === "test2");
			assert(c._dom.root.className === "ctorStaticClassNameExample test2");
			c.destroy();

			c = new Component5({staticClassName: "kwargsStaticClassNameExample"});
			assert(c.className === "");
			c.className = "test";
			assert(c.className === "test");
			c.render();
			assert(c.className === "test");
			assert(c._dom.root.className === "kwargsStaticClassNameExample ctorStaticClassNameExample test");
			c.className = "test2";
			assert(c.className === "test2");
			assert(c._dom.root.className === "kwargsStaticClassNameExample ctorStaticClassNameExample test2");
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
			class TestReflect extends Component {
				constructor(kwargs){
					super(kwargs);
					this.ppValue = kwargs.value || '?';
					this.ppValue2 = kwargs.value2 || '?';
				}

				get value(){
					return this.ppValue;
				}

				set value(_value){
					this.bdMutate('value', "ppValue", _value)
				}


				get value2(){
					return this.ppValue2;
				}

				set value2(_value){
					this.bdMutate('value2', "ppValue2", _value)
				}

				bdElements(){
					let formatter = s => 'formatted-' + s;
					return e('div',
						// string arg
						e('div', {bdAttach: 'n1', bdReflect: 'value'}),

						// string arg with a formatter
						e('div', {bdAttach: 'n2', bdReflect: ['value', formatter]}),

						// watchable
						e('div', {bdAttach: 'n3', bdReflect: this.getWatchable('value2')}),

						// watchable with a formatter
						e('div', {bdAttach: 'n4', bdReflect: this.getWatchable('value2', formatter)}),
					);
				}
			}

			let c = new TestReflect({});
			assert(c.value === '?');
			assert(c.value2 === '?');
			c.value = 'a';
			c.value2 = 'b';
			assert(c.value === 'a');
			assert(c.value2 === 'b');
			c.render();
			assert(c.n1.innerHTML === c.value);
			assert(c.n2.innerHTML === 'formatted-' + c.value);
			assert(c.n3.innerHTML === c.value2);
			assert(c.n4.innerHTML === 'formatted-' + c.value2);
			c.value = 'c';
			c.value2 = 'd';
			assert(c.value === 'c');
			assert(c.value2 === 'd');
			assert(c.n1.innerHTML === c.value);
			assert(c.n2.innerHTML === 'formatted-' + c.value);
			assert(c.n3.innerHTML === c.value2);
			assert(c.n4.innerHTML === 'formatted-' + c.value2);
			c.unrender();
			c.value = 'e';
			c.value2 = 'f';
			c.render();
			assert(c.value === 'e');
			assert(c.value2 === 'f');
			assert(c.n1.innerHTML === c.value);
			assert(c.n2.innerHTML === 'formatted-' + c.value);
			assert(c.n3.innerHTML === c.value2);
			assert(c.n4.innerHTML === 'formatted-' + c.value2);
			c.destroy();
		}],
		['reflect-class-part', function(){
			class TestReflectClassPart extends Component {
				constructor(kwargs){
					super(kwargs);
					this.ppValue = "a";
					this.ppValue2 = "b";
				}

				get value(){
					return this.ppValue;
				}

				set value(_value){
					this.bdMutate('value', "ppValue", _value);
				}

				get value2(){
					return this.ppValue2;
				}

				set value2(_value){
					this.bdMutate('value2', "ppValue2", _value);
				}
			}

			let theComponent;

			theComponent = new TestReflectClassPart({
				elements: () => e("div", {
					bdReflectClass: 'value'
				})
			});
			theComponent.render();
			assert(theComponent.className === "a");
			theComponent.value = 'c';
			assert(theComponent.className === "c");
			theComponent.destroy();

			theComponent = new TestReflectClassPart({
				elements: () => e("div", {
					bdReflectClass: theComponent.getWatchable('value')
				})
			});
			theComponent.render();
			assert(theComponent.className === "a");
			theComponent.value = 'c';
			assert(theComponent.className === "c");
			theComponent.destroy();

			theComponent = new TestReflectClassPart({
				elements: () => e("div", {
					bdReflectClass: theComponent.getWatchable('value', s => 'formatted-' + s)
				})
			});
			theComponent.render();
			assert(theComponent.className === "formatted-a");
			theComponent.value = 'c';
			assert(theComponent.className === "formatted-c");
			theComponent.destroy();

			theComponent = new TestReflectClassPart({
				elements: () => e("div", {
					bdReflectClass: ['value', 'value2']
				})
			});
			theComponent.render();
			assert(theComponent.containsClassName("a"));
			assert(theComponent.containsClassName("b"));
			assert(theComponent.className.length === 3);

			theComponent.value = 'c';
			theComponent.value2 = 'd';
			assert(theComponent.containsClassName("c"));
			assert(theComponent.containsClassName("d"));
			assert(theComponent.className.length === 3);
			theComponent.destroy();

			theComponent = new TestReflectClassPart({
				elements: () => e("div", {
					bdReflectClass: ['value', s => 'formatted-' + s, 'value2', s => 'formatted2 ' + s]
				})
			});
			theComponent.render();
			assert(theComponent.containsClassName("formatted-a"));
			assert(theComponent.containsClassName("formatted2"));
			assert(theComponent.containsClassName("b"));
			assert(theComponent.className.length === 24);

			theComponent.value = 'c';
			theComponent.value2 = 'd';
			assert(theComponent.containsClassName("formatted-c"));
			assert(theComponent.containsClassName("formatted2"));
			assert(theComponent.containsClassName("d"));
			assert(theComponent.className.length === 24);
			theComponent.destroy();

			theComponent = new TestReflectClassPart({
				elements: () => e("div", {
					bdReflectClass: [theComponent.getWatchable('value'), theComponent.getWatchable('value2')]
				})
			});
			theComponent.render();
			assert(theComponent.containsClassName("a"));
			assert(theComponent.containsClassName("b"));
			assert(theComponent.className.length === 3);

			theComponent.value = 'c';
			theComponent.value2 = 'd';
			assert(theComponent.containsClassName("c"));
			assert(theComponent.containsClassName("d"));
			assert(theComponent.className.length === 3);

			theComponent.destroy();

			theComponent = new TestReflectClassPart({
				elements: () => e("div", {
					bdReflectClass: [
						theComponent.getWatchable('value', s => 'formatted-' + s),
						theComponent.getWatchable('value2', s => 'formatted2 ' + s)
					]
				})
			});
			theComponent.render();
			assert(theComponent.containsClassName("formatted-a"));
			assert(theComponent.containsClassName("formatted2"));
			assert(theComponent.containsClassName("b"));
			assert(theComponent.className.length === 24);

			theComponent.value = 'c';
			theComponent.value2 = 'd';
			assert(theComponent.containsClassName("formatted-c"));
			assert(theComponent.containsClassName("formatted2"));
			assert(theComponent.containsClassName("d"));
			assert(theComponent.className.length === 24);
			theComponent.destroy();
		}]
	]
});
