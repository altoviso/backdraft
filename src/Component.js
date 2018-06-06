import {default as element, Element} from "./element.js"
import EventHub from './EventHub.js'
import WatchHub from './WatchHub.js'

element.insPostProcessingFunction(element, "attach", Symbol("post-process-function-attach"),
	function(target, source, resultIsDomNode, name){
		target[name] = source;
	}
);

element.insPostProcessingFunction(element, "watch", Symbol("post-process-function-watch"),
	function(target, source, resultIsDomNode, watchers){
		Reflect.ownKeys(watchers).forEach((name) =>{
			source.ownWhileRendered(source.watch(name, watchers[name]))
		})
	}
);

element.insPostProcessingFunction(element, "applyMethod", Symbol("post-process-function-apply-method"),
	function(target, source, resultIsDomNode, name, ...args){
		source[name](...args);
	}
);

element.insPostProcessingFunction(element, "tabIndexNode", Symbol("post-process-function-tabIndex-node"),
	function(target, source){
		target._dom.tabIndexNode = source;
	}
);

element.insPostProcessingFunction(element, "titleNode", Symbol("post-process-function-title-node"),
	function(target, source){
		target._dom.titleNode = source;
	}
);

element.insPostProcessingFunction(element, "staticClassName", Symbol("post-process-function-static-className"),
	function(target, source, resultIsDomNode, className){
		target[ppStaticClassName] = className
	}
);

// private properties
const
	ppClassName = Symbol("bd-component-ppClassName"),
	ppStaticClassName = Symbol("bd-component-ppStaticClassName"),
	ppEnabled = Symbol("bd-component-ppEnabled"),
	ppTabIndex = Symbol("bd-component-ppTabIndex"),
	ppTitle = Symbol("bd-component-ppTitle"),
	ppParent = Symbol("bd-component-ppParent"),
	ppHasFocus = Symbol("bd-component-ppHasFocus"),
	ppOnFocus = Symbol("bd-component-ppOnFocus"),
	ppOnBlur = Symbol("bd-component-pponBlur"),
	ppSetClassName = Symbol("bd-component-ppSetClassName"),
	ppOwnedHandles = Symbol("bd-component-ppOwnedHandles");

function cleanClassName(s){
	return s.replace(/\s{2,}/g, " ").trim();
}

function calcDomClassName(component){
	let rootStaticDomClass = component[ppStaticClassName];
	let className = component[ppClassName];
	if(rootStaticDomClass && className){
		return rootStaticDomClass + " " + className;
	}else{
		return rootStaticDomClass || className;
	}
}

const TypeDomNode = Symbol("dom-node");
const TypeTextNode = Symbol("text-node");
const TypeComponentNode = Symbol("component-node");

function componentType(element){
	return element instanceof Element ?
		(typeof element.type === "string" ? TypeDomNode :
			TypeComponentNode) : TypeTextNode;
}

function addChildToDomNode(parent, domNode, child, childType){
	if(childType === TypeComponentNode){
		let childDomRoot = child._dom.root;
		if(Array.isArray(childDomRoot)){
			childDomRoot.forEach((node) => domNode.appendChild(node));
		}else{
			domNode.appendChild(childDomRoot);
		}
		parent._adopt(child);
	}else{
		domNode.appendChild(child);
	}
}

function validateElements(instance, elements){
	function error(){
		throw new Error("Illegal: root elements for a Component cannot be Components")
	}

	if(Array.isArray(elements)){
		elements.forEach((e) =>{
			if(componentType(e) !== TypeDomNode){
				error();
			}
		});
	}else{
		if(componentType(elements) !== TypeDomNode){
			error()
		}
	}
}

function postProcess(ppProps, owner, target, targetIsDomNode){
	Reflect.ownKeys(ppProps).forEach((ppProp) =>{
		let args = ppProps[ppProp];
		if(Array.isArray(args)){
			element[ppProp](owner, target, targetIsDomNode, ...args);
		}else{
			element[ppProp](owner, target, targetIsDomNode, args);
		}
	});
}

function pushHandles(dest, ...handles){
	handles.forEach(h =>{
		if(Array.isArray(h)){
			pushHandles(dest, ...h);
		}else if(h){
			dest.push(h)
		}
	});
}

