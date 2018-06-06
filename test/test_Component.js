import {e, Component} from "../src/backdraft.js"

let root = document.getElementById("root");

let id = 0;

class Component_ extends Component {
	constructor(kwargs){
		kwargs.id = kwargs.id || id;
		super(kwargs);
	}

	get elements(){
		return e("div", this.id)
	}
}

const smoke = window.smoke;
const assert = smoke.assert;
export default {
	id: "test Component",
	tests: [
		["constructor-default", function(){
			let c = new Component();
			assert(c[Component.ppHasFocus] === false);
			assert(c.kwargs instanceof Object);
			assert(Reflect.ownKeys(c.kwargs).length === 0);
			assert(c.id === undefined);
			assert(c[Component.ppStaticClassName] === undefined);
			assert(c[Component.ppClassName] === "");
			assert(c[Component.ppTabIndex] === undefined);
			assert(c[Component.ppTitle] === undefined);
			assert(c[Component.ppEnabled] === true);
			assert(c.postRender === undefined);
			assert(!c.rendered);
			assert(c._dom === undefined);
			c.destroy();
			assert(c.kwargs === undefined);
		}],
		["constructor-with-args", function(){
			let elements = e("div");
			let postRender = function(){
			};
			let kwargs = {
				id: "123",
				staticClassName: "staticClass",
				className: "class",
				tabIndex: 2,
				title: "test title",
				enabled: true,
				postRender: postRender,
				elements: elements,
				arg1: {a: 1, b: 2},
				arg2: "test"
			};
			let c = new Component(kwargs);
			assert(c[Component.ppHasFocus] === false);
			assert(c.kwargs instanceof Object);
			assert(Reflect.ownKeys(c.kwargs).length === 2);
			assert(c.kwargs.arg1 === kwargs.arg1);
			assert(c.kwargs.arg2 === kwargs.arg2);
			assert(c.id === "123");
			assert(c[Component.ppStaticClassName] === "staticClass");
			assert(c[Component.ppClassName] === "class");
			assert(c[Component.ppTabIndex] === 2);
			assert(c[Component.ppTitle] === "test title");
			assert(c[Component.ppEnabled] === true);
			assert(c.postRender === postRender);
			assert(c.elements === elements);
			assert(!c.rendered);
			assert(c._dom === undefined);
			c.destroy();
			assert(c.kwargs === undefined);
		}],
		["constructor-with-elements-function", function(){
			let elements = e("div");
			let c = new Component({
				elements: function(){
					return elements;
				}
			});
			assert(c.elements === elements);
			c.destroy();
		}],
		["className-manipulation", function(){
			let elements = e("div");
			let c = new Component({
				elements: e("div", {className: "test1"}),
				className: "test2",
				staticClassName: "test3"
			});
			assert(c.className === "test2");
			assert(c[Component.ppStaticClassName] === "test3");
			c.render();
			let node = c._dom.root;
			let list = node.classList;
			assert(node.className.length === 17);
			assert(list.contains("test1"));
			assert(list.contains("test2"));
			assert(list.contains("test3"));
			c.className = "";
			assert(c._dom.root.className === "test3");
			c.className = "test4";
			assert(list.contains("test3"));
			assert(list.contains("test4"));
			c.addClassName("test5");
			assert(node.className.length === 17);
			assert(list.contains("test3"));
			assert(list.contains("test4"));
			assert(list.contains("test5"));
			c.addClassName("  test6   test7  ");
			assert(node.className.length === 29);
			assert(list.contains("test3"));
			assert(list.contains("test4"));
			assert(list.contains("test5"));
			assert(list.contains("test6"));
			assert(list.contains("test7"));
			c.removeClassName("test6 test7");
			assert(node.className.length === 17);
			assert(list.contains("test3"));
			assert(list.contains("test4"));
			assert(list.contains("test5"));
			c.toggleClassName("test4");
			assert(node.className.length === 11);
			assert(list.contains("test3"));
			assert(list.contains("test5"));
			c.toggleClassName("test4");
			assert(node.className.length === 17);
			assert(list.contains("test3"));
			assert(list.contains("test4"));
			assert(list.contains("test5"));
			c.destroy();
			c = new Component({className: "test1 test2 test3"});
			c.render();
			node = c._dom.root;
			assert(node.className === "test1 test2 test3");
			c.toggleClassName("test1");
			assert(node.className === "test2 test3");
			c.toggleClassName("test1");
			assert(node.classList.contains("test1"));
			c.className = "test1 test2 test3";
			assert(node.className === "test1 test2 test3");
			c.toggleClassName("test2");
			assert(node.className === "test1 test3");
			c.toggleClassName("test2");
			assert(node.classList.contains("test2"));
			c.className = "test1 test2 test3";
			assert(node.className === "test1 test2 test3");
			c.toggleClassName("test3");
			assert(node.className === "test1 test2");
			c.toggleClassName("test3");
			assert(node.classList.contains("test3"));
			c.destroy();
		}],
		["tabIndex", function(){
			let c = new Component({tabIndex: 1});
			assert(c[Component.ppTabIndex] === 1);
			c.render();
			assert(c._dom.root.tabIndex === 1);
			c.tabIndex = 2;
			assert(c[Component.ppTabIndex] === 2);
			assert(c._dom.root.tabIndex === 2);
			c.destroy();

			let elements = e("div",
				e("div", {tabIndex: 1, [e.tabIndexNode]: true})
			);
			c = new Component({elements: elements});
			assert(c[Component.ppTabIndex] === undefined);
			c.render();
			assert(c._dom.root.firstChild.tabIndex === 1);
			assert(c.tabIndex === 1);
			c.tabIndex = 2;
			assert(c[Component.ppTabIndex] === 2);
			assert(c._dom.root.firstChild.tabIndex === 2);
			c.destroy();
		}],
		["title", function(){
			let c = new Component({title: "title1"});
			assert(c[Component.ppTitle] === "title1");
			c.render();
			assert(c._dom.root.title === "title1");
			c.title = "title2";
			assert(c[Component.ppTitle] === "title2");
			assert(c._dom.root.title === "title2");
			c.destroy();

			let elements = e("div",
				e("div", {title: "title1", [e.titleNode]: true})
			);
			c = new Component({elements: elements});
			assert(c[Component.ppTitle] === undefined);
			c.render();
			assert(c._dom.root.title === "");
			assert(c._dom.root.firstChild.title === "title1");
			assert(c.title === "title1");
			c.title = "title2";
			assert(c[Component.ppTitle] === "title2");
			assert(c._dom.root.firstChild.title === "title2");
			c.destroy();
		}],
		["render-basics", function(){
			let c = new Component({id: "123"});
			assert(c.id === "123");
			assert(!c.rendered);
			c.render();
			assert(c.rendered);
			assert(c.id === "123");
			assert(c._dom.root.id === "123");
			assert(c === Component.catalog.get(c._dom.root));
			let node = c._dom.root;
			c.unrender();
			assert(!c.rendered);
			assert(Component.catalog.get(node) === undefined);
			c.render();
			assert(c.rendered);
			assert(c === Component.catalog.get(c._dom.root));
			node = c._dom.root;
			c.destroy();
			assert(Component.catalog.get(node) === undefined);
		}],
		["render-post-processing", function(){
			let postRender1Called = false;

			function postRender1(){
				postRender1Called = true;
			}

			let postRender2Called = false;

			function postRender2(){
				postRender2Called = true;
			}

			let c = new Component({postRender: postRender1});
			assert(!postRender1Called);
			assert(!postRender2Called);
			c.render(postRender2);
			assert(postRender1Called);
			assert(postRender2Called);
			c.destroy();

			class C extends Component {
				constructor(kwargs){
					super(kwargs);
					this.postRenderCalled = false;
				}

				postRender(){
					this.postRenderCalled = true;
				}
			}

			c = new C();
			assert(!c.postRenderCalled);
			c.render();
			assert(c.postRenderCalled);
			c.destroy();
		}],
		["render-multiple-roots", function(){
			let elements = [e("div", {id: 1}), e("div", {id: 2}), e("div", {id: 3})];
			let c = new Component({elements: elements});
			c.render();
			assert(Array.isArray(c._dom.root));
			assert(c._dom.root[0].id==="1");
			assert(c._dom.root[1].id==="2");
			assert(c._dom.root[2].id==="3");
			assert(c === Component.catalog.get(c._dom.root[0]));
			assert(c === Component.catalog.get(c._dom.root[1]));
			assert(c === Component.catalog.get(c._dom.root[2]));
			let nodes = [c._dom.root[0], c._dom.root[1], c._dom.root[2]];
			c.unrender();
			assert(Component.catalog.get(nodes[0])===undefined);
			assert(Component.catalog.get(nodes[1])===undefined);
			assert(Component.catalog.get(nodes[2])===undefined);
			c.destroy();
		}],
	]
};
