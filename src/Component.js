import {default as element, Element} from "./element.js";
import EventHub from "./EventHub.js";
import WatchHub from "./WatchHub.js";

element.insPostProcessingFunction("attach", "bd",
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

element.insPostProcessingFunction("watch", "bd",
	function(target, source, resultIsDomNode, watchers){
		Reflect.ownKeys(watchers).forEach((name) => {
			source.ownWhileRendered(source.watch(name, watchers[name]));
		});
	}
);

element.insPostProcessingFunction("exec", "bd",
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

element.insPostProcessingFunction("titleNode", "bd",
	function(target, source){
		target.bdDom.titleNode = source;
	}
);

element.insPostProcessingFunction("staticClassName", "bd",
	function(target, source, resultIsDomNode, className){
		target[pStaticClassName] = className;
	}
);

element.insPostProcessingFunction("parentAttachPoint", "bd",
	function(target, source, resultIsDomNode, propertyName){
		// source should be a component instance and resultIsDomNode should be false
		source[pParentAttachPoint] = propertyName;
	}
);

element.insPostProcessingFunction("childrenAttachPoint", "bd",
	function(target, source, resultIsDomNode, value){
		// source should be a DOM node and resultIsDomNode should be true
		if(value){
			target[pChildrenAttachPoint] = source;
		}
	}
);

element.insPostProcessingFunction("reflectClass", "bd",
	function(target, source, resultIsDomNode, ...args){
		// possibly many of the following sequences....
		// <string>
		// <string>, <formatter>
		// <watchable>
		//
		// note that <watchable>, <formatter> works, but should not be used and is not guaranteed; instead, ensure
		// that any required formatter is built into the watchable
		function install(prop, formatter){
			let watcher = formatter ?
				(newValue, oldValue) => {
					newValue = formatter(newValue);
					oldValue = formatter(oldValue);
					newValue !== oldValue && target.removeClassName(oldValue).addClassName(newValue);
				} :
				(newValue, oldValue) => {
					newValue !== oldValue && target.removeClassName(oldValue).addClassName(newValue);
				};
			if(typeof prop === "string"){
				target.addClassName(formatter ? formatter(target[prop]) : target[prop]);
				target.ownWhileRendered(target.watch(prop, watcher));
			}else{
				target.addClassName(prop.value);
				target.ownWhileRendered(prop.watch(watcher));
			}
		}

		while(args.length){
			install(args.shift(), typeof args[0] === "function" ? args.shift() : null);
		}
	}
);

element.insPostProcessingFunction("reflect", "bd",
	function(target, source, resultIsDomNode, prop, formatter){
		// <string>
		// <string>, <formatter>
		// <watchable>
		let p = source.tagName === "INPUT" ? "value" : "innerHTML";
		if(typeof prop === "string"){
			source[p] = formatter ? formatter(target[prop]) : target[prop];
			let watcher = formatter ?
				newValue => {
					source[p] = formatter(newValue);
				} :
				newValue => {
					source[p] = newValue;
				};
			target.ownWhileRendered(target.watch(prop, watcher));
		}else{
			source[p] = prop.value;
			target.ownWhileRendered(prop.watch(newValue => (source[p] = newValue)));
		}
	}
);

element.insPostProcessingFunction("reflectProp", "bd",
	function(target, source, resultIsDomNode, props){
		// props is a hash from property to one of...
		//     <string>
		//     <string>, <formatter>
		//     <watchable>
		Object.keys(props).forEach(destProp => {
			let srcProp = props[destProp];
			let formatter = null;
			if(Array.isArray(srcProp)){
				formatter = srcProp[1];
				srcProp = srcProp[0];
			}
			if(typeof srcProp === "string"){
				source[destProp] = formatter ? formatter(target[srcProp]) : target[srcProp];
				let watcher = formatter ?
					(newValue) => {
						source[destProp] = formatter(newValue);
					} :
					(newValue) => {
						source[destProp] = newValue;
					};
				target.ownWhileRendered(target.watch(srcProp, watcher));
			}else{
				source[destProp] = srcProp.value;
				target.ownWhileRendered(srcProp.watch(newValue => (source[destProp] = newValue)));
			}
		});
	}
);

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
	let rootStaticDomClass = component[pStaticClassName];
	let className = component[pClassName];
	if(rootStaticDomClass && className){
		return rootStaticDomClass + " " + className;
	}else{
		return rootStaticDomClass || className;
	}
}

function addChildToDomNode(parent, domNode, child, childIsComponent){
	if(childIsComponent){
		let childDomRoot = child.bdDom.root;
		if(Array.isArray(childDomRoot)){
			childDomRoot.forEach((node) => Component.insertNode(node, domNode));
		}else{
			Component.insertNode(childDomRoot, domNode);
		}
		parent.bdAdopt(child);
	}else{
		Component.insertNode(child, domNode);
	}
}

function validateElements(elements){
	if(Array.isArray(elements)){
		elements.forEach(e => validateElements);
	}else if(elements.isComponentType){
		throw new Error("Illegal: root element(s) for a Component cannot be Components");
	}
}

function postProcess(ppProps, owner, target, targetIsDomNode){
	Reflect.ownKeys(ppProps).forEach((ppProp) => {
		let args = ppProps[ppProp];
		if(Array.isArray(args)){
			element[ppProp](owner, target, targetIsDomNode, ...args);
		}else{
			element[ppProp](owner, target, targetIsDomNode, args);
		}
	});
}

function renderElements(owner, e){
	if(Array.isArray(e)){
		return e.map((e) => renderElements(owner, e));
	}else if(e instanceof Element){
		const {type, ctorProps, ppProps, children} = e;
		let result;
		if(!e.isComponentType){
			let domNode = result = Component.createNode(type, ctorProps);
			if("tabIndex" in ctorProps && ctorProps.tabIndex !== false){
				owner.bdDom.tabIndexNode = domNode;
			}
			ppProps && postProcess(ppProps, owner, domNode, true);
			if(children){
				let renderedChildren = renderElements(owner, children);
				if(Array.isArray(renderedChildren)){
					renderedChildren.forEach((child, i) => addChildToDomNode(owner, domNode, child, children[i].isComponentType));
				}else{
					addChildToDomNode(owner, domNode, renderedChildren, children.isComponentType);
				}
			}
		}else{
			let componentInstance = result = new type(ctorProps);
			componentInstance.render();
			ppProps && postProcess(ppProps, owner, componentInstance, false);
			if(children){
				let renderedChildren = renderElements(owner, children);
				if(Array.isArray(renderedChildren)){
					renderedChildren.forEach((child) => result.insChild(child));
				}else{
					result.insChild(renderedChildren);
				}
			}
		}
		return result;
	}else{
		// e must be convertible to a string
		return document.createTextNode(e);
	}
}

function pushHandles(dest, ...handles){
	handles.forEach(h => {
		if(Array.isArray(h)){
			pushHandles(dest, ...h);
		}else if(h){
			dest.push(h);
		}
	});
}

// a tiny little helper class to define names as symbols and keep a list of what's been defined
class Namespace {
	get(name){
		return this[name] || (this[name] = Symbol(name));
	}

	publish(dest){
		Object.keys(this).forEach(name => {
			if(dest[name]){
				throw new Error("dest already has name :" + name);
			}
			dest[name] = this[name]
		});
	}
}

// could be done so much better with lisp macros...
let ns = new Namespace();
const
	pClassName = ns.get("pClassName"),
	pStaticClassName = ns.get("pStaticClassName"),
	pEnabled = ns.get("pEnabled"),
	pTabIndex = ns.get("pTabIndex"),
	pTitle = ns.get("pTitle"),
	pParent = ns.get("pParent"),
	pHasFocus = ns.get("pHasFocus"),
	pOnFocus = ns.get("pOnFocus"),
	pOnBlur = ns.get("pOnBlur"),
	pSetClassName = ns.get("pSetClassName"),
	pParentAttachPoint = ns.get("pParentAttachPoint"),
	pChildrenAttachPoint = ns.get("pChildrenAttachPoint"),
	pAttachedToDoc = ns.get("pAttachedToDoc");

const ownedHandlesCatalog = new WeakMap();


export default class Component extends EventHub(WatchHub()) {
	constructor(kwargs){
		super(kwargs);

		this[pHasFocus] = false;

		let saveKwargs = false;
		let theConstructor = this.constructor;
		if(theConstructor.saveKwargs !== false){
			kwargs = this.kwargs = Object.assign({}, kwargs);
			saveKwargs = true;
		}

		// id, if provided, is read-only
		Object.defineProperty(this, "id", {value: kwargs.id, enumerable: true});
		saveKwargs && kwargs.id && delete kwargs.id;

		if(kwargs.staticClassName){
			this[pStaticClassName] = kwargs.staticClassName + (theConstructor.className ? " " + theConstructor.className : "");
			if(saveKwargs) delete kwargs.staticClassName;
		}else if(theConstructor.className){
			this[pStaticClassName] = theConstructor.className;
		}

		this[pClassName] = "";
		if(kwargs.className){
			Array.isArray(kwargs.className) ? this.addClassName(...kwargs.className) : this.addClassName(kwargs.className);
			if(saveKwargs) delete kwargs.className;
		}

		if(kwargs.tabIndex){
			this[pTabIndex] = kwargs.tabIndex;
			if(saveKwargs) delete kwargs.tabIndex;
		}

		if(kwargs.title){
			this[pTitle] = kwargs.title;
			if(saveKwargs) delete kwargs.title;
		}

		if(kwargs.enabled !== undefined){
			this[pEnabled] = !!kwargs.enabled;
			if(saveKwargs) delete kwargs.enabled;
		}else{
			this[pEnabled] = true;
		}

		if(kwargs.elements){
			if(typeof kwargs.elements === "function"){
				Object.defineProperty(this, "bdElements", {value: kwargs.elements});
			}else{
				let bdElements = (function(elements){
					return function(){
						return elements;
					};
				})(kwargs.elements);
				Object.defineProperty(this, "bdElements", {value: bdElements});
			}
			if(saveKwargs) delete kwargs.elements;
		}

		if(kwargs.postRender){
			this.postRender = kwargs.postRender;
			if(saveKwargs) delete kwargs.postRender;
		}
	}

	destroy(){
		this.unrender();
		let handles = ownedHandlesCatalog.get(this);
		if(handles){
			handles.forEach(handle => handle.destroy());
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
			if(this._elements){
				console.warn("Component::_elements is deprecated; it has been renamed to Component::bdElements")
			}
			let elements = (this._elements && this._elements()) || this.bdElements();
			validateElements(elements);
			let root = dom.root = this.constructor.renderElements(this, elements);
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

				if(this.bdDom.tabIndexNode){
					if(this[pTabIndex] === undefined){
						this[pTabIndex] = this.bdDom.tabIndexNode.tabIndex;
					}else{
						this.bdDom.tabIndexNode.tabIndex = this[pTabIndex];
					}
				}else if(this[pTabIndex] !== undefined){
					(this.bdDom.tabIndexNode || this.bdDom.root).tabIndex = this[pTabIndex];
				}
				if(this[pTitle] !== undefined){
					(this.bdDom.titleNode || this.bdDom.root).title = this[pTitle];
				}

				this[this[pEnabled] ? "removeClassName" : "addClassName"]("bd-disabled");
			}
			if(this.postRender){
				this.ownWhileRendered(this.postRender());
			}
			proc && proc.call(this);
			this.bdMutateNotify("rendered", false, true);
		}
		return this.bdDom.root;
	}

	bdElements(){
		return element("div", {});
	}

	unrender(){
		if(this.rendered){
			if(this[pParent]){
				this[pParent].delChild(this, true);
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
					Component.catalog.delete(node);
					node.parentNode && node.parentNode.removeChild(node);
				});
			}else{
				Component.catalog.delete(root);
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
		return this[pParent];
	}

	bdAdopt(child){
		if(child[pParent]){
			throw new Error("unexpected");
		}
		(this.children || (this.children = [])).push(child);

		child.bdMutate("parent", pParent, this);
		child.bdAttachToDoc(this[pAttachedToDoc]);
	}

	bdAttachToDoc(value){
		if(this.bdMutate("attachedToDoc", pAttachedToDoc, !!value)){
			this.children && this.children.forEach(child => child.bdAttachToDoc(value));
			return true;
		}else{
			return false;
		}
	}

	get attachedToDoc(){
		return !!this[pAttachedToDoc];
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
				src = element(Component, {elements: src});
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
		}else if(child[pParentAttachPoint]){
			// child is telling the parent where it wants to go; this is more specific than pChildrenAttachPoint
			if(child[pParentAttachPoint] in this){
				attachPoint = this[child[pParentAttachPoint]];
			}else{
				throw new Error("unexpected");
			}
		}else{
			attachPoint = this[pChildrenAttachPoint] || this.bdDom.root;
			if(Array.isArray(attachPoint)){
				throw new Error("unexpected");
			}
		}

		let childRoot = child.bdDom.root;
		if(Array.isArray(childRoot)){
			let firstChildNode = childRoot[0];
			unrender(Component.insertNode(firstChildNode, attachPoint, position));
			childRoot.slice(1).reduce((prevNode, node) => {
				Component.insertNode(node, prevNode, "after");
				return node;
			}, firstChildNode);
		}else{
			unrender(Component.insertNode(childRoot, attachPoint, position));
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
			child.bdMutate("parent", pParent, null);
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

	get className(){
		// WARNING: if a staticClassName was given as a constructor argument, then that part of node.className is NOT returned
		if(this.rendered){
			// if rendered, then look at what's actually in the document...maybe client code _improperly_ manipulated directly
			let root = this.bdDom.root;
			if(Array.isArray(root)){
				root = root[0];
			}
			let className = root.className;
			if(this[pStaticClassName]){
				this[pStaticClassName].split(" ").forEach(s => className = className.replace(s, ""));
			}
			return cleanClassName(className);
		}else{
			return this[pClassName];
		}
	}

	set className(value){
		// WARNING: if a staticClassName was given as a constructor argument, then that part of node.className is NOT affected

		// clean up any space sloppiness, sometimes caused by client-code algorithms that manipulate className
		value = cleanClassName(value);

		if(!value){
			this[pSetClassName]("", this[pClassName]);
		}else if(!this[pClassName]){
			this[pSetClassName](value, "");
		}else if(value !== this[pClassName]){
			this[pSetClassName](value, this[pClassName]);
		}
	}

	containsClassName(value){
		// WARNING: if a staticClassName was given as a constructor argument, then that part of node.className is NOT considered

		value = cleanClassName(value);
		return (" " + this[pClassName] + " ").indexOf(value) !== -1;
	}

	addClassName(...values){
		this[pSetClassName](conditionClassNameArgs(values).reduce((className, value) => {
			return classValueToRegExp(value).test(className) ? className : className + value + " ";
		}, " " + this[pClassName] + " ").trim(), this[pClassName]);
		return this;
	}

	removeClassName(...values){
		// WARNING: if a staticClassName was given as a constructor argument, then that part of node.className is NOT considered
		this[pSetClassName](conditionClassNameArgs(values).reduce((className, value) => {
			return className.replace(classValueToRegExp(value, "g"), " ");
		}, " " + this[pClassName] + " ").trim(), this[pClassName]);
		return this;
	}

	toggleClassName(...values){
		// WARNING: if a staticClassName was given as a constructor argument, then that part of node.className is NOT considered
		this[pSetClassName](conditionClassNameArgs(values).reduce((className, value) => {
			if(classValueToRegExp(value).test(className)){
				return className.replace(classValueToRegExp(value, "g"), " ");
			}else{
				return className + value + " ";
			}
		}, " " + this[pClassName] + " ").trim(), this[pClassName]);
		return this;
	}

	[pSetClassName](newValue, oldValue){
		if(newValue !== oldValue){
			this[pClassName] = newValue;
			if(this.rendered){
				this.bdDom.root.className = calcDomClassName(this);
			}
			this.bdMutateNotify("className", oldValue, newValue);
			let oldVisibleValue = oldValue ? oldValue.indexOf("hidden") === -1 : true,
				newVisibleValue = newValue ? newValue.indexOf("hidden") === -1 : true;
			if(oldVisibleValue !== newVisibleValue){
				this.bdMutateNotify("visible", oldVisibleValue, newVisibleValue);
			}
		}
	}

	[pOnFocus](){
		this.addClassName("bd-focused");
		this.bdMutate("hasFocus", pHasFocus, true);
	}

	[pOnBlur](){
		this.removeClassName("bd-focused");
		this.bdMutate("hasFocus", pHasFocus, false);
	}

	get hasFocus(){
		return this[pHasFocus];
	}

	focus(){
		(this.bdDom.tabIndexNode || this.bdDom.root).focus();
	}

	get tabIndex(){
		if(this.rendered){
			// unconditionally make sure this[pTabIndex] and the dom is synchronized on each get
			return (this[pTabIndex] = (this.bdDom.tabIndexNode || this.bdDom.root).tabIndex);
		}else{
			return this[pTabIndex];
		}
	}

	set tabIndex(value){
		if(value !== this[pTabIndex]){
			this.rendered && ((this.bdDom.tabIndexNode || this.bdDom.root).tabIndex = value);
			this.bdMutate("tabIndex", pTabIndex, value);
		}
	}

	get enabled(){
		return this[pEnabled];
	}

	set enabled(value){
		if(this.bdMutate("enabled", pEnabled, !!value)){
			this[value ? "removeClassName" : "addClassName"]("bd-disabled");
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
			return this[pTitle];
		}
	}

	set title(value){
		if(this.bdMutate("title", pTitle, value)){
			this.rendered && ((this.bdDom.titleNode || this.bdDom.root).title = value);
		}
	}
}

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
	//     => isComponentDerivedCtor(e.type), then render e.type(e.props); render Component({elements:e})
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
			return {src: element(arg1)};
		}else{
			// more than one argument; the second argument is either props or not
			if(Object.getPrototypeOf(arg2) === prototypeOfObject){
				// [4] or [6]
				// WARNING: this signature requires kwargs to be a plain Javascript Object (which is should be!)
				return {src: element(arg1, arg2), attachPoint: arg3, position: arg4};
			}else{
				// [5]
				return {src: element(arg1), attachPoint: arg2, position: arg3};
			}
		}
	}
}

function unrender(node){
	function unrender_(node){
		let component = Component.catalog.get(node);
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

	if(attachPoint){
		let root = result.bdDom.root;
		if(Array.isArray(root)){
			let firstChildNode = root[0];
			unrender(Component.insertNode(firstChildNode, attachPoint, position));
			root.slice(1).reduce((prevNode, node) => {
				Component.insertNode(node, prevNode, "after");
				return node;
			}, firstChildNode);
		}else{
			unrender(Component.insertNode(root, attachPoint, position));
		}
		result.bdAttachToDoc(document.body.contains(attachPoint));
	}
	return result;
}

ns.publish(Component);

Object.assign(Component, {
	renderElements: renderElements,
	Namespace: Namespace,
	render: render,
	catalog: new Map(),
	watchables: ["rendered", "parent", "attachedToDoc", "className", "hasFocus", "tabIndex", "enabled", "visible", "title"],
	events: []
});


