import {getPostProcessingFunction, insPostProcessingFunction} from "./postProcessingCatalog.js";
import {Element} from "./element.js";
import {EventHub} from "./EventHub.js";
import {WatchHub, withWatchables, getWatchable} from "./watchUtils.js";

let document = 0;
let createNode = 0;
let insertNode = 0;

export function initialize(_document, _createNode, _insertNode){
	document = _document;
	createNode = _createNode;
	insertNode = _insertNode;
}

function cleanClassName(s){
	return s.replace(/\s{2,}/g, " ").trim();
}

function conditionClassNameArgs(args){
	return args.reduce((acc, item) => {
		if(item instanceof RegExp){
			acc.push(item);
		}else{
			acc = acc.concat(item.split(" ").map(s => s.trim()).filter(s => !!s));
		}
		return acc;
	}, []);
}

function classValueToRegExp(v, args){
	return v instanceof RegExp ? v : RegExp(" " + v + " ", args);
}

function calcDomClassName(component){
	let staticClassName = component.staticClassName;

	let className = component.bdClassName;
	if(staticClassName && className){
		return staticClassName + " " + className;
	}else{
		return staticClassName || className;
	}
}

function addChildToDomNode(parent, domNode, child, childIsComponent){
	if(childIsComponent){
		let childDomRoot = child.bdDom.root;
		if(Array.isArray(childDomRoot)){
			childDomRoot.forEach((node) => insertNode(node, domNode));
		}else{
			insertNode(childDomRoot, domNode);
		}
		parent.bdAdopt(child);
	}else{
		insertNode(child, domNode);
	}
}

function validateElements(elements){
	if(Array.isArray(elements)){
		elements.forEach(validateElements);
	}else if(elements.isComponentType){
		throw new Error("Illegal: root element(s) for a Component cannot be Components");
	}
}

function postProcess(ppProps, owner, target, targetIsDomNode){
	Reflect.ownKeys(ppProps).forEach((ppProp) => {
		let args = ppProps[ppProp];
		if(Array.isArray(args)){
			getPostProcessingFunction(ppProp)(owner, target, targetIsDomNode, ...args);
		}else{
			getPostProcessingFunction(ppProp)(owner, target, targetIsDomNode, args);
		}
	});
}

function noop(){
}

function pushHandles(dest, ...handles){
	handles.forEach(h => {
		if(Array.isArray(h)){
			pushHandles(dest, ...h);
		}else if(h){
			let destroy = h.destroy.bind(h);
			h.destroy = function(){
				destroy();
				let index = dest.indexOf(h);
				if(index !== -1){
					dest.splice(index, 1);
				}
				h.destroy = noop;
			};
			dest.push(h);
		}
	});
}

const ownedHandlesCatalog = new WeakMap();
const domNodeToComponent = new Map();

export class Component extends EventHub(WatchHub()) {
	constructor(kwargs = {}){
		// notice that this class requires only the per-instance data actually used by its subclass/instance
		super();

		if(!this.constructor.noKwargs){
			this.kwargs = kwargs;
		}

		// id, if provided, is read-only
		if(kwargs.id){
			Object.defineProperty(this, "id", {value: kwargs.id + "", enumerable: true});
		}

		if(kwargs.className){
			Array.isArray(kwargs.className) ? this.addClassName(...kwargs.className) : this.addClassName(kwargs.className);
		}

		if(kwargs.tabIndex !== undefined){
			this.tabIndex = kwargs.tabIndex;
		}

		if(kwargs.title){
			this.title = kwargs.title;
		}

		if(kwargs.disabled || (kwargs.enabled !== undefined && !kwargs.enabled)){
			this.disabled = true;
		}

		if(kwargs.elements){
			if(typeof kwargs.elements === "function"){
				this.bdElements = kwargs.elements;
			}else{
				this.bdElements = () => kwargs.elements;
			}
		}

		if(kwargs.postRender){
			this.postRender = kwargs.postRender;
		}

		if(kwargs.mix){
			Reflect.ownKeys(kwargs.mix).forEach(p => (this[p] = kwargs.mix[p]));
		}

		if(kwargs.callbacks){
			let events = this.constructor.events;
			Reflect.ownKeys(kwargs.callbacks).forEach(key => {
				if(events.indexOf(key) !== -1){
					this.advise(key, kwargs.callbacks[key]);
				}else{
					this.watch(key, kwargs.callbacks[key]);
				}
			});
		}
	}