export default class Component extends EventHub(WatchHub()) {
	constructor(kwargs){
		super(kwargs);

		this[ppHasFocus] = false;
		kwargs = this.kwargs = Object.assign({}, kwargs);

		if(kwargs.id){
			Object.defineProperty(this, "id", {value: kwargs.id, enumerable: true});
			delete kwargs.id;
		}

		if(kwargs.staticClassName){
			this[ppStaticClassName] = kwargs.staticClassName + (this.constructor.className ? " " + this.constructor.className : "");
			delete kwargs.staticClassName;
		}else if(this.constructor.className){
			this[ppStaticClassName] = this.constructor.className;
		}

		if(kwargs.className){
			this[ppClassName] = kwargs.className;
			delete kwargs.className;
		}else{
			this[ppClassName] = "";
		}

		if(kwargs.tabIndex){
			this[ppTabIndex] = kwargs.tabIndex;
			delete kwargs.tabIndex;
		}

		if(kwargs.title){
			this[ppTitle] = kwargs.title;
			delete kwargs.title;
		}

		if(kwargs.enabled){
			this[ppEnabled] = kwargs.enabled;
			delete kwargs.enabled;
		}else{
			this[ppEnabled] = true;
		}

		if(kwargs.elements){
			if(typeof kwargs.elements === "function"){
				Object.defineProperty(this, "elements", {get: kwargs.elements});
			}else{
				Object.defineProperty(this, "elements", {value: kwargs.elements});
			}
			delete kwargs.elements;
		}

		if(kwargs.postRender){
			this.postRender = kwargs.postRender;
			delete kwargs.postRender;
		}
	}

	destroy(){
		this.unrender();
		delete this.kwargs;
		this.destroyWatch();
		this.destroyAdvise();
	}

	_renderElements(e){
		if(Array.isArray(e)){
			return e.map((e) => this._renderElements(e));
		}else if(e instanceof Element){
			const {type, ctorProps, ppProps, children} = e;
			let result;
			if(componentType(e) === TypeDomNode){
				let domNode = result = Component.createNode(type, ctorProps);
				postProcess(ppProps, this, domNode, true);
				if(children){
					let renderedChildren = this._renderElements(children);
					if(Array.isArray(renderedChildren)){
						renderedChildren.forEach((child, i) => addChildToDomNode(this, domNode, child, componentType(children[i])));
					}else if(children){
						addChildToDomNode(this, domNode, renderedChildren, componentType(children));
					}
				}
			}else{
				let componentInstance = result = new type(ctorProps);
				componentInstance.render();
				postProcess(ppProps, this, componentInstance, false);
				if(children){
					console.error("children not allowed for Component elements")
				}
			}
			return result;
		}else{
			// e must be convertable to a string
			return document.createTextNode(e);
		}
	}

	render(
		proc // [function, optional] called after this class's render work is done, called in context of this
	){
		if(!this._dom){
			let dom = this._dom = {};
			let elements = this.elements;
			validateElements(this, elements);
			let root = dom.root = this._renderElements(elements);
			if(Array.isArray(root)){
				root.forEach((node) => Component.catalog.set(node, this));
			}else{
				Component.catalog.set(root, this);
				if(this.id){
					root.id = this.id;
				}
				this.addClassName(root.className);
				let className = calcDomClassName(this);
				if(className){
					root.className = className;

				}

				if(this[ppTabIndex] !== undefined){
					(this._dom.tabIndexNode || this._dom.root).tabIndex = this[ppTabIndex]
				}
				if(this[ppTitle] !== undefined){
					(this._dom.titleIndexNode || this._dom.root).title = this[ppTitle]
				}
			}
			if(this.postRender){
				this.ownWhileRendered(this.postRender());
			}
			proc && proc.call(this);
			this._applyWatchersRaw("rendered", false, true);
		}
		return this._dom.root;
	}

	get elements(){
		return element("div", {});
	}

	unrender(){
		if(this.rendered){
			let root = this._dom.root;
			if(Array.isArray(root)){
				root.forEach((node) =>{
					Component.catalog.delete(node);
					node.parentNode && node.parentNode.removeChild(node);
				});
			}else{
				Component.catalog.delete(root);
				root.parentNode && root.parentNode.removeChild(root);
			}
			if(this[ppParent]){
				this[ppParent].delChild(this);
				delete this[ppParent];
			}
			if(this._dom.handles){
				this._dom.handles.forEach(handle => handle.destroy());
			}
			if(this.children){
				this.children.slice().forEach((child) =>{
					child.destroy();
				});
			}
			delete this.children;
			delete this._dom;
			this._applyWatchersRaw("rendered", true, false);
		}
	}

	get rendered(){
		return !!(this._dom && this._dom.root);
	}

	own(...handles){
		pushHandles(this[ppOwnedHandles] || (this[ppOwnedHandles] = []), ...handles);
	}

	ownWhileRendered(...handles){
		pushHandles(this._dom.handles || (this._dom.handles = []), ...handles);
	}

	get parent(){
		return this[ppParent];
	}

	_adopt(child){
		if(child[ppParent]){
			child[ppParent].delChild(child, true);
		}
		(this.children || (this.children = [])).push(child);
		child[ppParent] = this;
	}

	_orphan(){
		if(this[ppParent]){
			this[ppParent] = null;
		}
	}

