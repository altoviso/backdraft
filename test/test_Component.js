import {e, Component, render} from "../lib.js"

let root = document.getElementById("root");

let id = 0;

class Component_ extends Component {
	constructor(kwargs){
		kwargs.id = kwargs.id || id;
		super(kwargs);
	}

	_elements(){
		return e("div", this.id)
	}
}


class MultiRootComponent extends Component {
	_elements(){
		return [
			e("div", {id: "root-1"}),
			e("div", {id: "root-2"})
		];
	}
}

class Parent extends Component_ {
	_elements(){
		return e("div",
			e("div", {id: "group-default", [e.childrenAttachPoint]: true}),
			e("div", {id: "group1", [e.attach]: "group1"}),
			e("div", {id: "group2", [e.attach]: "group2"}));
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
			assert(c._elements() === elements);
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
			assert(c._elements() === elements);
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
			assert(c._dom.root[0].id === "1");
			assert(c._dom.root[1].id === "2");
			assert(c._dom.root[2].id === "3");
			assert(c === Component.catalog.get(c._dom.root[0]));
			assert(c === Component.catalog.get(c._dom.root[1]));
			assert(c === Component.catalog.get(c._dom.root[2]));
			let nodes = [c._dom.root[0], c._dom.root[1], c._dom.root[2]];
			c.unrender();
			assert(Component.catalog.get(nodes[0]) === undefined);
			assert(Component.catalog.get(nodes[1]) === undefined);
			assert(Component.catalog.get(nodes[2]) === undefined);
			c.destroy();
		}],
		["typical-ins-del-child", function(){
			let parent = render(Parent, {id: "parent"}, root);
			let parentDefaultChildNodes = parent._dom.root.firstChild.childNodes;


			id = "child1";
			let child1 = parent.insChild(Component_);
			assert(child1.id === "child1");
			assert(child1._dom.root.innerHTML === "child1");

			id = "child2";
			let child2 = parent.insChild(Component_);
			assert(child2.id === "child2");
			assert(child2._dom.root.innerHTML === "child2");

			let child3 = parent.insChild(Component_, {id: "child3"});
			assert(child3.id === "child3");
			assert(child3._dom.root.innerHTML === "child3");

			assert(parentDefaultChildNodes.length === 3);
			assert(parentDefaultChildNodes[0].id === "child1");
			assert(parentDefaultChildNodes[1].id === "child2");
			assert(parentDefaultChildNodes[2].id === "child3");
			assert(parentDefaultChildNodes[0] === child1._dom.root);
			assert(parentDefaultChildNodes[1] === child2._dom.root);
			assert(parentDefaultChildNodes[2] === child3._dom.root);
			assert(parent.children.length === 3);
			assert(child1 === parent.children[0]);
			assert(child2 === parent.children[1]);
			assert(child3 === parent.children[2]);

			parent.delChild(child1, true);
			assert(parent.children.length === 2);
			assert(child2 === parent.children[0]);
			assert(child3 === parent.children[1]);

			parent.insChild(child1, "first");
			assert(parent.children.length === 3);
			assert(child2 === parent.children[0]);
			assert(child3 === parent.children[1]);
			assert(child1 === parent.children[2]);
			assert(parentDefaultChildNodes[0].id === "child1");
			assert(parentDefaultChildNodes[1].id === "child2");
			assert(parentDefaultChildNodes[2].id === "child3");

			parent.delChild(child2, true);
			assert(parent.children.length === 2);
			assert(child3 === parent.children[0]);
			assert(child1 === parent.children[1]);

			parent.insChild(child2, child1, "after");
			assert(child3 === parent.children[0]);
			assert(child1 === parent.children[1]);
			assert(child2 === parent.children[2]);
			assert(parentDefaultChildNodes[0].id === "child1");
			assert(parentDefaultChildNodes[1].id === "child2");
			assert(parentDefaultChildNodes[2].id === "child3");

			parent.delChild(child3, true);
			assert(parent.children.length === 2);
			assert(child1 === parent.children[0]);
			assert(child2 === parent.children[1]);

			parent.insChild(child3, "last");
			assert(child1 === parent.children[0]);
			assert(child2 === parent.children[1]);
			assert(child3 === parent.children[2]);
			assert(parentDefaultChildNodes[0].id === "child1");
			assert(parentDefaultChildNodes[1].id === "child2");
			assert(parentDefaultChildNodes[2].id === "child3");

			parent.delChild(child1);
			parent.delChild(child2);
			parent.delChild(child3);
			assert(parentDefaultChildNodes.length === 0);
			assert(parentDefaultChildNodes.length === 0);

			parent.destroy();
		}],
		{
			id: "ins/del child signatures",
			tests: [
				["signature [1]", function(){
					let parent = render(Parent, {id: "parent"}, root);
					let parentDefaultChildNodes = parent._dom.root.firstChild.childNodes;

					// element with type not a Component
					let id = "signature[1a]";
					let c = parent.insChild(e("div", {id: id}, id));
					assert(c._dom.root.innerHTML === id);
					assert(parent.children.length === 1);
					assert(parent.children[0] === c);
					assert(parentDefaultChildNodes[0] === c._dom.root);

					// element with type a Component
					id = "signature[1b]";
					c = parent.insChild(e(Component_, {id: id}));
					assert(c.id === id);
					assert(c._dom.root.innerHTML === id);
					assert(parent.children.length === 2);
					assert(parent.children[1] === c);
					assert(parentDefaultChildNodes[1] === c._dom.root);

					parent.delChild(parent.children[0]);
					assert(parent.children.length === 1);
					assert(parent.children[0] === c);
					assert(parentDefaultChildNodes[0] === c._dom.root);

					parent.delChild(parent.children[0]);
					assert(parent.children.length === 0);
					assert(parentDefaultChildNodes.length === 0);

					parent.destroy();
				}],
				["signature [2]", function(){
					let parent = render(Parent, {id: "parent"}, root);
					let group1ChildNodes = parent._dom.root.childNodes[1].childNodes;

					// element with type not a Component
					let id = "signature[2a]";
					let c = parent.insChild(e("div", {id: id}, id), "group1");
					assert(c._dom.root.innerHTML === id);
					assert(parent.children.length === 1);
					assert(parent.children[0] === c);
					assert(group1ChildNodes[0] === c._dom.root);

					// element with type a Component
					id = "signature[2b]";
					c = parent.insChild(e(Component_, {id: id}), "group1");
					assert(c.id === id);
					assert(c._dom.root.innerHTML === id);
					assert(parent.children.length === 2);
					assert(parent.children[1] === c);
					assert(group1ChildNodes[1] === c._dom.root);

					parent.delChild(parent.children[0]);
					assert(parent.children.length === 1);
					assert(parent.children[0] === c);
					assert(group1ChildNodes[0] === c._dom.root);

					parent.delChild(parent.children[0]);
					assert(parent.children.length === 0);
					assert(group1ChildNodes.length === 0);

					parent.destroy();
				}],
				["signature [3]", function(){
					let parent = render(Parent, {id: "parent"}, root);
					let parentDefaultChildNodes = parent._dom.root.firstChild.childNodes;

					id = "signature[3]";
					let c = parent.insChild(Component_);
					assert(c.id === id);
					assert(c._dom.root.innerHTML === id);
					assert(parent.children.length === 1);
					assert(parent.children[0] === c);
					assert(parentDefaultChildNodes[0] === c._dom.root);

					parent.delChild(c);
					assert(parent.children.length === 0);
					assert(parentDefaultChildNodes.length === 0);

					parent.destroy();
				}],
				["signature [4]", function(){
					let parent = render(Parent, {id: "parent"}, root);
					let parentDefaultChildNodes = parent._dom.root.firstChild.childNodes;

					let s4 = "signature[4]";
					let c = parent.insChild(Component_, {id: s4});
					assert(c.id === s4);
					assert(c._dom.root.innerHTML === s4);
					assert(parent.children.length === 1);
					assert(parent.children[0] === c);
					assert(parentDefaultChildNodes[0] === c._dom.root);

					parent.delChild(c);
					assert(parent.children.length === 0);
					assert(parentDefaultChildNodes.length === 0);

					parent.destroy();
				}],
				["signature [5]", function(){
					let parent = render(Parent, {id: "parent"}, root);
					let group1ChildNodes = parent._dom.root.childNodes[1].childNodes;

					id = "signature[5]";
					let c = parent.insChild(Component_, "group1");
					assert(c.id === id);
					assert(c._dom.root.innerHTML === id);
					assert(parent.children.length === 1);
					assert(parent.children[0] === c);
					assert(group1ChildNodes[0] === c._dom.root);

					parent.delChild(c);
					assert(parent.children.length === 0);
					assert(group1ChildNodes.length === 0);

					parent.destroy();
				}],
				["signature [6]", function(){
					let parent = render(Parent, {id: "parent"}, root);
					let group1ChildNodes = parent._dom.root.childNodes[1].childNodes;

					// element with type not a Component
					let s6 = "signature[6]";
					let c = parent.insChild(Component_, {id: s6}, "group1");
					assert(c.id === s6);
					assert(c._dom.root.innerHTML === s6);
					assert(parent.children.length === 1);
					assert(parent.children[0] === c);
					assert(group1ChildNodes[0] === c._dom.root);

					parent.delChild(c);
					assert(parent.children.length === 0);
					assert(group1ChildNodes.length === 0);

					parent.destroy();
				}],
				["signature [7]", function(){
					let parent = render(Parent, {id: "parent"}, root);
					let parentDefaultChildNodes = parent._dom.root.firstChild.childNodes;

					let s7 = "signature[7]";
					let c = new Component_({id: s7});
					let cc = parent.insChild(c);
					assert(c === cc);
					assert(c.id === s7);
					assert(c._dom.root.innerHTML === s7);
					assert(parent.children.length === 1);
					assert(parent.children[0] === c);
					assert(parentDefaultChildNodes[0] === c._dom.root);

					parent.delChild(c);
					assert(parent.children.length === 0);
					assert(parentDefaultChildNodes.length === 0);

					parent.destroy();
				}],

				["signature [8]", function(){
					let parent = render(Parent, {id: "parent"}, root);
					let group1ChildNodes = parent._dom.root.childNodes[1].childNodes;

					let s8 = "signature[8]";
					let c = new Component_({id: s8});
					let cc = parent.insChild(c, "group1");
					assert(c === cc);
					assert(c.id === s8);
					assert(c._dom.root.innerHTML === s8);
					assert(parent.children.length === 1);
					assert(parent.children[0] === c);
					assert(group1ChildNodes[0] === c._dom.root);

					parent.delChild(c);
					assert(parent.children.length === 0);
					assert(group1ChildNodes.length === 0);

					parent.destroy();
				}],
				{
					id: "attach to position",
					tests: [
						["first", function(){
							let parent = render(Parent, {id: "parent"}, root);
							let child1 = parent.insChild(Component_, {id: "child1"});
							let child2 = parent.insChild(Component_, {id: "child2"});
							let child3 = parent.insChild(Component_, {id: "child3"}, "first");
							let child4 = parent.insChild(Component_, {id: "child4"}, "group1");
							let child5 = parent.insChild(Component_, {id: "child5"}, "group1");
							let child6 = parent.insChild(Component_, {id: "child6"}, "group1", "first");
							assert(parent.children.length === 6);
							assert(parent.children[0] === child1);
							assert(parent.children[1] === child2);
							assert(parent.children[2] === child3);
							assert(parent.children[3] === child4);
							assert(parent.children[4] === child5);
							assert(parent.children[5] === child6);
							let nodes = document.getElementById("group-default").childNodes;
							assert(nodes[0] === child3._dom.root);
							assert(nodes[1] === child1._dom.root);
							assert(nodes[2] === child2._dom.root);
							nodes = document.getElementById("group1").childNodes;
							assert(nodes[0] === child6._dom.root);
							assert(nodes[1] === child4._dom.root);
							assert(nodes[2] === child5._dom.root);

							parent.destroy();
						}],
						["last", function(){
							let parent = render(Parent, {id: "parent"}, root);
							let child1 = parent.insChild(Component_, {id: "child1"});
							let child2 = parent.insChild(Component_, {id: "child2"});
							let child3 = parent.insChild(Component_, {id: "child3"}, "last");
							let child4 = parent.insChild(Component_, {id: "child4"}, "group1");
							let child5 = parent.insChild(Component_, {id: "child5"}, "group1");
							let child6 = parent.insChild(Component_, {id: "child6"}, "group1", "last");
							assert(parent.children.length === 6);
							assert(parent.children[0] === child1);
							assert(parent.children[1] === child2);
							assert(parent.children[2] === child3);
							assert(parent.children[3] === child4);
							assert(parent.children[4] === child5);
							assert(parent.children[5] === child6);
							let nodes = document.getElementById("group-default").childNodes;
							assert(nodes[0] === child1._dom.root);
							assert(nodes[1] === child2._dom.root);
							assert(nodes[2] === child3._dom.root);
							nodes = document.getElementById("group1").childNodes;
							assert(nodes[0] === child4._dom.root);
							assert(nodes[1] === child5._dom.root);
							assert(nodes[2] === child6._dom.root);

							parent.destroy();
						}],
						["before", function(){
							function check(){
								assert(parent.children.length === 6);
								assert(parent.children[0] === child1);
								assert(parent.children[1] === child2);
								assert(parent.children[2] === child3);
								assert(parent.children[3] === child4);
								assert(parent.children[4] === child5);
								assert(parent.children[5] === child6);
								let nodes = document.getElementById("group-default").childNodes;
								assert(nodes[0] === child1._dom.root);
								assert(nodes[1] === child2._dom.root);
								assert(nodes[2] === child3._dom.root);
								nodes = document.getElementById("group1").childNodes;
								assert(nodes[0] === child4._dom.root);
								assert(nodes[1] === child5._dom.root);
								assert(nodes[2] === child6._dom.root);
							}

							let parent = render(Parent, {id: "parent"}, root);
							let child1 = parent.insChild(Component_, {id: "child1"});
							let child2 = parent.insChild(Component_, {id: "child2"});
							let child3 = parent.insChild(Component_, {id: "child3"});
							let child4 = parent.insChild(Component_, {id: "child4"}, "group1");
							let child5 = parent.insChild(Component_, {id: "child5"}, "group1");
							let child6 = parent.insChild(Component_, {id: "child6"}, "group1");
							check();

							let childx = new Component_({id: "child6"});

							parent.insChild(childx, child1, "before");
							assert(childx._dom.root.nextSibling === child1._dom.root);
							parent.delChild(childx, true);
							check();


							parent.insChild(childx, child2, "before");
							assert(childx._dom.root.nextSibling === child2._dom.root);
							parent.delChild(childx, true);
							check();


							parent.insChild(childx, child3, "before");
							assert(childx._dom.root.nextSibling === child3._dom.root);
							parent.delChild(childx, true);
							check();


							parent.insChild(childx, child4, "before");
							assert(childx._dom.root.nextSibling === child4._dom.root);
							parent.delChild(childx, true);
							check();


							parent.insChild(childx, child5, "before");
							assert(childx._dom.root.nextSibling === child5._dom.root);
							parent.delChild(childx, true);
							check();


							parent.insChild(childx, child6, "before");
							assert(childx._dom.root.nextSibling === child6._dom.root);
							parent.delChild(childx, true);
							check();

							parent.destroy();
						}],
						["after", function(){
							function check(){
								assert(parent.children.length === 6);
								assert(parent.children[0] === child1);
								assert(parent.children[1] === child2);
								assert(parent.children[2] === child3);
								assert(parent.children[3] === child4);
								assert(parent.children[4] === child5);
								assert(parent.children[5] === child6);
								let nodes = document.getElementById("group-default").childNodes;
								assert(nodes[0] === child1._dom.root);
								assert(nodes[1] === child2._dom.root);
								assert(nodes[2] === child3._dom.root);
								nodes = document.getElementById("group1").childNodes;
								assert(nodes[0] === child4._dom.root);
								assert(nodes[1] === child5._dom.root);
								assert(nodes[2] === child6._dom.root);
							}

							let parent = render(Parent, {id: "parent"}, root);
							let child1 = parent.insChild(Component_, {id: "child1"});
							let child2 = parent.insChild(Component_, {id: "child2"});
							let child3 = parent.insChild(Component_, {id: "child3"});
							let child4 = parent.insChild(Component_, {id: "child4"}, "group1");
							let child5 = parent.insChild(Component_, {id: "child5"}, "group1");
							let child6 = parent.insChild(Component_, {id: "child6"}, "group1");
							check();

							let childx = new Component_({id: "child6"});

							parent.insChild(childx, child1, "after");
							assert(childx._dom.root === child1._dom.root.nextSibling);
							parent.delChild(childx, true);
							check();


							parent.insChild(childx, child2, "after");
							assert(childx._dom.root === child2._dom.root.nextSibling);
							parent.delChild(childx, true);
							check();


							parent.insChild(childx, child3, "after");
							assert(childx._dom.root === child3._dom.root.nextSibling);
							parent.delChild(childx, true);
							check();


							parent.insChild(childx, child4, "after");
							assert(childx._dom.root === child4._dom.root.nextSibling);
							parent.delChild(childx, true);
							check();


							parent.insChild(childx, child5, "after");
							assert(childx._dom.root === child5._dom.root.nextSibling);
							parent.delChild(childx, true);
							check();


							parent.insChild(childx, child6, "after");
							assert(childx._dom.root === child6._dom.root.nextSibling);
							parent.delChild(childx, true);
							check();

							parent.destroy();
						}],
						["nth", function(){
							function check(){
								assert(parent.children.length === 6);
								assert(parent.children[0] === child1);
								assert(parent.children[1] === child2);
								assert(parent.children[2] === child3);
								assert(parent.children[3] === child4);
								assert(parent.children[4] === child5);
								assert(parent.children[5] === child6);
								let nodes = document.getElementById("group-default").childNodes;
								assert(nodes[0] === child1._dom.root);
								assert(nodes[1] === child2._dom.root);
								assert(nodes[2] === child3._dom.root);
								nodes = document.getElementById("group1").childNodes;
								assert(nodes[0] === child4._dom.root);
								assert(nodes[1] === child5._dom.root);
								assert(nodes[2] === child6._dom.root);
							}

							let parent = render(Parent, {id: "parent"}, root);
							let child1 = parent.insChild(Component_, {id: "child1"});
							let child2 = parent.insChild(Component_, {id: "child2"});
							let child3 = parent.insChild(Component_, {id: "child3"});
							let child4 = parent.insChild(Component_, {id: "child4"}, "group1");
							let child5 = parent.insChild(Component_, {id: "child5"}, "group1");
							let child6 = parent.insChild(Component_, {id: "child6"}, "group1");
							check();

							let childx = new Component_({id: "child6"});

							parent.insChild(childx, 0);
							assert(childx._dom.root.nextSibling === child1._dom.root);
							parent.delChild(childx, true);
							check();


							parent.insChild(childx, 1);
							assert(childx._dom.root.nextSibling === child2._dom.root);
							parent.delChild(childx, true);
							check();


							parent.insChild(childx, 2);
							assert(childx._dom.root.nextSibling === child3._dom.root);
							parent.delChild(childx, true);
							check();

							parent.insChild(childx, "group1", 0);
							assert(childx._dom.root.nextSibling === child4._dom.root);
							parent.delChild(childx, true);
							check();


							parent.insChild(childx, "group1", 1);
							assert(childx._dom.root.nextSibling === child5._dom.root);
							parent.delChild(childx, true);
							check();


							parent.insChild(childx, "group1", 2);
							assert(childx._dom.root.nextSibling === child6._dom.root);
							parent.delChild(childx, true);
							check();

							parent.destroy();
						}],
						["only", function(){
							function check(){
								assert(parent.children.length === 6);
								assert(parent.children[0] === child1);
								assert(parent.children[1] === child2);
								assert(parent.children[2] === child3);
								assert(parent.children[3] === child4);
								assert(parent.children[4] === child5);
								assert(parent.children[5] === child6);
								let nodes = document.getElementById("group-default").childNodes;
								assert(nodes[0] === child1._dom.root);
								assert(nodes[1] === child2._dom.root);
								assert(nodes[2] === child3._dom.root);
								nodes = document.getElementById("group1").childNodes;
								assert(nodes[0] === child4._dom.root);
								assert(nodes[1] === child5._dom.root);
								assert(nodes[2] === child6._dom.root);
							}

							let parent = render(Parent, {id: "parent"}, root);
							let child1 = parent.insChild(Component_, {id: "child1"});
							let child2 = parent.insChild(Component_, {id: "child2"});
							let child3 = parent.insChild(Component_, {id: "child3"});
							let child4 = parent.insChild(Component_, {id: "child4"}, "group1");
							let child5 = parent.insChild(Component_, {id: "child5"}, "group1");
							let child6 = parent.insChild(Component_, {id: "child6"}, "group1");
							check();

							let childx = new Component_({id: "child6"});

							parent.insChild(childx, "only");
							assert(parent.children.length === 4);
							assert(parent.children[0] === child4);
							assert(parent.children[1] === child5);
							assert(parent.children[2] === child6);
							assert(parent.children[3] === childx);
							let nodes = document.getElementById("group-default").childNodes;
							assert(nodes[0] === childx._dom.root);
							nodes = document.getElementById("group1").childNodes;
							assert(nodes[0] === child4._dom.root);
							assert(nodes[1] === child5._dom.root);
							assert(nodes[2] === child6._dom.root);

							parent.delChild(childx);
							assert(parent.children.length === 3);
							assert(parent.children[0] === child4);
							assert(parent.children[1] === child5);
							assert(parent.children[2] === child6);
							nodes = document.getElementById("group-default").childNodes;

							assert(nodes.length === 0);

							parent.insChild(childx, "group1", "only");
							assert(parent.children.length === 1);
							assert(parent.children[0] === childx);
							nodes = document.getElementById("group1").childNodes;
							assert(nodes[0] === childx._dom.root);

							parent.destroy();
						}],
						["replace", function(){
							function check(){
								assert(parent.children.length === 6);
								assert(parent.children.indexOf(child1) !== -1);
								assert(parent.children.indexOf(child2) !== -1);
								assert(parent.children.indexOf(child3) !== -1);
								assert(parent.children.indexOf(child4) !== -1);
								assert(parent.children.indexOf(child5) !== -1);
								assert(parent.children.indexOf(child6) !== -1);
								let nodes = document.getElementById("group-default").childNodes;
								assert(nodes[0] === child1._dom.root);
								assert(nodes[1] === child2._dom.root);
								assert(nodes[2] === child3._dom.root);
								nodes = document.getElementById("group1").childNodes;
								assert(nodes[0] === child4._dom.root);
								assert(nodes[1] === child5._dom.root);
								assert(nodes[2] === child6._dom.root);
							}

							let parent = render(Parent, {id: "parent"}, root);
							let child1 = parent.insChild(Component_, {id: "child1"});
							let child2 = parent.insChild(Component_, {id: "child2"});
							let child3 = parent.insChild(Component_, {id: "child3"});
							let child4 = parent.insChild(Component_, {id: "child4"}, "group1");
							let child5 = parent.insChild(Component_, {id: "child5"}, "group1");
							let child6 = parent.insChild(Component_, {id: "child6"}, "group1");
							check();

							let childx = new Component_({id: "child6"});

							parent.insChild(childx, child1, "replace");
							assert(childx._dom.root.nextSibling === child2._dom.root);
							parent.insChild(child1, childx, "replace");
							check();

							parent.insChild(childx, child2, "replace");
							assert(childx._dom.root.nextSibling === child3._dom.root);
							parent.insChild(child2, childx, "replace");
							check();

							parent.insChild(childx, child3, "replace");
							assert(childx._dom.root === child2._dom.root.nextSibling);
							parent.insChild(child3, childx, "replace");
							check();

							parent.insChild(childx, child4, "replace");
							assert(childx._dom.root.nextSibling === child5._dom.root);
							parent.insChild(child4, childx, "replace");
							check();

							parent.insChild(childx, child5, "replace");
							assert(childx._dom.root.nextSibling === child6._dom.root);
							parent.insChild(child5, childx, "replace");
							check();

							parent.insChild(childx, child6, "replace");
							assert(childx._dom.root === child5._dom.root.nextSibling);
							parent.insChild(child6, childx, "replace");
							check();

							parent.destroy();
						}]
					]
				},
				{
					id: "render position, multiple roots",
					tests: [
						["first", function(){
							let parent = render(Parent, {id: "parent"}, root);
							let child1 = parent.insChild(Component_, {id: "child1"});
							let child2 = parent.insChild(Component_, {id: "child2"});
							let child3 = parent.insChild(MultiRootComponent, {id: "child3"}, "first");
							let child4 = parent.insChild(Component_, {id: "child4"}, "group1");
							let child5 = parent.insChild(Component_, {id: "child5"}, "group1");
							let child6 = parent.insChild(MultiRootComponent, {id: "child6"}, "group1", "first");
							assert(parent.children.length === 6);
							assert(parent.children[0] === child1);
							assert(parent.children[1] === child2);
							assert(parent.children[2] === child3);
							assert(parent.children[3] === child4);
							assert(parent.children[4] === child5);
							assert(parent.children[5] === child6);
							let nodes = document.getElementById("group-default").childNodes;
							assert(nodes[0] === child3._dom.root[0]);
							assert(nodes[1] === child3._dom.root[1]);
							assert(nodes[2] === child1._dom.root);
							assert(nodes[3] === child2._dom.root);
							nodes = document.getElementById("group1").childNodes;
							assert(nodes[0] === child6._dom.root[0]);
							assert(nodes[1] === child6._dom.root[1]);
							assert(nodes[2] === child4._dom.root);
							assert(nodes[3] === child5._dom.root);

							parent.destroy();
						}],
						["last", function(){
							let parent = render(Parent, {id: "parent"}, root);
							let child1 = parent.insChild(Component_, {id: "child1"});
							let child2 = parent.insChild(Component_, {id: "child2"});
							let child3 = parent.insChild(MultiRootComponent, {id: "child3"}, "last");
							let child4 = parent.insChild(Component_, {id: "child4"}, "group1");
							let child5 = parent.insChild(Component_, {id: "child5"}, "group1");
							let child6 = parent.insChild(MultiRootComponent, {id: "child6"}, "group1", "last");
							assert(parent.children.length === 6);
							assert(parent.children[0] === child1);
							assert(parent.children[1] === child2);
							assert(parent.children[2] === child3);
							assert(parent.children[3] === child4);
							assert(parent.children[4] === child5);
							assert(parent.children[5] === child6);
							let nodes = document.getElementById("group-default").childNodes;
							assert(nodes[0] === child1._dom.root);
							assert(nodes[1] === child2._dom.root);
							assert(nodes[2] === child3._dom.root[0]);
							assert(nodes[3] === child3._dom.root[1]);
							nodes = document.getElementById("group1").childNodes;
							assert(nodes[0] === child4._dom.root);
							assert(nodes[1] === child5._dom.root);
							assert(nodes[2] === child6._dom.root[0]);
							assert(nodes[3] === child6._dom.root[1]);

							parent.destroy();
						}],
						["before", function(){
							function check(){
								assert(parent.children.length === 6);
								assert(parent.children[0] === child1);
								assert(parent.children[1] === child2);
								assert(parent.children[2] === child3);
								assert(parent.children[3] === child4);
								assert(parent.children[4] === child5);
								assert(parent.children[5] === child6);
								let nodes = document.getElementById("group-default").childNodes;
								assert(nodes[0] === child1._dom.root);
								assert(nodes[1] === child2._dom.root);
								assert(nodes[2] === child3._dom.root);
								nodes = document.getElementById("group1").childNodes;
								assert(nodes[0] === child4._dom.root);
								assert(nodes[1] === child5._dom.root);
								assert(nodes[2] === child6._dom.root);
							}

							let parent = render(Parent, {id: "parent"}, root);
							let child1 = parent.insChild(Component_, {id: "child1"});
							let child2 = parent.insChild(Component_, {id: "child2"});
							let child3 = parent.insChild(Component_, {id: "child3"});
							let child4 = parent.insChild(Component_, {id: "child4"}, "group1");
							let child5 = parent.insChild(Component_, {id: "child5"}, "group1");
							let child6 = parent.insChild(Component_, {id: "child6"}, "group1");
							check();

							let childx = new MultiRootComponent({id: "child6"});

							parent.insChild(childx, child1, "before");
							assert(childx._dom.root[1].nextSibling === child1._dom.root);
							parent.delChild(childx, true);
							check();


							parent.insChild(childx, child2, "before");
							assert(childx._dom.root[1].nextSibling === child2._dom.root);
							parent.delChild(childx, true);
							check();


							parent.insChild(childx, child3, "before");
							assert(childx._dom.root[1].nextSibling === child3._dom.root);
							parent.delChild(childx, true);
							check();


							parent.insChild(childx, child4, "before");
							assert(childx._dom.root[1].nextSibling === child4._dom.root);
							parent.delChild(childx, true);
							check();


							parent.insChild(childx, child5, "before");
							assert(childx._dom.root[1].nextSibling === child5._dom.root);
							parent.delChild(childx, true);
							check();


							parent.insChild(childx, child6, "before");
							assert(childx._dom.root[1].nextSibling === child6._dom.root);
							parent.delChild(childx, true);
							check();

							parent.destroy();
						}],
						["after", function(){
							function check(){
								assert(parent.children.length === 6);
								assert(parent.children[0] === child1);
								assert(parent.children[1] === child2);
								assert(parent.children[2] === child3);
								assert(parent.children[3] === child4);
								assert(parent.children[4] === child5);
								assert(parent.children[5] === child6);
								let nodes = document.getElementById("group-default").childNodes;
								assert(nodes[0] === child1._dom.root);
								assert(nodes[1] === child2._dom.root);
								assert(nodes[2] === child3._dom.root);
								nodes = document.getElementById("group1").childNodes;
								assert(nodes[0] === child4._dom.root);
								assert(nodes[1] === child5._dom.root);
								assert(nodes[2] === child6._dom.root);
							}

							let parent = render(Parent, {id: "parent"}, root);
							let child1 = parent.insChild(Component_, {id: "child1"});
							let child2 = parent.insChild(Component_, {id: "child2"});
							let child3 = parent.insChild(Component_, {id: "child3"});
							let child4 = parent.insChild(Component_, {id: "child4"}, "group1");
							let child5 = parent.insChild(Component_, {id: "child5"}, "group1");
							let child6 = parent.insChild(Component_, {id: "child6"}, "group1");
							check();

							let childx = new MultiRootComponent({id: "child6"});

							parent.insChild(childx, child1, "after");
							assert(childx._dom.root[0] === child1._dom.root.nextSibling);
							parent.delChild(childx, true);
							check();


							parent.insChild(childx, child2, "after");
							assert(childx._dom.root[0] === child2._dom.root.nextSibling);
							parent.delChild(childx, true);
							check();


							parent.insChild(childx, child3, "after");
							assert(childx._dom.root[0] === child3._dom.root.nextSibling);
							parent.delChild(childx, true);
							check();


							parent.insChild(childx, child4, "after");
							assert(childx._dom.root[0] === child4._dom.root.nextSibling);
							parent.delChild(childx, true);
							check();


							parent.insChild(childx, child5, "after");
							assert(childx._dom.root[0] === child5._dom.root.nextSibling);
							parent.delChild(childx, true);
							check();


							parent.insChild(childx, child6, "after");
							assert(childx._dom.root[0] === child6._dom.root.nextSibling);
							parent.delChild(childx, true);
							check();

							parent.destroy();
						}],
						["nth", function(){
							function check(){
								assert(parent.children.length === 6);
								assert(parent.children[0] === child1);
								assert(parent.children[1] === child2);
								assert(parent.children[2] === child3);
								assert(parent.children[3] === child4);
								assert(parent.children[4] === child5);
								assert(parent.children[5] === child6);
								let nodes = document.getElementById("group-default").childNodes;
								assert(nodes[0] === child1._dom.root);
								assert(nodes[1] === child2._dom.root);
								assert(nodes[2] === child3._dom.root);
								nodes = document.getElementById("group1").childNodes;
								assert(nodes[0] === child4._dom.root);
								assert(nodes[1] === child5._dom.root);
								assert(nodes[2] === child6._dom.root);
							}

							let parent = render(Parent, {id: "parent"}, root);
							let child1 = parent.insChild(Component_, {id: "child1"});
							let child2 = parent.insChild(Component_, {id: "child2"});
							let child3 = parent.insChild(Component_, {id: "child3"});
							let child4 = parent.insChild(Component_, {id: "child4"}, "group1");
							let child5 = parent.insChild(Component_, {id: "child5"}, "group1");
							let child6 = parent.insChild(Component_, {id: "child6"}, "group1");
							check();

							let childx = new MultiRootComponent({id: "child6"});

							parent.insChild(childx, 0);
							assert(childx._dom.root[1].nextSibling === child1._dom.root);
							parent.delChild(childx, true);
							check();


							parent.insChild(childx, 1);
							assert(childx._dom.root[1].nextSibling === child2._dom.root);
							parent.delChild(childx, true);
							check();


							parent.insChild(childx, 2);
							assert(childx._dom.root[1].nextSibling === child3._dom.root);
							parent.delChild(childx, true);
							check();

							parent.insChild(childx, "group1", 0);
							assert(childx._dom.root[1].nextSibling === child4._dom.root);
							parent.delChild(childx, true);
							check();


							parent.insChild(childx, "group1", 1);
							assert(childx._dom.root[1].nextSibling === child5._dom.root);
							parent.delChild(childx, true);
							check();


							parent.insChild(childx, "group1", 2);
							assert(childx._dom.root[1].nextSibling === child6._dom.root);
							parent.delChild(childx, true);
							check();

							parent.destroy();
						}],
						["only", function(){
							function check(){
								assert(parent.children.length === 6);
								assert(parent.children[0] === child1);
								assert(parent.children[1] === child2);
								assert(parent.children[2] === child3);
								assert(parent.children[3] === child4);
								assert(parent.children[4] === child5);
								assert(parent.children[5] === child6);
								let nodes = document.getElementById("group-default").childNodes;
								assert(nodes[0] === child1._dom.root);
								assert(nodes[1] === child2._dom.root);
								assert(nodes[2] === child3._dom.root);
								nodes = document.getElementById("group1").childNodes;
								assert(nodes[0] === child4._dom.root);
								assert(nodes[1] === child5._dom.root);
								assert(nodes[2] === child6._dom.root);
							}

							let parent = render(Parent, {id: "parent"}, root);
							let child1 = parent.insChild(Component_, {id: "child1"});
							let child2 = parent.insChild(Component_, {id: "child2"});
							let child3 = parent.insChild(Component_, {id: "child3"});
							let child4 = parent.insChild(Component_, {id: "child4"}, "group1");
							let child5 = parent.insChild(Component_, {id: "child5"}, "group1");
							let child6 = parent.insChild(Component_, {id: "child6"}, "group1");
							check();

							let childx = new MultiRootComponent({id: "child6"});

							parent.insChild(childx, "only");
							assert(parent.children.length === 4);
							assert(parent.children[0] === child4);
							assert(parent.children[1] === child5);
							assert(parent.children[2] === child6);
							assert(parent.children[3] === childx);
							let nodes = document.getElementById("group-default").childNodes;
							assert(nodes[0] === childx._dom.root[0]);
							assert(nodes[1] === childx._dom.root[1]);
							nodes = document.getElementById("group1").childNodes;
							assert(nodes[0] === child4._dom.root);
							assert(nodes[1] === child5._dom.root);
							assert(nodes[2] === child6._dom.root);

							parent.delChild(childx);
							assert(parent.children.length === 3);
							assert(parent.children[0] === child4);
							assert(parent.children[1] === child5);
							assert(parent.children[2] === child6);
							nodes = document.getElementById("group-default").childNodes;
							assert(nodes.length === 0);

							parent.insChild(childx, "group1", "only");
							assert(parent.children.length === 1);
							assert(parent.children[0] === childx);
							nodes = document.getElementById("group1").childNodes;
							assert(nodes[0] === childx._dom.root[0]);
							assert(nodes[1] === childx._dom.root[1]);

							parent.destroy();
						}],
						["replace", function(){
							function check(){
								assert(parent.children.length === 6);
								assert(parent.children.indexOf(child1) !== -1);
								assert(parent.children.indexOf(child2) !== -1);
								assert(parent.children.indexOf(child3) !== -1);
								assert(parent.children.indexOf(child4) !== -1);
								assert(parent.children.indexOf(child5) !== -1);
								assert(parent.children.indexOf(child6) !== -1);
								let nodes = document.getElementById("group-default").childNodes;
								assert(nodes[0] === child1._dom.root);
								assert(nodes[1] === child2._dom.root);
								assert(nodes[2] === child3._dom.root);
								nodes = document.getElementById("group1").childNodes;
								assert(nodes[0] === child4._dom.root);
								assert(nodes[1] === child5._dom.root);
								assert(nodes[2] === child6._dom.root);
							}

							let parent = render(Parent, {id: "parent"}, root);
							let child1 = parent.insChild(Component_, {id: "child1"});
							let child2 = parent.insChild(Component_, {id: "child2"});
							let child3 = parent.insChild(Component_, {id: "child3"});
							let child4 = parent.insChild(Component_, {id: "child4"}, "group1");
							let child5 = parent.insChild(Component_, {id: "child5"}, "group1");
							let child6 = parent.insChild(Component_, {id: "child6"}, "group1");
							check();

							let childx = new MultiRootComponent({id: "child6"});

							parent.insChild(childx, child1, "replace");
							assert(childx._dom.root[1].nextSibling === child2._dom.root);
							parent.insChild(child1, childx, "replace");
							check();

							parent.insChild(childx, child2, "replace");
							assert(childx._dom.root[1].nextSibling === child3._dom.root);
							parent.insChild(child2, childx, "replace");
							check();

							parent.insChild(childx, child3, "replace");
							assert(childx._dom.root[0] === child2._dom.root.nextSibling);
							parent.insChild(child3, childx, "replace");
							check();

							parent.insChild(childx, child4, "replace");
							assert(childx._dom.root[1].nextSibling === child5._dom.root);
							parent.insChild(child4, childx, "replace");
							check();

							parent.insChild(childx, child5, "replace");
							assert(childx._dom.root[1].nextSibling === child6._dom.root);
							parent.insChild(child5, childx, "replace");
							check();

							parent.insChild(childx, child6, "replace");
							assert(childx._dom.root[0] === child5._dom.root.nextSibling);
							parent.insChild(child6, childx, "replace");
							check();

							parent.destroy();
						}]
					]
				}
			]
		},
		["position with reference a child with a forest", function(){

		}],
		["attached to document", function(){
			let c = new Component();
			assert(c.attachedToDoc===false);
			c.render();
			assert(c.attachedToDoc===false);
			render(c, root);
			assert(c.attachedToDoc===true);
			c.unrender();
			assert(c.attachedToDoc===false);

			c.render();
			let child1 = c.insChild(Component);
			let child2 = c.insChild(Component);
			let child11 = child1.insChild(Component);
			assert(child1.attachedToDoc===false);
			assert(child2.attachedToDoc===false);
			assert(child11.attachedToDoc===false);
			render(c, root);
			assert(child1.attachedToDoc===true);
			assert(child2.attachedToDoc===true);
			assert(child11.attachedToDoc===true);
			c.delChild(child1, true);
			assert(child1.attachedToDoc===false);
			assert(child2.attachedToDoc===true);
			assert(child11.attachedToDoc===false);
			c.insChild(child1);
			assert(child1.attachedToDoc===true);
			assert(child2.attachedToDoc===true);
			assert(child11.attachedToDoc===true);
			c.destroy();
		}]

	]
};