	destroy(){
		this.unrender();
		let handles = ownedHandlesCatalog.get(this);
		if(handles){
			while(handles.length) handles.shift().destroy();
			ownedHandlesCatalog.delete(this);
		}
		this.destroyWatch();
		this.destroyAdvise();
		delete this.kwargs;
		this.destroyed = true;
	}

	render(
		proc // [function, optional] called after this class's render work is done, called in context of this
	){
		if(!this.bdDom){
			let dom = this.bdDom = this._dom = {};
			let elements = this.bdElements();
			validateElements(elements);
			let root = dom.root = this.constructor.renderElements(this, elements);
			if(Array.isArray(root)){
				root.forEach((node) => domNodeToComponent.set(node, this));
			}else{
				domNodeToComponent.set(root, this);
				if(this.id){
					root.id = this.id;
				}
				this.addClassName(root.getAttribute("class") || "");
				let className = calcDomClassName(this);
				if(className){
					root.setAttribute("class", className);
				}

				if(this.bdDom.tabIndexNode){
					if(this.bdTabIndex === undefined){
						this.bdTabIndex = this.bdDom.tabIndexNode.tabIndex;
					}else{
						this.bdDom.tabIndexNode.tabIndex = this.bdTabIndex;
					}
				}else if(this.bdTabIndex !== undefined){
					(this.bdDom.tabIndexNode || this.bdDom.root).tabIndex = this.bdTabIndex;
				}
				if(this.bdTitle !== undefined){
					(this.bdDom.titleNode || this.bdDom.root).title = this.bdTitle;
				}

				this[this.bdDisabled ? "addClassName" : "removeClassName"]("bd-disabled");
			}
			this.ownWhileRendered(this.postRender());
			proc && proc.call(this);
			this.bdMutateNotify("rendered", false, true);
		}
		return this.bdDom.root;
	}

	postRender(){
		// no-op
	}

	bdElements(){
		return new Element("div", {});
	}

	unrender(){
		if(this.rendered){
			if(this.bdParent){
				this.bdParent.delChild(this, true);
			}

			if(this.children){
				this.children.slice().forEach((child) => {
					child.destroy();
				});
			}
			delete this.children;

			let root = this.bdDom.root;
			if(Array.isArray(root)){
				root.forEach((node) => {
					domNodeToComponent.delete(node);
					node.parentNode && node.parentNode.removeChild(node);
				});
			}else{
				domNodeToComponent.delete(root);
				root.parentNode && root.parentNode.removeChild(root);
			}
			if(this.bdDom.handles){
				this.bdDom.handles.forEach(handle => handle.destroy());
			}
			delete this.bdDom;
			delete this._dom;
			this.bdAttachToDoc(false);
			this.bdMutateNotify("rendered", true, false);
		}
	}

	get rendered(){
		return !!(this.bdDom && this.bdDom.root);
	}

	own(...handles){
		let _handles = ownedHandlesCatalog.get(this);
		if(!_handles){
			ownedHandlesCatalog.set(this, (_handles = []));
		}
		pushHandles(_handles, ...handles);
	}

	ownWhileRendered(...handles){
		pushHandles(this.bdDom.handles || (this.bdDom.handles = []), ...handles);
	}

	get parent(){
		return this.bdParent;
	}

	bdAdopt(child){
		if(child.bdParent){
			throw new Error("unexpected");
		}
		(this.children || (this.children = [])).push(child);

		child.bdMutate("parent", "bdParent", this);
		child.bdAttachToDoc(this.bdAttachedToDoc);
	}

	bdAttachToDoc(value){
		if(this.bdMutate("attachedToDoc", "bdAttachedToDoc", !!value)){
			this.children && this.children.forEach(child => child.bdAttachToDoc(value));
			return true;
		}else{
			return false;
		}
	}

	get attachedToDoc(){
		return !!this.bdAttachedToDoc;
	}

