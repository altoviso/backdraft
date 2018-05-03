import {e, render, Component, destroyDomChildren} from "../src/backdraft.js"

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
	id: "test render signatures",
	tests: [
		["signature [1]", function(){
			let id = "signature[1]";
			let c = render(e("div", {id: id}, id));
			root.appendChild(c._dom.root);
			assert(root.firstChild.id === id);
			assert(root.firstChild.innerHTML === id);

			c.destroy();
			assert(root.innerHTML === "");
		}],
		["signature [2]", function(){
			let s2 = "signature[2]";
			let c1 = render(e("div", {id: s2}, s2), root);
			assert(root.firstChild.id === s2);
			assert(root.firstChild.innerHTML === s2);

			let s2a = "signature[2]-posit";
			let c2 = render(e("div", {id: s2a}, s2a), root, "first");
			assert(root.firstChild.id === s2a);
			assert(root.firstChild.innerHTML === s2a);

			c1.destroy();
			c2.destroy();
			assert(root.innerHTML === "");
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
			let s5a = id = "signature[5]";
			let c1 = render(Component_, root);
			assert(root.firstChild.id === s5a);
			assert(root.firstChild.innerHTML === s5a);

			let s5b = id = "signature[5]-posit";
			let c2 = render(Component_, root, "first");
			assert(root.firstChild.id === s5b);
			assert(root.firstChild.innerHTML === s5b);

			c1.destroy();
			c2.destroy();
			assert(root.innerHTML === "");
		}],
		["signature [6]", function(){
			let s6a = "signature[6]";
			let c1 = render(Component_, {id: s6a}, root);
			assert(root.firstChild.id === s6a);
			assert(root.firstChild.innerHTML === s6a);

			let s6b = "signature[6]-posit";
			let c2 = render(Component_, {id: s6b}, root, "first");
			assert(root.firstChild.id === s6b);
			assert(root.firstChild.innerHTML === s6b);

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
					assert(root.firstChild===c._dom.root);
					c.destroy();
					c = render(Component, root, 1);
					assert(this.n1.nextSibling===c._dom.root);
					c.destroy();
					c = render(Component, root, 2);
					assert(this.n2.nextSibling===c._dom.root);
					c.destroy();
					c = render(Component, root, 3);
					assert(this.n3.nextSibling===c._dom.root);
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
					assert(!c1.rendered);
					assert(c2.rendered);
					c1.destroy();
					c2.destroy();
				}]
			]
		}
	]
};