	insChild(child, node){
		if(!this.rendered){
			throw new Error("parent component must be rendered before explicitly inserting a child");
		}
		if(child instanceof Element){
			child = render(child);
		}
		if(!(child instanceof Component)){
			throw new Error("child must be a subclass of Component");
		}

		node = node ? (node in this ? this[node] : node) : this._dom.root;
		let childRoot = child.render();
		if(Array.isArray(childRoot)){
			childRoot.forEach((childNode) => node.appendChild(childNode));
		}else{
			node.appendChild(childRoot)
		}
		this._adopt(child);
	}

	delChild(child, preserve){
		let index = this.children ? this.children.indexOf(child) : -1;
		if(index !== -1){
			let root = child._dom && child._dom.root;
			if(Array.isArray(root)){
				root.forEach(node => node.parentNode && node.parentNode.removeChild(node));
			}else{
				root.parentNode && root.parentNode.removeChild(root)
			}
			child._orphan();
			this.children.splice(index, 1);
			if(!preserve){
				child.destroy();
				child = false;
			}
			return child;
		}
		return false;
	}

	reorderChildren(children){
		let thisChildren = this.children;
		let node = this.children[0]._dom.root.parentNode;

		children.forEach((child, i) =>{
			if(thisChildren[i] !== child){
				let index = thisChildren.indexOf(child, i + 1);
				thisChildren.splice(index, 1);
				node.insertBefore(child._dom.root, thisChildren[i]._dom.root);
				thisChildren.splice(i, 0, child);
			}
		});
	}

	resize(hint // [hash, optional] typically with h, w properties, but semantics defined by particular class
	){
	}

	get visible(){
		return !this.containsClassName("bd-hidden");
	}

	set visible(value){
		value = !!value;
		if(value !== !this.containsClassName("bd-hidden")){
			if(value){
				this.removeClassName("bd-hidden");
				this.resize();
			}else{
				this.addClassName("bd-hidden");
			}
		}
	}

	get className(){
		// WARNING: if a staticClassName was given as a constructor argument, then that part of node.className is NOT returned
		if(this.rendered){
			// if rendered, then look at what's actually in the document...maybe client code _improperly_ manipulated directly
			let root = this._dom.root;
			if(Array.isArray(root)){
				root = root[0];
			}
			let className = root.className;
			if(this[ppStaticClassName]){
				this[ppStaticClassName].split(" ").forEach(s => className.replace(s, ""));
			}
			return cleanClassName(className);
		}else{
			return this[ppClassName];
		}
	}

	set className(value){
		// WARNING: if a staticClassName was given as a constructor argument, then that part of node.className is NOT affected

		// clean up any space sloppiness, sometimes caused by client-code algorithms that manipulate className
		value = cleanClassName(value);
		if(!value){
			if(this[ppClassName]){
				this[ppSetClassName]("", this[ppClassName]);
			}
		}else if(!this[ppClassName]){
			this[ppSetClassName](value, "");
		}else{
			if(value !== this[ppClassName]){
				this[ppSetClassName](value, this[ppClassName]);
			}
		}
	}

	containsClassName(value){
		// WARNING: if a staticClassName was given as a constructor argument, then that part of node.className is NOT considered

		value = cleanClassName(value);
		return this[ppClassName].indexOf(value) !== -1;
	}

	addClassName(...values){
		values.forEach((value) =>{
			value = cleanClassName(value);
			if(this[ppClassName].indexOf(value) === -1){
				this[ppSetClassName]((this[ppClassName] ? this[ppClassName] + " " : "") + value, this[ppClassName]);
			}
		});
		return this;
	}

	removeClassName(...values){
		// WARNING: if a staticClassName was given as a constructor argument, then that part of node.className is NOT considered
		values.forEach((value) =>{
			value = cleanClassName(value);
			if(this[ppClassName].indexOf(value) !== -1){
				this[ppSetClassName](this[ppClassName].replace(value, ""), this[ppClassName])
			}
		});
		return this;
	}

	toggleClassName(...values){
		// WARNING: if a staticClassName was given as a constructor argument, then that part of node.className is NOT considered
		values.forEach((value) =>{
			value = cleanClassName(value);
			if(this[ppClassName].indexOf(value) !== -1){
				this[ppSetClassName](this[ppClassName].replace(value, ""), this[ppClassName])
			}else{
				this[ppSetClassName](this[ppClassName] + " " + value, this[ppClassName])
			}
		});
		return this;
	}

	[ppSetClassName](newValue, oldValue){
		newValue = cleanClassName(newValue);
		this[ppClassName] = newValue;
		if(this.rendered){
			this._dom.root.className = calcDomClassName(this);
		}
		this._applyWatchersRaw("className", oldValue, newValue);
		let oldVisibleValue = oldValue ? oldValue.indexOf("hidden") === -1 : true,
			newVisibleValue = newValue ? newValue.indexOf("hidden") === -1 : true;
		if(oldVisibleValue !== newVisibleValue){
			this._applyWatchersRaw("visible", oldVisibleValue, newVisibleValue);
		}
	}

