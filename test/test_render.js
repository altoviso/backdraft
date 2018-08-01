import {e, render, Component, destroyDomChildren} from "../lib.js"

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

const smoke = window.smoke;
const assert = smoke.assert;
export default {
	id: "test render signatures",
	tests: [
		["signature [1]", function(){
			// element with type not a Component
			let id = "signature[1a]";
			let c = render(e("div", {id: id}, id));
			root.appendChild(c._dom.root);
			assert(root.firstChild.id === id);
			assert(root.firstChild.innerHTML === id);
			c.destroy();
			assert(root.innerHTML === "");

			// element with type a Component
			id = "signature[1b]";
			c = render(e(Component_, {id: id}));
			root.appendChild(c._dom.root);
			assert(root.firstChild.id === id);
			assert(root.firstChild.innerHTML === id);
			c.destroy();
			assert(root.innerHTML === "");
		}],
		["signature [2]", function(){
			let attachPoint = document.createElement("div");
			root.appendChild(attachPoint);

			// element with type not a Component
			let id = "signature[2a]";
			let c = render(e("div", {id: id}, id), attachPoint);
			assert(attachPoint.firstChild.id === id);
			assert(attachPoint.firstChild.innerHTML === id);
			c.destroy();
			assert(attachPoint.innerHTML === "");

			// element with type a Component
			id = "signature[2b]";
			c = render(e(Component, {id: id, elements: e("div", id)}), attachPoint);
			assert(attachPoint.firstChild.id === id);
			assert(attachPoint.firstChild.innerHTML === id);
			c.destroy();
			assert(attachPoint.innerHTML === "");

			attachPoint.appendChild(document.createElement("div"));

			// element with type not a Component
			id = "signature[2a]";
			c = render(e("div", {id: id}, id), attachPoint, "first");
			assert(attachPoint.firstChild.id === id);
			assert(attachPoint.firstChild.innerHTML === id);
			c.destroy();

			// element with type a Component
			id = "signature[2b]";
			c = render(e(Component, {id: id, elements: e("div", id)}), attachPoint, "first");
			assert(attachPoint.firstChild.id === id);
			assert(attachPoint.firstChild.innerHTML === id);
			c.destroy();

			root.innerHTML = "";
		}],
		["signature [3]", function(){
			id = "signature[3]";
			let c = render(Component_);
			root.appendChild(c._dom.root);
			assert(root.firstChild.id === id);
			assert(root.firstChild.innerHTML === id);

			c.destroy();
			assert(root.innerHTML === "");
		}],
		["signature [4]", function(){
			let s4 = "signature[4]";
			let c = render(Component_, {id: s4});
			root.appendChild(c._dom.root);
			assert(root.firstChild.id === s4);
			assert(root.firstChild.innerHTML === s4);

			c.destroy();
			assert(root.innerHTML === "");
		}],
		["signature [5]", function(){
			let attachPoint = document.createElement("div");
			root.appendChild(attachPoint);

			id = "signature[5]";
			let c = render(Component_, attachPoint);
			assert(attachPoint.firstChild.id === id);
			assert(attachPoint.firstChild.innerHTML === id);
			c.destroy();
			assert(attachPoint.innerHTML === "");

			attachPoint.appendChild(document.createElement("div"));

			id = "signature[5]-posit";
			c = render(Component_, attachPoint, "first");
			assert(attachPoint.firstChild.id === id);
			assert(attachPoint.firstChild.innerHTML === id);
			c.destroy();

			root.innerHTML = "";
		}],
		["signature [6]", function(){
			let attachPoint = document.createElement("div");
			root.appendChild(attachPoint);

			id = "signature[6]";
			let c = render(Component_, {id: id}, attachPoint);
			assert(attachPoint.firstChild.id === id);
			assert(attachPoint.firstChild.innerHTML === id);
			c.destroy();
			assert(attachPoint.innerHTML === "");

			attachPoint.appendChild(document.createElement("div"));

			id = "signature[6]-posit";
			c = render(Component_, {id: id}, attachPoint, "first");
			assert(attachPoint.firstChild.id === id);
			assert(attachPoint.firstChild.innerHTML === id);
			c.destroy();

			root.innerHTML = "";
		}],
		["signature [7]", function(){
			let s7 = "signature[7]";
			let c = new Component_({id: s7});
			let cc = render(c);
			assert(c === cc);
			assert(c.rendered);
			c.destroy();
		}],

		["signature [8]", function(){
			let s8a = "signature[8]";
			let c1 = new Component_({id: s8a});
			render(c1, root);
			assert(root.firstChild.id === s8a);
			assert(root.firstChild.innerHTML === s8a);

			let s8b = "signature[8]-posit";
			let c2 = new Component_({id: s8b});
			render(c2, root, "first");
			assert(root.firstChild.id === s8b);
			assert(root.firstChild.innerHTML === s8b);

			c1.destroy();
			c2.destroy();
			assert(root.innerHTML === "");
		}],
		{
			id: "render position",
			before: function(){
				root.innerHTML = "<div id='1'></div><div id='2'></div><div id='3'></div>";
				this.n1 = document.getElementById("1");
				this.n2 = document.getElementById("2");
				this.n3 = document.getElementById("3");
			},
			after: function(){
				root.innerHTML = "";
				delete this.n1;
				delete this.n2;
				delete this.n3;
			},
			tests: [
				["first", function(){
					let c = render(Component, root, "first");
					assert(c._dom.root.nextSibling === this.n1);
					c.destroy();
				}],
				["default", function(){
					let c = render(Component, root);
					assert(c._dom.root.previousSibling === this.n3);
					c.destroy();
				}],
				["last", function(){
					let c = render(Component, root, "last");
					assert(c._dom.root.previousSibling === this.n3);
					c.destroy();
				}],
				["before", function(){
					let c = render(Component, this.n1, "before");
					assert(c._dom.root.nextSibling === this.n1);
					c.destroy();
					c = render(Component, this.n2, "before");
					assert(c._dom.root.nextSibling === this.n2);
					c.destroy();
					c = render(Component, this.n3, "before");
					assert(c._dom.root.nextSibling === this.n3);
					c.destroy();
				}],
				["after", function(){
					let c = render(Component, this.n1, "after");
					assert(c._dom.root.previousSibling === this.n1);
					c.destroy();
					c = render(Component, this.n2, "after");
					assert(c._dom.root.previousSibling === this.n2);
					c.destroy();
					c = render(Component, this.n3, "after");
					assert(c._dom.root.previousSibling === this.n3);
					c.destroy();
				}],
				["nth", function(){
					let c = render(Component, root, 0);
					assert(root.firstChild === c._dom.root);
					c.destroy();
					c = render(Component, root, 1);
					assert(this.n1.nextSibling === c._dom.root);
					c.destroy();
					c = render(Component, root, 2);
					assert(this.n2.nextSibling === c._dom.root);
					c.destroy();
					c = render(Component, root, 3);
					assert(this.n3.nextSibling === c._dom.root);
					c.destroy();
				}],
				["only", function(){
					let c = render(Component, root, "only");
					assert(root.firstChild === c._dom.root);
					assert(root.childNodes.length === 1);
					c.destroy();
				}],
				["replace", function(){
					let c1 = render(Component, root, "only");
					assert(root.firstChild === c1._dom.root);
					assert(root.childNodes.length === 1);
					assert(c1.rendered);
					let c2 = render(Component, c1._dom.root, "replace");
					assert(root.firstChild === c2._dom.root);
					assert(root.childNodes.length === 1);
					assert(c1.destroyed);
					assert(c2.rendered);
					c2.destroy();
				}]
			]
		},
		{
			id: "render position, multiple roots",
			before: function(){
				root.innerHTML = "<div id='1'></div><div id='2'></div><div id='3'></div>";
				this.n1 = document.getElementById("1");
				this.n2 = document.getElementById("2");
				this.n3 = document.getElementById("3");
				this.check = () =>{
					assert(root.childNodes.length === 3);
					assert(root.childNodes[0] === this.n1);
					assert(root.childNodes[1] === this.n2);
					assert(root.childNodes[2] === this.n3);
				}
			},
			after: function(){
				root.innerHTML = "";
				delete this.n1;
				delete this.n2;
				delete this.n3;
			},
			tests: [
				["first", function(){
					let c = render(MultiRootComponent, root, "first");
					assert(root.firstChild === c._dom.root[0]);
					assert(c._dom.root[0].nextSibling === c._dom.root[1]);
					assert(c._dom.root[1].nextSibling === this.n1);
					c.destroy();
					this.check();
				}],
				["default", function(){
					let c = render(MultiRootComponent, root);
					assert(this.n3.nextSibling === c._dom.root[0]);
					assert(c._dom.root[0].nextSibling === c._dom.root[1]);
					c.destroy();
					this.check();
				}],
				["last", function(){
					let c = render(MultiRootComponent, root);
					assert(this.n3.nextSibling === c._dom.root[0]);
					assert(c._dom.root[0].nextSibling === c._dom.root[1]);
					c.destroy();
					this.check();
				}],
				["before", function(){
					let c = render(MultiRootComponent, this.n1, "before");
					assert(root.firstChild === c._dom.root[0]);
					assert(c._dom.root[0].nextSibling === c._dom.root[1]);
					assert(c._dom.root[1].nextSibling === this.n1);
					c.destroy();

					c = render(MultiRootComponent, this.n2, "before");
					assert(this.n1.nextSibling === c._dom.root[0]);
					assert(c._dom.root[0].nextSibling === c._dom.root[1]);
					assert(c._dom.root[1].nextSibling === this.n2);
					c.destroy();

					c = render(MultiRootComponent, this.n3, "before");
					assert(this.n2.nextSibling === c._dom.root[0]);
					assert(c._dom.root[0].nextSibling === c._dom.root[1]);
					assert(c._dom.root[1].nextSibling === this.n3);
					c.destroy();
					this.check();
				}],
				["after", function(){
					let c = render(MultiRootComponent, this.n1, "after");
					assert(this.n1.nextSibling === c._dom.root[0]);
					assert(c._dom.root[0].nextSibling === c._dom.root[1]);
					assert(c._dom.root[1].nextSibling === this.n2);
					c.destroy();

					c = render(MultiRootComponent, this.n2, "after");
					assert(this.n2.nextSibling === c._dom.root[0]);
					assert(c._dom.root[0].nextSibling === c._dom.root[1]);
					assert(c._dom.root[1].nextSibling === this.n3);
					c.destroy();

					c = render(MultiRootComponent, this.n3, "after");
					assert(this.n3.nextSibling === c._dom.root[0]);
					assert(c._dom.root[0].nextSibling === c._dom.root[1]);
					c.destroy();
					this.check();
				}],
				["nth", function(){
					let c = render(MultiRootComponent, root, 0);
					assert(root.firstChild === c._dom.root[0]);
					c.destroy();
					c = render(MultiRootComponent, root, 1);
					assert(this.n1.nextSibling === c._dom.root[0]);
					c.destroy();
					c = render(MultiRootComponent, root, 2);
					assert(this.n2.nextSibling === c._dom.root[0]);
					c.destroy();
					c = render(MultiRootComponent, root, 3);
					assert(this.n3.nextSibling === c._dom.root[0]);
					c.destroy();
					this.check();
				}],
				["only", function(){
					let c = render(MultiRootComponent, root, "only");
					assert(root.firstChild === c._dom.root[0]);
					assert(c._dom.root[0].nextSibling === c._dom.root[1]);
					assert(root.childNodes.length === 2);
					c.destroy();
					assert(root.childNodes.length===0);
				}],
				["replace", function(){
					let c1 = render(MultiRootComponent, root, "only");
					let c2 = render(MultiRootComponent, c1._dom.root[0], "replace");
					assert(root.firstChild === c2._dom.root[0]);
					assert(c2._dom.root[0].nextSibling === c2._dom.root[1]);
					assert(root.childNodes.length === 2);
					assert(c1.destroyed);
					assert(c2.rendered);
					c2.destroy();
					assert(root.childNodes.length===0);

				}]
			]
		}
	]
};