	insChild(...args){
		if(!this.rendered){
			throw new Error("parent component must be rendered before explicitly inserting a child");
		}
		let {src, attachPoint, position} = decodeRender(args);
		let child;
		if(src instanceof Component){
			child = src;
			if(child.parent){
				child.parent.delChild(child, true);
			}
			child.render();
		}else{ // child instanceof Element
			if(!src.isComponentType){
				src = new Element(Component, {elements: src});
			}
			child = this.constructor.renderElements(this, src);
		}

		if(/before|after|replace|only|first|last/.test(attachPoint) || typeof attachPoint === "number"){
			position = attachPoint;
			attachPoint = 0;
		}

		if(attachPoint){
			if(attachPoint in this){
				// node reference
				attachPoint = this[attachPoint];
			}else if(typeof attachPoint === "string"){
				attachPoint = document.getElementById(attachPoint);
				if(!attachPoint){
					throw new Error("unexpected");
				}
			}else if(position !== undefined){
				// attachPoint must be a child Component
				let index = this.children ? this.children.indexOf(attachPoint) : -1;
				if(index !== -1){
					// attachPoint is a child
					attachPoint = attachPoint.bdDom.root;
					if(Array.isArray(attachPoint)){
						switch(position){
							case "replace":
							case "only":
							case "before":
								attachPoint = attachPoint[0];
								break;
							case "after":
								attachPoint = attachPoint[attachPoint.length - 1];
								break;
							default:
								throw new Error("unexpected");
						}
					}
				}else{
					throw new Error("unexpected");
				}
			}else{
				// attachPoint without a position must give a node reference
				throw new Error("unexpected");
			}
		}else if(child.bdParentAttachPoint){
			// child is telling the parent where it wants to go; this is more specific than pChildrenAttachPoint
			if(child.bdParentAttachPoint in this){
				attachPoint = this[child.bdParentAttachPoint];
			}else{
				throw new Error("unexpected");
			}
		}else{
			attachPoint = this.bdChildrenAttachPoint || this.bdDom.root;
			if(Array.isArray(attachPoint)){
				throw new Error("unexpected");
			}
		}

		let childRoot = child.bdDom.root;
		if(Array.isArray(childRoot)){
			let firstChildNode = childRoot[0];
			unrender(insertNode(firstChildNode, attachPoint, position));
			childRoot.slice(1).reduce((prevNode, node) => {
				insertNode(node, prevNode, "after");
				return node;
			}, firstChildNode);
		}else{
			unrender(insertNode(childRoot, attachPoint, position));
		}

		this.bdAdopt(child);
		return child;
	}