	[ppOnFocus](){
		this.addClassName("bd-focused");
		this._applyWatchers("hasFocus", ppHasFocus, true);
	}

	[ppOnBlur](){
		this.removeClassName("bd-focused");
		this._applyWatchers("hasFocus", ppHasFocus, false);
	}

	get hasFocus(){
		return this[ppHasFocus];
	}

	get tabIndex(){
		if(this.rendered){
			// unconditionally make sure this[ppTabIndex] and the dom is synchronized on each get
			return (this[ppTabIndex] = (this._dom.tabIndexNode || this._dom.root).tabIndex);
		}else{
			return this[ppTabIndex]
		}
	}

	set tabIndex(value){
		if(value !== this[ppTabIndex]){
			this.rendered && ((this._dom.tabIndexNode || this._dom.root).tabIndex = value);
			this._applyWatchers("tabIndex", ppTabIndex, value);
		}
	}

	get enabled(){
		return this[ppEnabled];
	}

	set enabled(value){
		this._applyWatchers("enabled", ppEnabled, !!value);
		this[value ? "removeClassName" : "addClassName"]("bd-disabled");
	}

	get title(){
		if(this.rendered){
			return (this._dom.titleNode || this._dom.root).title;
		}else{
			return this[ppTitle];
		}
	}

	set title(value){
		if(value !== this[ppTitle]){
			this.rendered && ((this._dom.titleNode || this._dom.root).title = value);
			this._applyWatchers("title", ppTitle, value);
		}
	}
}

const objectToString = ({}).toString();


export function render(type, props, attachPoint, position){
	// six signatures...
	//     1. render(e:Element)
	//     => render(Component, {elements:e}, null)
	//
	//     2. render(e:Element, node:domNode[, position:Position="last"])
	// 	   => render(Component, {elements:e}, node, position)
	//
	//     3. render(C:Component)
	//     => render(C, {}, null)
	//
	//     4. render(C:Component, args:kwargs)
	//     => render(C, args, null)
	//
	//     5. render(C:Component, node:domNode[, position:Position="last"])
	//     => render(C, {}, node, position)
	//
	//     6. render(C:Component, args:kwargs, node:domNode[, position:Position="last"])
	//     => render(C, args, node, position)
	//
	// Position one of "first", "last", "before", "after"
	//
	let C;
	let ppProps = {};
	if(type instanceof Element){
		// [1] or [2]
		position = attachPoint || "last";
		attachPoint = props;
		if(componentType(type) === TypeComponentNode){
			C = type.type;
			props = type.ctorProps;
			ppProps = type.ppProps
		}else{
			C = Component;
			props = {elements: type};
		}
	}else{
		if(arguments.length === 1){
			// [3]
			C = type;
			props = {};
			attachPoint = null;
		}else if(arguments.length === 2){
			if(props + "" === objectToString){
				// [4]
				C = type;
			}else{
				// [5] without position
				C = type;
				attachPoint = props;
				position = "last";
				props = {}
			}
		}else if(arguments.length === 3){
			let typeofAttachPoint = typeof attachPoint;
			if(typeofAttachPoint === "string" || typeofAttachPoint === "number"){
				// [5] with position
				C = type;
				position = attachPoint;
				attachPoint = props;
				props = {}
			}else{
				// [6] without position
				C = type;
				position = "last";
			}
		}else{
			// [6]
			C = type;
		}
	}
	let result = new C(props);
	result.render();
	postProcess(ppProps, result, result, false);

	if(attachPoint){

		function unrender(node){
			if(node){
				if(Array.isArray(node)){
					node.forEach(unrender);
				}else{
					let component = Component.catalog.get(node);
					if(component){
						component.unrender();
					}
				}
			}
		}

		let root = result._dom.root;
		if(Array.isArray(root)){
			root.forEach((node) => unrender(Component.insertNode(node, attachPoint, position)));
		}else{
			unrender(Component.insertNode(root, attachPoint, position));
		}
	}
	return result;
}

Object.assign(Component, {
	ppClassName: ppClassName,
	ppStaticClassName: ppStaticClassName,
	ppEnabled: ppEnabled,
	ppTabIndex: ppTabIndex,
	ppTitle: ppTitle,
	ppParent: ppParent,
	ppHasFocus: ppHasFocus,
	ppOnFocus: ppOnFocus,
	ppOnBlur: ppOnBlur,
	ppSetClassName: ppSetClassName,
	ppOwnedHandles: ppOwnedHandles,
	catalog: new Map(),
	render: render
});
