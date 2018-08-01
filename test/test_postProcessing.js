import {e, render, Component, destroyDomChildren} from "../lib.js"

let root = document.getElementById("root");

let id = 0;

class Component1 extends Component {
	_elements(){
		return e("div",
			e("div", {[e.attach]: "attachTest"})
		);
	}
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
		this._applyWatchers("v1", "_v1", value);
	}

	get v2(){
		return this._v2;
	}

	set v2(value){
		this._applyWatchers("v2", "_v2", value);
	}
}

class Component3 extends Component {
	constructor(kwargs){
		super(kwargs);
		this.test = "initial-value";
	}

	testMethod(value){
		this.test = value;
	}
}

class Component4 extends Component {
	_elements(){
		return e("div",
			e("div", {[e.attach]: "node1", [e.tabIndexNode]: true}),
			e("div", {[e.attach]: "node2", [e.titleNode]: "any-value"})
		);
	}
}

class Component5 extends Component {
}
Component5.className = "ctorStaticClassNameExample";


class Component6 extends Component {
	_elements(){
		return e("div",
			e("div", {[e.attach]: "node1"}),
			e("div", {[e.attach]: "node2"})
		);
	}
}


class Component7 extends Component {
	_elements(){
		return e("div",
			e("div", {[e.childrenAttachPoint]: false}),
			e("div", {[e.attach]: "theAttachPoint", [e.childrenAttachPoint]: true})
		);
	}
}

const smoke = window.smoke;
const assert = smoke.assert;
export default {
	id: "test post processing",
	tests: [
		["attach", function(){
			let c = new Component1({});
			assert(!("attachTest" in c));
			c.render();
			assert(c.attachTest === c._dom.root.firstChild);
			c.unrender();
			assert(!("attachTest" in c));

			c = new Component({
				elements: e("div",
					e("div", {[e.attach]: "attachTest"})
				)
			});
			assert(!("attachTest" in c));
			c.render();
			assert(c.attachTest === c._dom.root.firstChild);
			c.unrender();
			assert(!("attachTest" in c));

			c = render(e("div",
				e("div", {[e.attach]: "attachTest"})
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

			let c = new Component({
				elements: e("div",
					e(Component2, {
						[e.attach]: "firstComponent2",
						[e.watch]: {
							v1: handle_v11, v2: handle_v12
						}
					}),
					e(Component2, {
						[e.attach]: "secondComponent2",
						[e.watch]: {
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
			let c = new Component({elements:e("div",
					e(Component3, {[e.attach]:"c3", [e.applyMethod]:["testMethod", 3.14]})
				)});
			assert(!("c3" in c));
			c.render();
			assert(c.c3.test === 3.14);
			c.destroy();
		}],

		["tabindex and title nodes", function(){
			let c = new Component4({});
			c.render();
			assert(c._dom.tabIndexNode===c.node1);
			assert(c._dom.titleNode===c.node2);
			c.destroy();
		}],

		["static classname", function(){
			let c = new Component5({});
			assert(c.className==="");
			c.className = "test";
			assert(c.className==="test");
			c.render();
			assert(c.className==="test");
			assert(c._dom.root.className==="ctorStaticClassNameExample test");
			c.className = "test2";
			assert(c.className==="test2");
			assert(c._dom.root.className==="ctorStaticClassNameExample test2");
			c.destroy();

			c = new Component5({staticClassName:"kwargsStaticClassNameExample"});
			assert(c.className==="");
			c.className = "test";
			assert(c.className==="test");
			c.render();
			assert(c.className==="test");
			assert(c._dom.root.className==="kwargsStaticClassNameExample ctorStaticClassNameExample test");
			c.className = "test2";
			assert(c.className==="test2");
			assert(c._dom.root.className==="kwargsStaticClassNameExample ctorStaticClassNameExample test2");
			c.destroy();


			c = new Component5({
				staticClassName:"kwargsStaticClassNameExample",
				elements:e("div", {[e.staticClassName]: "postProcessStaticClassNameExample"})
			});
			assert(c.className==="");
			c.className = "test";
			assert(c.className==="test");
			c.render();
			assert(c.className==="test");
			assert(c._dom.root.className==="postProcessStaticClassNameExample test");
			c.className = "test2";
			assert(c.className==="test2");
			assert(c._dom.root.className==="postProcessStaticClassNameExample test2");
			c.destroy();
		}],

		["parent attach point", function(){
			let c = new Component6();
			c.render();

			let child1= c.insChild(e(Component, {}));
			let child2= c.insChild(e(Component, {[e.parentAttachPoint]: "node1"}));
			let child3= c.insChild(e(Component, {[e.parentAttachPoint]: "node2"}));
			assert(child1._dom.root.parentNode===c._dom.root);
			assert(child2._dom.root.parentNode===c.node1);
			assert(child3._dom.root.parentNode===c.node2);

			c.destroy();
		}],

		["children attach point", function(){
			let c = new Component7();
			c.render();

			let child= c.insChild(e(Component, {}));
			assert(child._dom.root.parentNode===c.theAttachPoint);

			c.destroy();
		}]
	]
};