	delChild(child, preserve){
		let index = this.children ? this.children.indexOf(child) : -1;
		if(index !== -1){
			let root = child.bdDom && child.bdDom.root;
			let removeNode = (node) => {
				node.parentNode && node.parentNode.removeChild(node);
			};
			Array.isArray(root) ? root.forEach(removeNode) : removeNode(root);
			child.bdMutate("parent", "bdParent", null);
			child.bdAttachToDoc(false);
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
		let node = this.children[0].bdDom.root.parentNode;

		children.forEach((child, i) => {
			if(thisChildren[i] !== child){
				let index = thisChildren.indexOf(child, i + 1);
				thisChildren.splice(index, 1);
				node.insertBefore(child.bdDom.root, thisChildren[i].bdDom.root);
				thisChildren.splice(i, 0, child);
			}
		});
	}

	get staticClassName(){
		return ((this.kwargs.staticClassName || "") + " " + (this.constructor.className || "")).trim();
	}

	get className(){
		// WARNING: if a staticClassName was given as a constructor argument, then that part of node.className is NOT returned
		if(this.rendered){
			// if rendered, then look at what's actually in the document...maybe client code _improperly_ manipulated directly
			let root = this.bdDom.root;
			if(Array.isArray(root)){
				root = root[0];
			}
			let className = root.className;
			let staticClassName = this.staticClassName;
			if(staticClassName){
				staticClassName.split(" ").forEach(s => className = className.replace(s, ""));
			}
			return cleanClassName(className);
		}else{
			return this.bdClassName || "";
		}
	}

	set className(value){
		// WARNING: if a staticClassName was given as a constructor argument, then that part of node.className is NOT affected

		// clean up any space sloppiness, sometimes caused by client-code algorithms that manipulate className
		value = cleanClassName(value);
		if(!this.bdClassName){
			this.bdSetClassName(value, "");
		}else if(!value){
			this.bdSetClassName("", this.bdClassName);
		}else if(value !== this.bdClassName){
			this.bdSetClassName(value, this.bdClassName);
		}
	}

	containsClassName(value){
		// WARNING: if a staticClassName was given as a constructor argument, then that part of node.className is NOT considered

		value = cleanClassName(value);
		return (" " + (this.bdClassName || "") + " ").indexOf(value) !== -1;
	}

	addClassName(...values){
		let current = this.bdClassName || "";
		this.bdSetClassName(conditionClassNameArgs(values).reduce((className, value) => {
			return classValueToRegExp(value).test(className) ? className : className + value + " ";
		}, " " + current + " ").trim(), current);
		return this;
	}

	removeClassName(...values){
		// WARNING: if a staticClassName was given as a constructor argument, then that part of node.className is NOT considered
		let current = this.bdClassName || "";
		this.bdSetClassName(conditionClassNameArgs(values).reduce((className, value) => {
			return className.replace(classValueToRegExp(value, "g"), " ");
		}, " " + current + " ").trim(), current);
		return this;
	}

	toggleClassName(...values){
		// WARNING: if a staticClassName was given as a constructor argument, then that part of node.className is NOT considered
		let current = this.bdClassName || "";
		this.bdSetClassName(conditionClassNameArgs(values).reduce((className, value) => {
			if(classValueToRegExp(value).test(className)){
				return className.replace(classValueToRegExp(value, "g"), " ");
			}else{
				return className + value + " ";
			}
		}, " " + current + " ").trim(), current);
		return this;
	}

	bdSetClassName(newValue, oldValue){
		if(newValue !== oldValue){
			this.bdClassName = newValue;
			if(this.rendered){
				this.bdDom.root.setAttribute("class", calcDomClassName(this));
			}
			this.bdMutateNotify("className", oldValue, newValue);
			let oldVisibleValue = oldValue ? oldValue.indexOf("hidden") === -1 : true,
				newVisibleValue = newValue ? newValue.indexOf("hidden") === -1 : true;
			if(oldVisibleValue !== newVisibleValue){
				this.bdMutateNotify("visible", oldVisibleValue, newVisibleValue);
			}
		}
	}

	bdOnFocus(){
		this.addClassName("bd-focused");
		this.bdMutate("hasFocus", "bdHadFocus", true);
	}

	bdOnBlur(){
		this.removeClassName("bd-focused");
		this.bdMutate("hasFocus", "bdHadFocus", false);
	}

	get hasFocus(){
		return !!this.bdHasFocus;
	}

	focus(){
		if(this.bdDom){
			(this.bdDom.tabIndexNode || this.bdDom.root).focus();
		}
	}

	get tabIndex(){
		if(this.rendered){
			// unconditionally make sure this.bdTabIndex and the dom is synchronized on each get
			return (this.bdTabIndex = (this.bdDom.tabIndexNode || this.bdDom.root).tabIndex);
		}else{
			return this.bdTabIndex;
		}
	}

	set tabIndex(value){
		if(!value && value !== 0){
			value = "";
		}
		if(value !== this.bdTabIndex){
			this.rendered && ((this.bdDom.tabIndexNode || this.bdDom.root).tabIndex = value);
			this.bdMutate("tabIndex", "bdTabIndex", value);
		}
	}

	get enabled(){
		return !this.bdDisabled;
	}

	set enabled(value){
		this.disabled = !value;
	}

	get disabled(){
		return !!this.bdDisabled;
	}

	set disabled(value){
		value = !!value;
		if(this.bdDisabled !== value){
			this.bdDisabled = value;
			this.bdMutateNotify([["disabled", !value, value], ["enabled", value, !value]]);
			this[value ? "addClassName" : "removeClassName"]("bd-disabled");
		}
	}

	get visible(){
		return !this.containsClassName("bd-hidden");
	}

	set visible(value){
		value = !!value;
		if(value !== !this.containsClassName("bd-hidden")){
			if(value){
				this.removeClassName("bd-hidden");
				this.resize && this.resize();
			}else{
				this.addClassName("bd-hidden");
			}
			this.bdMutateNotify("visible", !value, value);
		}
	}

	get title(){
		if(this.rendered){
			return (this.bdDom.titleNode || this.bdDom.root).title;
		}else{
			return this.bdTitle;
		}
	}

	set title(value){
		if(this.bdMutate("title", "bdTitle", value)){
			this.rendered && ((this.bdDom.titleNode || this.bdDom.root).title = value);
		}
	}

	static get(domNode){
		return domNodeToComponent.get(domNode);
	}

	static renderElements(owner, e){
		if(Array.isArray(e)){
			return e.map((e) => Component.renderElements(owner, e));
		}else if(e instanceof Element){
			const {type, ctorProps, ppProps, children} = e;
			let result;
			if(e.isComponentType){
				let componentInstance = result = new type(ctorProps);
				componentInstance.render();
				ppProps && postProcess(ppProps, owner, componentInstance, false);
				if(children){
					let renderedChildren = Component.renderElements(owner, children);
					if(Array.isArray(renderedChildren)){
						renderedChildren.forEach((child) => result.insChild(child));
					}else{
						result.insChild(renderedChildren);
					}
				}
			}else{
				let domNode = result = createNode(type, ctorProps);
				if("tabIndex" in ctorProps && ctorProps.tabIndex !== false){
					owner.bdDom.tabIndexNode = domNode;
				}
				ppProps && postProcess(ppProps, owner, domNode, true);
				if(children){
					let renderedChildren = Component.renderElements(owner, children);
					if(Array.isArray(renderedChildren)){
						renderedChildren.forEach((child, i) => addChildToDomNode(owner, domNode, child, children[i].isComponentType));
					}else{
						addChildToDomNode(owner, domNode, renderedChildren, children.isComponentType);
					}
				}
			}
			return result;
		}else{
			// e must be convertible to a string
			return document.createTextNode(e);
		}
	}
}


Component.watchables = ["rendered", "parent", "attachedToDoc", "className", "hasFocus", "tabIndex", "enabled", "visible", "title"];
Component.events = [];
Component.withWatchables = (...args) => withWatchables(Component, ...args);

insPostProcessingFunction("bdAttach",
	function(target, source, resultIsDomNode, name){
		if(typeof name === "function"){
			name(source);
		}else{
			target[name] = source;
			target.ownWhileRendered({
				destroy: function(){
					delete target[name];
				}
			});
		}
	}
);

insPostProcessingFunction("bdWatch",
	function(target, source, resultIsDomNode, watchers){
		Reflect.ownKeys(watchers).forEach((name) => {
			source.ownWhileRendered(source.watch(name, watchers[name]));
		});
	}
);

insPostProcessingFunction("bdExec",
	function(target, source, resultIsDomNode, ...args){
		for(let i = 0; i < args.length;){
			let f = args[i++];
			if(typeof f === "function"){
				f(target, source);
			}else if(typeof f === "string"){
				if(!(typeof source[f] === "function")){
					// eslint-disable-next-line no-console
					console.error("unexpected");
				}
				if(i < args.length && Array.isArray(args[i])){
					source[f](...args[i++], target, source);
				}else{
					source[f](target, source);
				}
			}else{
				// eslint-disable-next-line no-console
				console.error("unexpected");
			}
		}
	}
);

insPostProcessingFunction("bdTitleNode",
	function(target, source){
		target.bdDom.titleNode = source;
	}
);

insPostProcessingFunction("bdParentAttachPoint",
	function(target, source, resultIsDomNode, propertyName){
		// source should be a component instance and resultIsDomNode should be false
		source.bdParentAttachPoint = propertyName;
	}
);

insPostProcessingFunction("bdChildrenAttachPoint",
	function(target, source, resultIsDomNode, value){
		// source should be a DOM node and resultIsDomNode should be true
		if(value){
			target.bdChildrenAttachPoint = source;
		}
	}
);

insPostProcessingFunction("bdReflectClass",
	function(target, source, resultIsDomNode, ...args){
		// args is a list of ([owner, ] property, [, formatter])...
		// very much like bdReflect, except we're adding/removing components (words) from this.classname

		function normalize(value){
			return !value ? "" : value + "";
		}

		function install(owner, prop, formatter){
			let watchable = getWatchable(owner, prop, formatter);
			target.ownWhileRendered(watchable);
			let value = normalize(watchable.value);
			value && target.addClassName(value);
			target.ownWhileRendered(watchable.watch((newValue, oldValue) => {
				newValue = normalize(newValue);
				oldValue = normalize(oldValue);
				if(newValue !== oldValue){
					oldValue && target.removeClassName(oldValue);
					newValue && target.addClassName(newValue);

				}
			}));
		}

		args = args.slice();
		let owner, prop;
		while(args.length){
			owner = args.shift();
			if(typeof owner === "string" || typeof owner === "symbol"){
				prop = owner;
				owner = target;
			}else{
				prop = args.shift();
			}
			install(owner, prop, typeof args[0] === "function" ? args.shift() : null);
		}
	}
);

function isComponentDerivedCtor(f){
	return f === Component || (f && isComponentDerivedCtor(Object.getPrototypeOf(f)));
}

const prototypeOfObject = Object.getPrototypeOf({});

function decodeRender(args){
	// eight signatures...
	//     Signatures 1-2 render an element, 3-6 render a Component, 7-8 render an instance of a Component
	//
	//     Each of the above groups may or may not have the args node:domNode[, position:Position="last"]
	//     which indicate where to attach the rendered Component instance (or not).
	//
	//     when this decode routine is used by Component::insertChild, then node can be a string | symbol, indicating
	//     an instance property that holds the node
	//
	//     1. render(e:Element)
	//     => isComponentDerivedCtor(e.type), then render e.type(e.props); otherwise, render Component({elements:e})
	//
	//     2. render(e:Element, node:domNode[, position:Position="last"])
	// 	   => [1] with attach information
	//
	//     3. render(C:Component)
	//     => render(C, {})
	//
	//     4. render(C:Component, args:kwargs)
	//     => render(C, args)
	//     // note: args is kwargs for C's constructor; therefore, postprocessing instructions are meaningless unless C's
	//     // construction defines some usage for them (atypical)
	//
	//     5. render(C:Component, node:domNode[, position:Position="last"])
	//     => [3] with attach information
	//
	//     6. render(C:Component, args:kwargs, node:domNode[, position:Position="last"])
	//     => [4] with attach information
	//
	//     7. render(c:instanceof Component)
	//     => c.render()
	//
	//     8. render(c:instanceof Component, node:domNode[, position:Position="last"])
	// 	   => [7] with attach information
	//
	//     Position one of "first", "last", "before", "after", "replace", "only"; see dom::insert
	//
	//     returns {
	//	       src: instanceof Component | Element
	//		   attachPoint: node | string | undefined
	//		   position: string | undefined
	//     }
	//
	//     for signatures 3-6, an Element is manufactured given the arguments
	//
	let [arg1, arg2, arg3, arg4] = args;
	if(arg1 instanceof Element || arg1 instanceof Component){
		// [1] or [2] || [7] or [8]
		return {src: arg1, attachPoint: arg2, position: arg3};
	}else{
		if(!isComponentDerivedCtor(arg1)){
			throw new Error("first argument must be an Element, Component, or a class derived from Component");
		}
		if(args.length === 1){
			// [3]
			return {src: new Element(arg1)};
		}else{
			// more than one argument; the second argument is either props or not
			if(Object.getPrototypeOf(arg2) === prototypeOfObject){
				// [4] or [6]
				// WARNING: this signature requires kwargs to be a plain Javascript Object (which is should be!)
				return {src: new Element(arg1, arg2), attachPoint: arg3, position: arg4};
			}else{
				// [5]
				return {src: new Element(arg1), attachPoint: arg2, position: arg3};
			}
		}
	}
}

function unrender(node){
	function unrender_(node){
		let component = domNodeToComponent.get(node);
		if(component){
			component.destroy();
		}
	}

	Array.isArray(node) ? node.forEach(unrender_) : (node && unrender_(node));
}

export function render(...args){
	let result;
	let {src, attachPoint, position} = decodeRender(args);
	if(src instanceof Element){
		if(src.isComponentType){
			result = new src.type(src.ctorProps);
		}else{
			result = new Component({elements: src});
		}
		result.render();
	}else{ // src instanceof Component
		result = src;
		result.render();
	}

	if(typeof attachPoint === "string"){
		attachPoint = document.getElementById(attachPoint);
	}

	if(attachPoint){
		let root = result.bdDom.root;
		if(Array.isArray(root)){
			let firstChildNode = root[0];
			unrender(insertNode(firstChildNode, attachPoint, position));
			root.slice(1).reduce((prevNode, node) => {
				insertNode(node, prevNode, "after");
				return node;
			}, firstChildNode);
		}else{
			unrender(insertNode(root, attachPoint, position));
		}
		result.bdAttachToDoc(document.body.contains(attachPoint));
	}
	return result;
}




